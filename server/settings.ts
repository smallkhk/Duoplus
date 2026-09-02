/**
 * Runtime configuration, editable from the admin page.
 *
 * A value can come from two places: the settings record in the database, or
 * the process environment. The database wins, so an operator who has no shell
 * — a cPanel deployment, say — can configure the whole system from the browser,
 * while an existing `.env` keeps working untouched.
 *
 * Every consumer reads through `setting()` at call time rather than capturing a
 * value at import, so a change in the admin page takes effect on the next
 * request instead of waiting for a restart.
 */
import { db, mutate, nowIso } from './store.js'

export type FieldKind = 'text' | 'secret' | 'number' | 'select'

export interface SettingSpec {
  key: string
  label: string
  kind: FieldKind
  /** Environment variable this falls back to, and the name used in docs. */
  env: string
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  /** Shown on the field when nothing is set anywhere. */
  fallback?: string
}

export interface SettingGroup {
  id: string
  label: string
  lead: string
  icon: string
  fields: SettingSpec[]
}

/* ------------------------------- the schema ------------------------------ */

export const GROUPS: SettingGroup[] = [
  {
    id: 'cloud',
    label: 'Cloud phone supply',
    icon: 'server',
    lead: 'Where devices actually come from. Without a key MADOVA runs its own '
      + 'engine, which behaves identically but is not a real handset.',
    fields: [
      {
        key: 'upstream_key',
        label: 'Provider API key',
        kind: 'secret',
        env: 'MADOVA_UPSTREAM_KEY',
        hint: 'Held on the server and never sent to a browser.',
        placeholder: 'Paste the key from your cloud phone provider',
      },
      {
        key: 'upstream_base',
        label: 'Provider API base URL',
        kind: 'text',
        env: 'MADOVA_UPSTREAM_BASE',
        fallback: 'https://openapi.duoplus.net',
      },
    ],
  },
  {
    id: 'payments_bsc',
    label: 'Payments · BNB Smart Chain',
    icon: 'wallet',
    lead: 'USDT on BEP-20. MADOVA never holds a private key — customers pay '
      + 'your address directly and the server watches the chain for the transfer.',
    fields: [
      {
        key: 'bsc_address',
        label: 'Your receiving address',
        kind: 'text',
        env: 'MADOVA_BSC_ADDRESS',
        hint: 'A BEP-20 address you control. Leave empty to switch BNB Chain off.',
        placeholder: '0x…',
      },
      {
        key: 'bscscan_api_key',
        label: 'Etherscan V2 API key',
        kind: 'secret',
        env: 'MADOVA_BSCSCAN_API_KEY',
        hint: 'Free from etherscan.io. Without one the lookup is heavily rate-limited.',
      },
      {
        key: 'bsc_usdt_contract',
        label: 'USDT contract',
        kind: 'text',
        env: 'MADOVA_BSC_USDT_CONTRACT',
        fallback: '0x55d398326f99059fF775485246999027B3197955',
        hint: 'Only change this if you are settling a different token.',
      },
      {
        key: 'bsc_usdt_decimals',
        label: 'Token decimals',
        kind: 'number',
        env: 'MADOVA_BSC_USDT_DECIMALS',
        fallback: '18',
        hint: 'Binance-Peg USDT uses 18. Only change this alongside the contract above — '
          + 'a wrong value asks customers for the wrong amount.',
      },
      {
        key: 'bsc_confirmations',
        label: 'Confirmations before an order is paid',
        kind: 'number',
        env: 'MADOVA_BSC_CONFIRMATIONS',
        fallback: '12',
      },
    ],
  },
  {
    id: 'payments_tron',
    label: 'Payments · Tron',
    icon: 'wallet',
    lead: 'USDT on TRC-20, settled on transaction age rather than depth — '
      + 'TronGrid does not report confirmations for token transfers.',
    fields: [
      {
        key: 'tron_address',
        label: 'Your receiving address',
        kind: 'text',
        env: 'MADOVA_TRON_ADDRESS',
        hint: 'A TRC-20 address you control. Leave empty to switch Tron off.',
        placeholder: 'T…',
      },
      {
        key: 'trongrid_api_key',
        label: 'TronGrid API key',
        kind: 'secret',
        env: 'MADOVA_TRONGRID_API_KEY',
        hint: 'Free from trongrid.io. Optional, but the public tier is slow.',
      },
      {
        key: 'tron_usdt_contract',
        label: 'USDT contract',
        kind: 'text',
        env: 'MADOVA_TRON_USDT_CONTRACT',
        fallback: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      },
      {
        key: 'tron_usdt_decimals',
        label: 'Token decimals',
        kind: 'number',
        env: 'MADOVA_TRON_USDT_DECIMALS',
        fallback: '6',
        hint: 'USDT on Tron uses 6. Only change this alongside the contract above.',
      },
      {
        key: 'tron_min_age_sec',
        label: 'Seconds before a transfer counts as settled',
        kind: 'number',
        env: 'MADOVA_TRON_MIN_AGE_SEC',
        fallback: '60',
      },
    ],
  },
  {
    id: 'payments_general',
    label: 'Payments · General',
    icon: 'clock',
    lead: 'Applies to every chain.',
    fields: [
      {
        key: 'payment_window_min',
        label: 'Minutes an invoice stays open',
        kind: 'number',
        env: 'MADOVA_PAYMENT_WINDOW_MIN',
        fallback: '40',
        hint: 'After this the invoice expires and the customer starts a new one.',
      },
    ],
  },
  {
    id: 'assistant',
    label: 'Support assistant',
    icon: 'sparkle',
    lead: 'The model behind the chat bubble. Without a key the assistant falls '
      + 'back to a deterministic router that still answers common questions and '
      + 'runs device actions.',
    fields: [
      {
        key: 'ai_provider',
        label: 'Provider',
        kind: 'select',
        env: 'MADOVA_AI_PROVIDER',
        hint: 'Leave on automatic to use whichever key is set.',
        options: [],
      },
      {
        key: 'ai_api_key',
        label: 'API key',
        kind: 'secret',
        env: 'MADOVA_AI_API_KEY',
        hint: 'Used for whichever provider is selected above.',
      },
      {
        key: 'ai_model',
        label: 'Model',
        kind: 'text',
        env: 'MADOVA_AI_MODEL',
        hint: 'Leave empty for the provider’s default.',
        placeholder: 'gpt-4o',
      },
      {
        key: 'ai_base_url',
        label: 'Base URL',
        kind: 'text',
        env: 'MADOVA_AI_BASE_URL',
        hint: 'Only needed for a self-hosted or gateway endpoint.',
      },
    ],
  },
  {
    id: 'site',
    label: 'Site and email',
    icon: 'globe',
    lead: 'How MADOVA addresses your customers.',
    fields: [
      {
        key: 'public_url',
        label: 'Public site URL',
        kind: 'text',
        env: 'MADOVA_PUBLIC_URL',
        hint: 'Used to build password reset and invitation links.',
        placeholder: 'https://your-domain.com',
      },
      {
        key: 'smtp_url',
        label: 'SMTP URL',
        kind: 'secret',
        env: 'MADOVA_SMTP_URL',
        hint: 'smtp://user:pass@host:587. Until this is set, links go to the server log.',
      },
      {
        key: 'mail_from',
        label: 'Send email from',
        kind: 'text',
        env: 'MADOVA_MAIL_FROM',
        placeholder: 'MADOVA <support@your-domain.com>',
      },
    ],
  },
]

