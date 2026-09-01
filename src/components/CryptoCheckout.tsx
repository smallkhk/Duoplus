import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Badge, Button, Card, CopyButton, cx, useToast } from './ui'
import { api, ApiError, type Order, type PaymentChain, type PaymentIntent } from '@/lib/api'
import { accountChanged, useAuth } from '@/lib/auth'

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const POLL_MS = 8000

function useCountdown(expiresAt: string | undefined): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!expiresAt) return ''
  const left = Math.max(0, Date.parse(expiresAt) - now)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * On-chain checkout.
 *
 * The exact amount is what identifies the payment, so it is the one value the
 * customer must not round — the UI leads with it and says so.
 */
export function CryptoCheckout({
  order, chains, onSettled, onCancel,
}: {
  order: Order
  chains: PaymentChain[]
  onSettled: (provisioned: string[]) => void
  onCancel: () => void
}) {
  const toast = useToast()
  const { refresh } = useAuth()

  const [payment, setPayment] = useState<PaymentIntent | null>(order.payment ?? null)
  const [chain, setChain] = useState<PaymentChain['id'] | null>(order.payment?.chain ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const settledRef = useRef(false)

  const countdown = useCountdown(payment?.expires_at)

  const start = async (id: PaymentChain['id']) => {
    setBusy(true)
    setError(null)
    try {
      const { payment: intent } = await api.createPayment(order.id, id)
      setChain(id)
      setPayment(intent)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the invoice.')
    } finally {
      setBusy(false)
    }
  }

  const poll = useCallback(async () => {
    if (settledRef.current) return
    try {
      const res = await api.checkPayment(order.id)
      setPayment(res.payment)
      if (res.order.status === 'paid') {
        settledRef.current = true
        toast(res.provisioned.length
          ? `Payment confirmed — ${res.provisioned.length} device(s) provisioned.`
          : 'Payment confirmed.', 'ok')
        accountChanged()
        await refresh()
        onSettled(res.provisioned)
      }
    } catch {
      /* Transient explorer or network trouble; the next tick retries. */
    }
  }, [order.id, toast, refresh, onSettled])

  useEffect(() => {
    if (!payment || payment.status === 'confirmed') return
    const t = setInterval(poll, POLL_MS)
    return () => clearInterval(t)
  }, [payment, poll])

  if (!payment) {
    return (
      <Card className="p-6">
        <h3 className="text-[0.95rem] font-semibold text-ink-50">Pay with crypto</h3>
        <p className="mt-1.5 text-[0.83rem] text-ink-400">
          {money(order.total_cents)} — choose a network. USDT only; send the exact amount shown next.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[0.82rem] text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {chains.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              onClick={() => void start(c.id)}
              className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-950/50 p-4 text-left transition-colors hover:border-brand-500/50 hover:bg-ink-800/50 disabled:opacity-50"
            >
              <span className={cx(
                'grid size-10 shrink-0 place-items-center rounded-lg font-mono text-[0.7rem] font-bold',
                c.id === 'bsc' ? 'bg-[#f0b90b]/15 text-[#f0b90b]' : 'bg-[#eb0029]/15 text-[#ff5c72]',
              )}>
                {c.id === 'bsc' ? 'BNB' : 'TRX'}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.88rem] font-medium text-ink-50">{c.label}</span>
                <span className="block text-[0.75rem] text-ink-400">{c.token} · {c.network}</span>
              </span>
            </button>
          ))}
        </div>

        {chains.length === 0 && (
          <p className="mt-4 text-[0.82rem] text-ink-400">
            No payment network is configured on this server yet.
          </p>
        )}

        <Button variant="ghost" size="sm" className="mt-5" onClick={onCancel}>Cancel order</Button>
      </Card>
    )
  }

  const expired = payment.status === 'expired'
  const confirmed = payment.status === 'confirmed'
  const confirming = payment.status === 'confirming'
  const spec = chains.find((c) => c.id === chain)

  return (
    <Card className={cx('p-6', confirmed && 'border-ok/40')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.95rem] font-semibold text-ink-50">
            {confirmed ? 'Payment confirmed' : `Send ${payment.token} on ${spec?.label ?? payment.chain}`}
          </h3>
          <p className="mt-1 text-[0.8rem] text-ink-400">
            {payment.network} · order {order.id}
          </p>
        </div>
        <Badge tone={confirmed ? 'ok' : confirming ? 'brand' : expired ? 'danger' : 'warn'}>
          {confirmed ? 'confirmed' : confirming ? 'confirming' : expired ? 'expired' : `awaiting · ${countdown}`}
        </Badge>
      </div>

      {confirmed ? (
        <div className="mt-6 flex flex-col items-center py-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-ok/15 text-ok">
            <Icon name="check" className="size-6" strokeWidth={2.4} />
          </span>
          <p className="mt-4 text-[0.9rem] text-ink-100">
            {money(order.total_cents)} received. Your devices are being provisioned.
          </p>
          {payment.explorer_url && (
            <a
              href={payment.explorer_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[0.8rem] text-brand-300 hover:text-brand-200"
            >
              View the transaction
              <Icon name="external" className="size-3.5" />
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr]">
            <div
              className="mx-auto size-[220px] shrink-0 rounded-xl bg-white p-2 [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: payment.qr_svg }}
            />

            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-warn">
                  Send exactly this amount
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-ink-50">
                    {payment.amount}
                  </span>
                  <span className="text-[0.85rem] text-ink-300">{payment.token}</span>
                  <CopyButton text={payment.amount} />
                </div>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-500">
                  The amount is how we identify your payment. Rounding it, or sending twice, means we
                  cannot match it automatically.
                </p>
              </div>

              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-ink-500">
                  To this address
                </p>
                <div className="mt-1.5 flex items-start gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[0.78rem] text-ink-100">
                    {payment.address}
                  </code>
                  <CopyButton text={payment.address} />
                </div>
              </div>

              <div className="rounded-lg bg-ink-950/60 p-3 ring-1 ring-inset ring-ink-800">
                <p className="text-[0.75rem] leading-relaxed text-ink-400">
                  <strong className="text-ink-200">{payment.network} only.</strong> Sending on another
                  network, or sending a different token, loses the funds — we cannot recover them.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink-800 pt-5">
            {confirming ? (
              <span className="flex items-center gap-2 text-[0.82rem] text-brand-300">
                <span className="size-3 animate-spin rounded-full border-2 border-ink-700 border-t-brand-400" />
                Seen on-chain — waiting for
                {spec?.confirmations ? ` ${spec.confirmations} confirmations` : ' settlement'}
                {payment.confirmations !== undefined && ` (${payment.confirmations})`}
              </span>
            ) : expired ? (
              <span className="text-[0.82rem] text-danger">
                This invoice expired. Cancel and order again to get a fresh amount.
              </span>
            ) : (
              <span className="flex items-center gap-2 text-[0.82rem] text-ink-400">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-warn" />
                Watching the chain — this page updates itself.
              </span>
            )}

            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void poll()}>Check now</Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            </span>
          </div>

          {payment.note && (
            <p className="mt-3 text-[0.72rem] text-ink-500">Last check: {payment.note}</p>
          )}
        </>
      )}
    </Card>
  )
}
