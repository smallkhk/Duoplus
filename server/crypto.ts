/**
 * Crypto checkout for BSC (BEP-20) and Tron (TRC-20).
 *
 * Design choice that matters: **this server never holds a private key.** You
 * give it your own receiving address per chain; it only watches the chain and
 * confirms what arrived. A compromise of this box loses data, not funds.
 *
 * Payments are matched by an exact, unique amount. Each order gets its own
 * micro-offset in the fourth decimal, reserved while the intent is open, so no
 * two open invoices ever expect the same number. That avoids per-order deposit
 * addresses, which would require key management and sweeping.
 *
 * Only USDT is auto-confirmed. It is a stablecoin, so an invoice in dollars is
 * an invoice in tokens and no price oracle is involved — quoting BNB or TRX
 * would need a live rate and a slippage window, which is a different feature.
 */
import QRCode from 'qrcode'
import { db, mutate, nowIso, type Order } from './store.js'

export type ChainId = 'bsc' | 'tron'

export interface ChainSpec {
  id: ChainId
  label: string
  network: string
  token: string
  /** Token contract. Verify against your own source before taking money. */
  contract: string
  decimals: number
  addressEnv: string
  explorerTx: (hash: string) => string
  /**
   * Wallet deep-link so a phone can scan and prefill. `units` is the amount in
   * the token's smallest unit — EIP-681 wants an integer there, never a decimal.
   */
  paymentUri: (address: string, units: string, contract: string) => string
}

export const CHAINS: Record<ChainId, ChainSpec> = {
  bsc: {
    id: 'bsc',
    label: 'BNB Smart Chain',
    network: 'BEP-20',
    token: 'USDT',
    contract: process.env.MADOVA_BSC_USDT_CONTRACT ?? '0x55d398326f99059fF775485246999027B3197955',
    /* Binance-Peg USDT is 18 decimals, unlike USDT on most other chains. */
    decimals: Number(process.env.MADOVA_BSC_USDT_DECIMALS ?? 18),
    addressEnv: 'MADOVA_BSC_ADDRESS',
    explorerTx: (h) => `https://bscscan.com/tx/${h}`,
    /* EIP-681: uint256 is the raw token amount. A decimal here makes wallets
       send dust (or reject the link), so the base-unit integer is passed. */
    paymentUri: (address, units, contract) =>
      `ethereum:${contract}@56/transfer?address=${address}&uint256=${units}`,
  },
  tron: {
    id: 'tron',
    label: 'Tron',
    network: 'TRC-20',
    token: 'USDT',
    contract: process.env.MADOVA_TRON_USDT_CONTRACT ?? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    decimals: Number(process.env.MADOVA_TRON_USDT_DECIMALS ?? 6),
    addressEnv: 'MADOVA_TRON_ADDRESS',
    explorerTx: (h) => `https://tronscan.org/#/transaction/${h}`,
    /* Tron has no deep-link standard that reliably carries a TRC-20 contract:
       wallets that ignore a `token` parameter read `amount` as TRX and would
       send the wrong asset. The bare address is what every Tron wallet scans
       correctly; the checkout screen carries the exact USDT amount. */
    paymentUri: (address) => address,
  },
}

export const merchantAddress = (chain: ChainId): string =>
  (process.env[CHAINS[chain].addressEnv] ?? '').trim()

/**
 * Shape of a valid receiving address per chain.
 *
 * This exists because a misconfigured address is silent and expensive: the
 * checkout would show customers somewhere their money cannot be recovered from.
 * A placeholder left in .env fails this check, so the network simply stays off.
 */
const ADDRESS_PATTERN: Record<ChainId, RegExp> = {
  bsc: /^0x[0-9a-fA-F]{40}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
}

export function addressProblem(chain: ChainId): string | null {
  const address = merchantAddress(chain)
  if (!address) return null // not configured at all — that is fine, the chain is just off
  if (!ADDRESS_PATTERN[chain].test(address)) {
    return `${CHAINS[chain].addressEnv} is not a valid ${CHAINS[chain].label} address `
      + `("${address.slice(0, 24)}${address.length > 24 ? '…' : ''}"). `
      + `${CHAINS[chain].label} payments are disabled until it is corrected.`
  }
  return null
}

export const chainEnabled = (chain: ChainId): boolean => {
  const address = merchantAddress(chain)
  return address.length > 0 && ADDRESS_PATTERN[chain].test(address)
}

export const enabledChains = (): ChainId[] =>
  (Object.keys(CHAINS) as ChainId[]).filter(chainEnabled)

/** Startup diagnostics, so a bad address is loud rather than silent. */
export function paymentWarnings(): string[] {
  return (Object.keys(CHAINS) as ChainId[])
    .map(addressProblem)
    .filter((w): w is string => w !== null)
}