const SPECS = new Map(GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f])))

export const isSecret = (key: string) => SPECS.get(key)?.kind === 'secret'

/* ------------------------------- reading -------------------------------- */

/**
 * The effective value of one setting: the stored value if an operator has set
 * one, otherwise the environment, otherwise the documented default.
 */
export function setting(key: string): string {
  const spec = SPECS.get(key)
  const stored = db().settings?.[key]
  if (typeof stored === 'string' && stored.length > 0) return stored
  const fromEnv = spec ? process.env[spec.env] : undefined
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim()
  return spec?.fallback ?? ''
}

/**
 * A numeric setting. An unset value reads as an empty string, and `Number('')`
 * is 0 — which would silently mean "zero decimals" or "zero confirmations", so
 * a blank falls through to the caller's default rather than to zero.
 */
export function settingNumber(key: string, fallback: number): number {
  const raw = setting(key).trim()
  if (raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/** Where a value is coming from, so the admin page can say so. */
export function settingSource(key: string): 'admin' | 'env' | 'default' | 'unset' {
  const spec = SPECS.get(key)
  const stored = db().settings?.[key]
  if (typeof stored === 'string' && stored.length > 0) return 'admin'
  const fromEnv = spec ? process.env[spec.env] : undefined
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return 'env'
  return spec?.fallback ? 'default' : 'unset'
}

/** Enough of a secret to recognise it, never enough to use it. */
export function maskSecret(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}${'•'.repeat(12)}${value.slice(-4)}`
}

/* ------------------------------- writing -------------------------------- */

export class SettingError extends Error {}

/**
 * Validate one value before storing it. A bad address or an unparseable number
 * silently disables a payment rail, so it is caught here rather than at the
 * moment a customer tries to pay.
 */
function validate(key: string, value: string): string {
  const spec = SPECS.get(key)
  if (!spec) throw new SettingError(`Unknown setting "${key}".`)
  const v = value.trim()
  if (v === '') return ''

  if (spec.kind === 'number') {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) throw new SettingError(`${spec.label} must be a positive number.`)
    return String(Math.round(n))
  }

  if (key === 'bsc_address' || key === 'bsc_usdt_contract') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) {
      throw new SettingError(`${spec.label} must be a 0x address of 40 hex characters.`)
    }
  }
  if (key === 'tron_address' || key === 'tron_usdt_contract') {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v)) {
      throw new SettingError(`${spec.label} must be a Tron address starting with T.`)
    }
  }
  if (key === 'public_url' || key === 'upstream_base' || key === 'ai_base_url') {
    try {
      const url = new URL(v)
      if (!/^https?:$/.test(url.protocol)) throw new Error('scheme')
    } catch {
      throw new SettingError(`${spec.label} must be a full http:// or https:// URL.`)
    }
    return v.replace(/\/+$/, '')
  }
  if (key === 'smtp_url' && !/^smtps?:\/\//i.test(v)) {
    throw new SettingError('SMTP URL must start with smtp:// or smtps://.')
  }

  return v.slice(0, 500)
}

