import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import { PhoneFrame } from '@/components/PhoneFrame'
import {
  Badge, Button, Card, Field, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { CryptoCheckout } from '@/components/CryptoCheckout'
import { api, ApiError, type Order, type Quote } from '@/lib/api'
import { accountChanged, useAuth } from '@/lib/auth'
import { REGIONS } from '@/data/demo'

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const QUANTITIES = [1, 5, 10, 25, 50, 100, 250, 500]
const MINUTE_PACKS = [0, 5_000, 20_000, 100_000, 500_000]

export function Store() {
  const toast = useToast()
  const { refresh, meta } = useAuth()
  const chains = meta?.payments.chains ?? []
  const cryptoAvailable = chains.length > 0

  const [quantity, setQuantity] = useState(5)
  const [region, setRegion] = useState(REGIONS[0].region)
  const [durationDays, setDurationDays] = useState(30)
  const [minutes, setMinutes] = useState(0)
  const [os, setOs] = useState('Android 13')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [busy, setBusy] = useState(false)
  /* The order currently at the payment step. */
  const [paying, setPaying] = useState<Order | null>(null)

  const loadOrders = useCallback(() => {
    api.orders().then((d) => setOrders(d.orders)).catch(() => setOrders([]))
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  /* Re-price on every change — the volume tier moves with the quantity. */
  useEffect(() => {
    let cancelled = false
    api.quote({ quantity, duration_days: durationDays, region, minutes: minutes || undefined })
      .then((q) => { if (!cancelled) setQuote(q) })
      .catch(() => { if (!cancelled) setQuote(null) })
    return () => { cancelled = true }
  }, [quantity, durationDays, region, minutes])

  const pending = useMemo(() => (orders ?? []).filter((o) => o.status === 'pending'), [orders])
  const history = useMemo(() => (orders ?? []).filter((o) => o.status !== 'pending'), [orders])

  const checkout = async () => {
    setBusy(true)
    try {
      const { order } = await api.createOrder({
        quantity, duration_days: durationDays, region, minutes: minutes || undefined, group_name: 'Unassigned',
      })
      loadOrders()
      if (cryptoAvailable) {
        setPaying(order)
      } else {
        /* No payment network configured — fall back to account credit. */
        const paid = await api.payOrder(order.id)
        toast(`Provisioned ${paid.provisioned.length} device${paid.provisioned.length === 1 ? '' : 's'}.`, 'ok')
        loadOrders()
        accountChanged()
        await refresh()
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Checkout failed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const approve = async (order: Order) => {
    if (cryptoAvailable) { setPaying(order); return }
    setBusy(true)
    try {
      const paid = await api.payOrder(order.id)
      toast(paid.provisioned.length
        ? `Order paid — ${paid.provisioned.length} device(s) provisioned.`
        : 'Order paid.', 'ok')
      loadOrders()
      accountChanged()
      await refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not complete the order.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (order: Order) => {
    try {
      await api.cancelOrder(order.id)
      toast('Order cancelled.', 'ok')
      loadOrders()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not cancel the order.', 'danger')
    }
  }

  return (
    <>
      <PageHeader
        title="Buy devices"
        lead="Pick a region, a quantity and a term. Devices are provisioned onto your account as soon as the order is paid."
        actions={
          <Link
            to="/pricing"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-medium text-ink-100 ring-1 ring-inset ring-ink-700 transition-colors hover:bg-ink-800/70"
          >
            <Icon name="chart" className="size-4" />
            Pricing details
          </Link>
        }
      />

      {paying && (
        <div className="mb-4">
          <CryptoCheckout
            order={paying}
            chains={chains}
            onSettled={() => {
              setPaying(null)
              loadOrders()
            }}
            onCancel={() => {
              void api.cancelOrder(paying.id).catch(() => {})
              setPaying(null)
              loadOrders()
            }}
          />
        </div>
      )}

      {!paying && pending.length > 0 && (
        <Card className="mb-4 border-brand-500/40 bg-brand-500/[0.04] p-5">
          <div className="flex items-center gap-2.5">
            <Icon name="alert" className="size-4 shrink-0 text-brand-300" />
            <h2 className="text-[0.92rem] font-semibold text-ink-50">
              {pending.length} order{pending.length === 1 ? '' : 's'} awaiting your approval
            </h2>
          </div>
          <ul className="mt-4 space-y-2.5">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-950/60 p-3.5 ring-1 ring-inset ring-ink-800">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.85rem] text-ink-100">{o.lines.map((l) => l.description).join(' · ')}</span>
                  <span className="mt-0.5 block font-mono text-[0.7rem] text-ink-500">
                    {o.id} · raised {o.created_by === 'assistant' ? 'by the assistant' : 'by you'} · {o.created_at}
                  </span>
                </span>
                <span className="font-mono text-[1rem] font-semibold text-ink-50">{money(o.total_cents)}</span>
                <span className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => void approve(o)}>
                    {cryptoAvailable ? 'Pay' : 'Approve & pay'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void cancel(o)}>Cancel</Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem] [&>*]:min-w-0">
        <Card className="p-7">
          <h2 className="text-[0.95rem] font-semibold text-ink-50">Configure your order</h2>

          <div className="mt-6 space-y-6">
            <div>
              <p className="mb-2.5 text-[0.78rem] font-medium text-ink-300">How many devices?</p>
              <div className="flex flex-wrap gap-2">
                {QUANTITIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuantity(q)}
                    className={cx(
                      'rounded-lg px-3.5 py-2 font-mono text-[0.82rem] transition-colors',
                      quantity === q
                        ? 'bg-brand-500 text-white'
                        : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50',
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Region" hint="Sets the device's SIM, locale and timezone defaults.">
                <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {REGIONS.map((r) => (
                    <option key={r.region} value={r.region}>{r.flag} {r.area}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Android version">
                <Select value={os} onChange={(e) => setOs(e.target.value)}>
                  {['Android 11', 'Android 12', 'Android 13', 'Android 14'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div>
              <p className="mb-2.5 text-[0.78rem] font-medium text-ink-300">Subscription term</p>
              <div className="flex flex-wrap gap-2">
                {[7, 30, 90, 180, 360].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDurationDays(d)}
                    className={cx(
                      'rounded-lg px-3.5 py-2 text-[0.82rem] transition-colors',
                      durationDays === d
                        ? 'bg-brand-500 text-white'
                        : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50',
                    )}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>

            <Field label="Add prepaid startup minutes" hint="Optional. Minutes never expire and are only spent while a device is powered on.">
              <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {MINUTE_PACKS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? 'No minutes — I have a balance' : `${m.toLocaleString('en-US')} minutes`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-400">Order total</p>
            {quote === null ? (
              <Skeleton className="mt-4 h-10 w-32" />
            ) : (
              <>
                <p className="mt-3 font-mono text-[2.25rem] font-semibold leading-none tracking-tight text-ink-50">
                  {money(quote.total_cents)}
                </p>
                {quote.tier_off > 0 && (
                  <p className="mt-3">
                    <Badge tone="ok">{Math.round(quote.tier_off * 100)}% volume discount · saves {money(quote.discount_cents)}</Badge>
                  </p>
                )}
                <ul className="mt-5 space-y-3 border-t border-ink-800 pt-5">
                  {quote.lines.map((l) => (
                    <li key={l.description} className="flex items-start justify-between gap-3">
                      <span className="text-[0.8rem] leading-snug text-ink-300">{l.description}</span>
                      <span className="shrink-0 font-mono text-[0.82rem] text-ink-50">{money(l.total_cents)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <Button
              size="lg"
              className="mt-6 w-full"
              disabled={busy || quote === null}
              onClick={() => void checkout()}
              iconRight={busy ? undefined : 'arrowRight'}
            >
              {busy ? 'Provisioning…' : `Buy ${quantity} device${quantity === 1 ? '' : 's'}`}
            </Button>
            <p className="mt-3 text-[0.72rem] leading-relaxed text-ink-500">
              {cryptoAvailable
                ? <>Paid in USDT on {chains.map((c) => c.label).join(' or ')}. Devices are provisioned
                   the moment the payment settles on-chain.</>
                : <>No payment network is configured, so this settles against account credit. Set a
                   receiving address on the server before taking real money.</>}
            </p>
          </Card>

          <Card className="flex items-center gap-4 p-6">
            <PhoneFrame className="w-16 shrink-0" tone="off" />
            <div>
              <p className="text-[0.85rem] font-medium text-ink-100">Ready in about a minute</p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-400">
                New devices arrive Powered off with a coherent identity for the region you picked.
                Power one on from the fleet table, or just ask the assistant.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-ink-800 px-6 py-4">
          <h2 className="text-[0.95rem] font-semibold text-ink-50">Order history</h2>
        </div>
        {orders === null ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="px-6 py-10 text-center text-[0.83rem] text-ink-500">No completed orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[0.82rem]">
              <thead>
                <tr className="border-b border-ink-800 text-[0.7rem] uppercase tracking-wider text-ink-500">
                  <th className="px-6 py-3 font-medium">Order</th>
                  <th className="px-6 py-3 font-medium">Items</th>
                  <th className="px-6 py-3 font-medium">Placed</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {history.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-ink-800/40">
                    <td className="px-6 py-3.5"><code className="font-mono text-[0.74rem] text-ink-300">{o.id}</code></td>
                    <td className="px-6 py-3.5 text-ink-200">{o.lines.map((l) => l.description).join(' · ')}</td>
                    <td className="px-6 py-3.5 font-mono text-[0.74rem] text-ink-500">{o.created_at}</td>
                    <td className="px-6 py-3.5 font-mono text-ink-50">{money(o.total_cents)}</td>
                    <td className="px-6 py-3.5">
                      <Badge tone={o.status === 'paid' ? 'ok' : o.status === 'cancelled' ? 'neutral' : 'warn'}>
                        {o.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