/** How long an invoice stays valid, and how settled a transfer must be. */
const WINDOW_MINUTES = Number(process.env.MADOVA_PAYMENT_WINDOW_MIN ?? 40)
const BSC_CONFIRMATIONS = Number(process.env.MADOVA_BSC_CONFIRMATIONS ?? 12)
const TRON_MIN_AGE_SEC = Number(process.env.MADOVA_TRON_MIN_AGE_SEC ?? 60)

export interface PaymentIntent {
  chain: ChainId
  network: string
  token: string
  address: string
  /** Exact amount the customer must send, as a decimal string. */
  amount: string
  /** Same amount in the token's smallest unit, for on-chain comparison. */
  amount_units: string
  contract: string
  created_at: string
  expires_at: string
  status: 'awaiting' | 'confirming' | 'confirmed' | 'expired'
  tx_hash?: string
  confirmations?: number
  explorer_url?: string
  payment_uri: string
  qr_svg: string
  /** Set when the chain reports something that does not settle the invoice. */
  note?: string
}

/* --------------------------- decimal arithmetic -------------------------- */

/** Convert a plain decimal string to the token's smallest unit, exactly. */
export function toUnits(amount: string, decimals: number): bigint {
  const [whole, frac = ''] = amount.split('.')
  if (frac.length > decimals) throw new Error(`More precision than ${decimals} decimals`)
  return BigInt(whole + frac.padEnd(decimals, '0'))
}

/** Dollars (in cents) to a 4-decimal token amount carrying a unique suffix. */
function formatAmount(cents: number, suffix: number): string {
  const dollars = Math.floor(cents / 100)
  const centsPart = cents % 100
  /* Two decimals of price, then two more that make this invoice unique. */
  return `${dollars}.${String(centsPart).padStart(2, '0')}${String(suffix).padStart(2, '0')}`
}

/**
 * Pick an amount no other open invoice on this chain is waiting for.
 *
 * Without this, two customers owing the same price would be indistinguishable
 * on-chain and one could claim the other's payment.
 */
function allocateAmount(chain: ChainId, cents: number): string {
  const taken = new Set(
    db().orders
      .filter((o) => o.status === 'pending' && o.payment?.chain === chain)
      .map((o) => o.payment!.amount),
  )
  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = formatAmount(cents, suffix)
    if (!taken.has(candidate)) return candidate
  }
  /* 100 open invoices at one price is implausible; fail loudly rather than collide. */
  throw new Error('No unique payment amount available for this price — try again shortly')
}

/* ------------------------------ intent setup ----------------------------- */

export async function createIntent(order: Order, chain: ChainId): Promise<PaymentIntent> {
  const spec = CHAINS[chain]
  const address = merchantAddress(chain)
  if (!address) throw new Error(`${spec.label} payments are not configured on this server`)

  const amount = allocateAmount(chain, order.total_cents)
  const units = toUnits(amount, spec.decimals).toString()
  const now = Date.now()
  const uri = spec.paymentUri(address, units, spec.contract)

  return {
    chain,
    network: spec.network,
    token: spec.token,
    address,
    amount,
    amount_units: units,
    contract: spec.contract,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + WINDOW_MINUTES * 60_000).toISOString(),
    status: 'awaiting',
    payment_uri: uri,
    qr_svg: await QRCode.toString(uri, { type: 'svg', margin: 1, width: 220 }),
  }
}

/* ---------------------------- chain observers ---------------------------- */

