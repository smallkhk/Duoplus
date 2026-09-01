/**
 * MADOVA API client.
 *
 * Speaks the upstream cloud-phone OpenAPI: `POST {base}/api/v1/...`, JSON body,
 * `DuoPlus-API-Key` header, `{ code, data, message }` envelope.
 *
 * With no key configured it routes to the in-browser mock so the console is
 * fully explorable. Paste a key in Console → Automation → API and flip to live
 * mode and the exact same calls go to the real backend. In `npm run dev` the
 * requests travel through the `/upstream` Vite proxy to sidestep CORS; a
 * deployment should terminate that proxy server-side so the key never ships to
 * the browser.
 */
import { API_KEY_HEADER } from './endpoints'
import { mockRequest } from './mock'
import type { ApiEnvelope } from './types'

export type Lang = 'en' | 'zh' | 'zh-TW' | 'ru'

export interface ApiSettings {
  apiKey: string
  live: boolean
  lang: Lang
}

const SETTINGS_KEY = 'madova.api.settings'

const DEFAULT_SETTINGS: ApiSettings = { apiKey: '', live: false, lang: 'en' }

export function getSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(next: Partial<ApiSettings>): ApiSettings {
  const merged = { ...getSettings(), ...next }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged))
  } catch {
    /* private browsing — settings simply don't persist */
  }
  window.dispatchEvent(new CustomEvent('madova:settings'))
  return merged
}

export interface RequestLogEntry {
  id: number
  at: string
  path: string
  ms: number
  code: number
  live: boolean
  ok: boolean
}

const log: RequestLogEntry[] = []
let logSeq = 0

export function getRequestLog(): RequestLogEntry[] {
  return log
}

function record(entry: Omit<RequestLogEntry, 'id'>) {
  log.unshift({ id: ++logSeq, ...entry })
  if (log.length > 40) log.pop()
  window.dispatchEvent(new CustomEvent('madova:request'))
}

/**
 * Upstream enforces 1 QPS per endpoint, so calls are serialised through a
 * single promise chain with a minimum spacing between them.
 */
const MIN_SPACING_MS = 120
let chain: Promise<unknown> = Promise.resolve()

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task)
  chain = next.then(
    () => new Promise((r) => setTimeout(r, MIN_SPACING_MS)),
    () => new Promise((r) => setTimeout(r, MIN_SPACING_MS)),
  )
  return next
}

export class ApiError extends Error {
  constructor(public code: number, message: string, public path: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Issue a call and return the raw envelope. */
export async function call<T = unknown>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<ApiEnvelope<T>> {
  return serialise(async () => {
    const settings = getSettings()
    const useLive = settings.live && settings.apiKey.trim().length > 0
    const started = performance.now()

    let envelope: ApiEnvelope<T>
    try {
      if (useLive) {
        const res = await fetch(`/upstream${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Lang: settings.lang,
            [API_KEY_HEADER]: settings.apiKey.trim(),
          },
          body: JSON.stringify(body),
        })
        envelope = (await res.json()) as ApiEnvelope<T>
      } else {
        envelope = (await mockRequest(path, body)) as ApiEnvelope<T>
      }
    } catch (err) {
      const ms = Math.round(performance.now() - started)
      record({ at: new Date().toLocaleTimeString(), path, ms, code: 0, live: useLive, ok: false })
      throw new ApiError(0, err instanceof Error ? err.message : 'Network error', path)
    }

    record({
      at: new Date().toLocaleTimeString(),
      path,
      ms: Math.round(performance.now() - started),
      code: envelope.code,
      live: useLive,
      ok: envelope.code === 200,
    })
    return envelope
  })
}

/** Issue a call and unwrap `data`, throwing `ApiError` on a non-200 code. */
export async function callData<T = unknown>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const envelope = await call<T>(path, body)
  if (envelope.code !== 200) throw new ApiError(envelope.code, envelope.message || 'Request failed', path)
  return envelope.data
}
