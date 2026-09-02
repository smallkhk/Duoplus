/**
 * Site administration — the operator's own controls, distinct from a customer's
 * account settings.
 *
 * Who counts as the administrator: the account named by MADOVA_ADMIN_EMAIL if
 * one is set, otherwise the first account ever created on this deployment.
 * That rule needs no configuration to bootstrap, which matters because the
 * point of this page is to configure a deployment that has no shell.
 */
import { db, type User } from './store.js'
import { DEMO_EMAIL } from './seed.js'
import { chainEnabled, merchantAddress, paymentWarnings, type ChainId } from './crypto.js'
import { upstreamBase, upstreamConfigured, upstreamKey } from './fleet.js'
import { PROVIDERS, resolveProvider } from './providers.js'
import { setting } from './settings.js'

/**
 * The account that administers this deployment, if there is one yet.
 *
 * MADOVA_ADMIN_EMAIL settles it outright. Failing that it is the oldest real
 * account: the seeded demo login is skipped, because on a fresh install it is
 * created before anyone signs up and would otherwise inherit the site.
 */
export function adminUser(): User | undefined {
  const named = (process.env.MADOVA_ADMIN_EMAIL ?? '').trim().toLowerCase()
  const users = db().users
  if (named) return users.find((u) => u.email.toLowerCase() === named)
  return [...users]
    .filter((u) => !u.parent_id && u.email.toLowerCase() !== DEMO_EMAIL)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
}

export function isAdmin(user: User | undefined): boolean {
  if (!user) return false
  const admin = adminUser()
  return Boolean(admin && admin.id === user.id)
}

/* -------------------------------- health -------------------------------- */

export type CheckState = 'ok' | 'warn' | 'off' | 'error'

export interface Check {
  id: string
  label: string
  state: CheckState
  detail: string
}

/**
 * What is and is not configured, in the operator's terms. Every line answers
 * "can a customer do this right now?" rather than naming a variable.
 */
export function health(): Check[] {
  const checks: Check[] = []

  checks.push(upstreamConfigured()
    ? { id: 'cloud', label: 'Cloud phone supply', state: 'ok', detail: `Forwarding to ${upstreamBase()}` }
    : {
      id: 'cloud',
      label: 'Cloud phone supply',
      state: 'warn',
      detail: 'No provider key set — devices are served by MADOVA’s own engine, '
        + 'which behaves identically but is not a real handset.',
    })

  for (const chain of ['bsc', 'tron'] as ChainId[]) {
    const label = chain === 'bsc' ? 'Payments · BNB Smart Chain' : 'Payments · Tron'
    const address = merchantAddress(chain)
    if (!address) {
      checks.push({ id: chain, label, state: 'off', detail: 'No receiving address — this network is switched off.' })
    } else if (!chainEnabled(chain)) {
      checks.push({ id: chain, label, state: 'error', detail: 'The receiving address is not valid, so this network is switched off.' })
    } else {
      const explorerKey = setting(chain === 'bsc' ? 'bscscan_api_key' : 'trongrid_api_key')
      checks.push({
        id: chain,
        label,
        state: explorerKey ? 'ok' : 'warn',
        detail: explorerKey
          ? `Accepting payments to ${address.slice(0, 10)}…${address.slice(-6)}`
          : `Accepting payments, but with no explorer API key the chain lookup is `
            + `rate-limited and a payment may take longer to confirm.`,
      })
    }
  }

  const provider = resolveProvider()
  checks.push(provider
    ? { id: 'assistant', label: 'Support assistant', state: 'ok', detail: `${provider.spec.label} · ${provider.model}` }
    : {
      id: 'assistant',
      label: 'Support assistant',
      state: 'warn',
      detail: 'No model key set — the assistant answers from the knowledge base '
        + 'and can still run device actions, but cannot hold an open conversation.',
    })

  checks.push(setting('smtp_url')
    ? { id: 'mail', label: 'Outbound email', state: 'ok', detail: 'Reset and invitation links are emailed.' }
    : {
      id: 'mail',
      label: 'Outbound email',
      state: 'warn',
      detail: 'No SMTP URL — password reset and invitation links are written to '
        + 'the server log instead of being sent.',
    })

  checks.push(setting('public_url')
    ? { id: 'url', label: 'Public site URL', state: 'ok', detail: setting('public_url') }
    : {
      id: 'url',
      label: 'Public site URL',
      state: 'warn',
      detail: 'Not set, so emailed links will be relative and may not open.',
    })

  for (const warning of paymentWarnings()) {
    checks.push({ id: 'payment-warning', label: 'Payment configuration', state: 'error', detail: warning })
  }

  return checks
}