interface Transfer {
  hash: string
  to: string
  units: string
  timestampMs: number
  confirmations: number | null
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Explorer returned ${res.status}`)
  return res.json()
}

/** Recent BEP-20 transfers into the merchant address. */
async function bscTransfers(address: string): Promise<Transfer[]> {
  const base = process.env.MADOVA_BSCSCAN_BASE ?? 'https://api.etherscan.io/v2/api?chainid=56'
  const key = process.env.MADOVA_BSCSCAN_API_KEY ?? ''
  const url = `${base}${base.includes('?') ? '&' : '?'}module=account&action=tokentx`
    + `&contractaddress=${CHAINS.bsc.contract}&address=${address}`
    + `&page=1&offset=50&sort=desc${key ? `&apikey=${key}` : ''}`

  const body = await fetchJson(url)
  if (body.status !== '1' || !Array.isArray(body.result)) return []
  return body.result.map((t: any): Transfer => ({
    hash: String(t.hash),
    to: String(t.to ?? '').toLowerCase(),
    units: String(t.value),
    timestampMs: Number(t.timeStamp) * 1000,
    confirmations: Number(t.confirmations),
  }))
}

/** Recent TRC-20 transfers into the merchant address. */
async function tronTransfers(address: string): Promise<Transfer[]> {
  const base = process.env.MADOVA_TRONGRID_BASE ?? 'https://api.trongrid.io'
  const key = process.env.MADOVA_TRONGRID_API_KEY ?? ''
  const url = `${base}/v1/accounts/${address}/transactions/trc20`
    + `?limit=50&only_confirmed=true&contract_address=${CHAINS.tron.contract}`

  const body = await fetchJson(url, key ? { 'TRON-PRO-API-KEY': key } : {})
  if (!Array.isArray(body.data)) return []
  return body.data.map((t: any): Transfer => ({
    hash: String(t.transaction_id),
    to: String(t.to ?? ''),
    units: String(t.value),
    timestampMs: Number(t.block_timestamp),
    /* TronGrid does not report depth here; settle on age instead. */
    confirmations: null,
  }))
}

/** Transfers already credited to another order, so one payment settles one invoice. */
function consumedHashes(exceptOrderId: string): Set<string> {
  return new Set(
    db().orders
      .filter((o) => o.id !== exceptOrderId && o.payment?.tx_hash)
      .map((o) => o.payment!.tx_hash!),
  )
}

export type CheckResult =
  | { state: 'awaiting' }
  | { state: 'confirming'; hash: string; confirmations: number; explorer: string }
  | { state: 'confirmed'; hash: string; explorer: string }
  | { state: 'expired' }
  | { state: 'error'; message: string }

/**
 * Ask the chain whether this invoice has been paid.
 *
 * Matches on recipient, exact amount, and a timestamp inside the invoice
 * window, and refuses a transaction already credited elsewhere.
 */
export async function checkIntent(order: Order): Promise<CheckResult> {
  const intent = order.payment
  if (!intent) return { state: 'error', message: 'This order has no payment intent' }
  if (intent.status === 'confirmed') {
    return { state: 'confirmed', hash: intent.tx_hash!, explorer: intent.explorer_url! }
  }

  const spec = CHAINS[intent.chain]
  const expired = Date.now() > Date.parse(intent.expires_at)

  let transfers: Transfer[]
  try {
    transfers = intent.chain === 'bsc'
      ? await bscTransfers(intent.address)
      : await tronTransfers(intent.address)
  } catch (err) {
    /* A flaky explorer must never expire a paid invoice. */
    return { state: 'error', message: err instanceof Error ? err.message : 'Explorer unreachable' }
  }

  const used = consumedHashes(order.id)
  const windowStart = Date.parse(intent.created_at) - 5 * 60_000
  const wantsTo = intent.address.toLowerCase()

  const match = transfers.find((t) =>
    !used.has(t.hash)
    && t.to.toLowerCase() === wantsTo
    && t.units === intent.amount_units
    && t.timestampMs >= windowStart)

  if (!match) return expired ? { state: 'expired' } : { state: 'awaiting' }

  const explorer = spec.explorerTx(match.hash)
  const settled = intent.chain === 'bsc'
    ? (match.confirmations ?? 0) >= BSC_CONFIRMATIONS
    : Date.now() - match.timestampMs >= TRON_MIN_AGE_SEC * 1000

  if (!settled) {
    const depth = intent.chain === 'bsc'
      ? (match.confirmations ?? 0)
      : Math.floor((Date.now() - match.timestampMs) / 1000)
    return { state: 'confirming', hash: match.hash, confirmations: depth, explorer }
  }

  return { state: 'confirmed', hash: match.hash, explorer }
}

/** Persist whatever the chain just told us onto the order. */
export function applyCheck(orderId: string, result: CheckResult) {
  mutate((d) => {
    const order = d.orders.find((o) => o.id === orderId)
    if (!order?.payment) return
    const p = order.payment
    if (result.state === 'confirming') {
      p.status = 'confirming'
      p.tx_hash = result.hash
      p.confirmations = result.confirmations
      p.explorer_url = result.explorer
    } else if (result.state === 'confirmed') {
      p.status = 'confirmed'
      p.tx_hash = result.hash
      p.explorer_url = result.explorer
    } else if (result.state === 'expired') {
      p.status = 'expired'
    } else if (result.state === 'error') {
      p.note = result.message
    }
    order.updated_at = nowIso()
  })
}

export const paymentConfig = () => ({
  enabled: enabledChains(),
  window_minutes: WINDOW_MINUTES,
  chains: enabledChains().map((id) => ({
    id,
    label: CHAINS[id].label,
    network: CHAINS[id].network,
    token: CHAINS[id].token,
    confirmations: id === 'bsc' ? BSC_CONFIRMATIONS : undefined,
    settle_after_seconds: id === 'tron' ? TRON_MIN_AGE_SEC : undefined,
  })),
})