/**
 * Apply a patch. A secret whose value is the mask is left alone, so saving the
 * form without retyping a key does not wipe it.
 */
export function updateSettings(patch: Record<string, unknown>): string[] {
  const changed: string[] = []
  const clean: Record<string, string> = {}

  for (const [key, raw] of Object.entries(patch)) {
    const spec = SPECS.get(key)
    if (!spec) continue
    const value = String(raw ?? '')
    if (spec.kind === 'secret' && value.includes('•')) continue
    clean[key] = validate(key, value)
    changed.push(key)
  }

  if (changed.length === 0) return []

  mutate((d) => {
    d.settings ??= {}
    for (const [key, value] of Object.entries(clean)) {
      if (value === '') delete d.settings![key]
      else d.settings![key] = value
    }
    d.settings_updated_at = nowIso()
  })
  return changed
}

/** The whole schema plus current values, safe to hand to the admin page. */
export function describeSettings() {
  return {
    groups: GROUPS.map((group) => ({
      ...group,
      fields: group.fields.map((field) => {
        const value = setting(field.key)
        return {
          ...field,
          /* A secret is described, never disclosed. */
          value: field.kind === 'secret' ? maskSecret(value) : value,
          set: value.length > 0,
          source: settingSource(field.key),
        }
      }),
    })),
    updated_at: db().settings_updated_at ?? null,
  }
}
