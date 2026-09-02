/**
 * Model provider registry.
 *
 * Every provider below speaks the OpenAI Chat Completions wire format, so one
 * client and one code path covers all of them — only the base URL, the API key
 * and the default model change. Adding a provider is one entry in this table.
 *
 * Pick one on the admin page, or leave it on automatic and the first provider
 * with a credential is used.
 */

import { setting } from './settings.js'

export interface ProviderSpec {
  id: string
  label: string
  baseURL: string
  /** Environment variables checked for this provider's key, in order. */
  keyEnv: string[]
  defaultModel: string
  /** Local runtimes need no credential. */
  keyless?: boolean
  /** Extra headers some gateways expect. */
  headers?: Record<string, string>
  notes?: string
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    keyEnv: ['OPENAI_API_KEY'],
    defaultModel: 'gpt-4o',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    keyEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    defaultModel: 'gemini-2.0-flash',
    notes: 'Uses Gemini\'s OpenAI-compatible endpoint.',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: ['GROQ_API_KEY'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseURL: 'https://api.mistral.ai/v1',
    keyEnv: ['MISTRAL_API_KEY'],
    defaultModel: 'mistral-large-latest',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    keyEnv: ['DEEPSEEK_API_KEY'],
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    keyEnv: ['TOGETHER_API_KEY'],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    baseURL: 'https://api.x.ai/v1',
    keyEnv: ['XAI_API_KEY'],
    defaultModel: 'grok-2-latest',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    keyEnv: ['OPENROUTER_API_KEY'],
    defaultModel: 'openai/gpt-4o-mini',
    headers: { 'HTTP-Referer': 'https://madova.io', 'X-Title': 'MADOVA' },
    notes: 'Routes to hundreds of models — set MADOVA_AI_MODEL to any slug it lists.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    keyEnv: [],
    defaultModel: 'llama3.1',
    keyless: true,
    notes: 'Runs against a local Ollama server. Pick a model that supports tool calling.',
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible endpoint',
    get baseURL() { return setting('ai_base_url') },
    keyEnv: ['MADOVA_AI_API_KEY'],
    defaultModel: 'default',
    notes: 'Anything speaking the OpenAI Chat Completions API — vLLM, LM Studio, a gateway.',
  },
]

export interface ResolvedProvider {
  spec: ProviderSpec
  apiKey: string
  model: string
  baseURL: string
}

/**
 * The credential for one provider. An explicit key set in the admin page wins
 * over anything in the environment, and applies to whichever provider is
 * selected — so an operator sets one field rather than hunting for the right
 * variable name.
 */
function keyFor(spec: ProviderSpec): string {
  const fromAdmin = setting('ai_api_key')
  if (fromAdmin) return fromAdmin
  for (const name of spec.keyEnv) {
    const value = process.env[name]
    if (value && value.trim()) return value.trim()
  }
  return ''
}

/**
 * Work out which provider to use.
 *
 * An explicit MADOVA_AI_PROVIDER wins. Otherwise we take the first provider in
 * the table that has a usable credential, so dropping OPENAI_API_KEY (or
 * GROQ_API_KEY, or any other) into the environment is all the configuration
 * that is needed.
 */
export function resolveProvider(): ResolvedProvider | null {
  const requested = setting('ai_provider').trim().toLowerCase()

  const usable = (spec: ProviderSpec) => {
    if (!spec.baseURL) return false
    return spec.keyless || keyFor(spec).length > 0
  }

  /**
   * Auto-detection only considers providers that presented a credential. A
   * keyless local runtime looks "usable" even when nothing is listening on the
   * port, so picking one by default would fail every message instead of
   * cleanly running the intent router — it has to be asked for by name.
   */
  const autoUsable = (spec: ProviderSpec) => !spec.keyless && usable(spec)

  let spec: ProviderSpec | undefined
  if (requested) {
    spec = PROVIDERS.find((p) => p.id === requested)
    if (!spec) {
      console.warn(
        `[assistant] Unknown AI provider "${requested}". ` +
        `Known providers: ${PROVIDERS.map((p) => p.id).join(', ')}.`,
      )
      return null
    }
    if (!usable(spec)) {
      const wanted = spec.keyEnv.join(' or ') || 'a reachable base URL'
      console.warn(`[assistant] Provider "${spec.id}" selected but ${wanted} is not set.`)
      return null
    }
  } else {
    spec = PROVIDERS.find(autoUsable)
    if (!spec) return null
  }

  return {
    spec,
    apiKey: keyFor(spec) || (spec.keyless ? 'not-needed' : ''),
    model: setting('ai_model') || spec.defaultModel,
    baseURL: setting('ai_base_url') || spec.baseURL,
  }
}

/** Names of every provider, for docs and error messages. */
export const PROVIDER_IDS = PROVIDERS.map((p) => p.id)