/** Provider options for the admin page's select. */
export function providerOptions() {
  return [
    { value: '', label: 'Automatic — use whichever key is set' },
    ...PROVIDERS.map((p) => ({ value: p.id, label: p.label })),
  ]
}

/* ------------------------------ live tests ------------------------------ */

export interface TestResult {
  ok: boolean
  message: string
}

/** Call the cloud phone provider with the configured key and report what came back. */
export async function testUpstream(): Promise<TestResult> {
  if (!upstreamConfigured()) {
    return { ok: false, message: 'No provider key is set, so there is nothing to test.' }
  }
  try {
    const res = await fetch(`${upstreamBase()}/api/v1/cloudPhone/groupList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'DuoPlus-API-Key': upstreamKey() },
      body: JSON.stringify({ page: 1 }),
      signal: AbortSignal.timeout(15_000),
    })
    const text = await res.text()
    let body: { code?: number; message?: string }
    try {
      body = JSON.parse(text)
    } catch {
      return { ok: false, message: `The provider returned a non-JSON response (HTTP ${res.status}).` }
    }
    if (body.code === 200) return { ok: true, message: 'The provider accepted the key.' }
    return { ok: false, message: body.message || `The provider rejected the call (code ${body.code}).` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not reach the provider.' }
  }
}

/** Ask the model provider for one token, which proves the key and the model. */
export async function testAssistant(): Promise<TestResult> {
  const provider = resolveProvider()
  if (!provider) {
    return { ok: false, message: 'No model provider is configured, so there is nothing to test.' }
  }
  try {
    const res = await fetch(`${provider.baseURL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        ...provider.spec.headers,
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.ok) return { ok: true, message: `${provider.spec.label} answered as ${provider.model}.` }
    const text = await res.text()
    let detail = text.slice(0, 200)
    try {
      detail = JSON.parse(text)?.error?.message ?? detail
    } catch { /* keep the raw text */ }
    return { ok: false, message: `${provider.spec.label} refused the call (HTTP ${res.status}): ${detail}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not reach the model provider.' }
  }
}

/** Read the chain for the configured address, proving the explorer and the key. */
export async function testChain(chain: ChainId): Promise<TestResult> {
  const address = merchantAddress(chain)
  if (!address) return { ok: false, message: 'No receiving address is set for this network.' }
  if (!chainEnabled(chain)) return { ok: false, message: 'The receiving address is not a valid address for this network.' }

  try {
    if (chain === 'bsc') {
      const base = process.env.MADOVA_BSCSCAN_BASE ?? 'https://api.etherscan.io/v2/api?chainid=56'
      const key = setting('bscscan_api_key')
      const url = `${base}${base.includes('?') ? '&' : '?'}module=account&action=tokentx`
        + `&address=${address}&page=1&offset=1&sort=desc${key ? `&apikey=${key}` : ''}`
      const body = await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).json() as {
        status?: string; message?: string; result?: unknown
      }
      /* "No transactions found" is status 0 but a perfectly healthy answer. */
      if (body.status === '1' || /no transactions found/i.test(body.message ?? '')) {
        return { ok: true, message: 'The explorer answered for your address.' }
      }
      return { ok: false, message: body.message || String(body.result).slice(0, 160) || 'The explorer refused the call.' }
    }

    const base = process.env.MADOVA_TRONGRID_BASE ?? 'https://api.trongrid.io'
    const key = setting('trongrid_api_key')
    const res = await fetch(
      `${base}/v1/accounts/${address}/transactions/trc20?limit=1&only_confirmed=true`,
      { headers: key ? { 'TRON-PRO-API-KEY': key } : {}, signal: AbortSignal.timeout(15_000) },
    )
    const body = await res.json() as { success?: boolean; error?: string }
    if (body.success) return { ok: true, message: 'TronGrid answered for your address.' }
    return { ok: false, message: body.error || `TronGrid refused the call (HTTP ${res.status}).` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not reach the explorer.' }
  }
}
