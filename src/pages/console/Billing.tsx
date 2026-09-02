import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { CryptoCheckout } from '@/components/CryptoCheckout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, EmptyState, Field, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { api, ApiError, type Order } from '@/lib/api'
import { accountChanged, useAuth } from '@/lib/auth'
import { useAllPhones } from '@/lib/hooks'

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const num = (n: number) => n.toLocaleString('en-US')

/** Prepaid minute packages, priced to match the server's rate ladder. */
const MINUTE_PACKS = [5_000, 20_000, 100_000, 500_000, 1_000_000]

export function Billing() {
  const toast = useToast()
  const { account, user, meta, refresh } = useAuth()
  const { phones } = useAllPhones()

  const [orders, setOrders] = useState<Order[] | null>(null)
  const [pack, setPack] = useState(20_000)
  const [packQuote, setPackQuote] = useState<number | null>(null)
  const [paying, setPaying] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)

  const chains = meta?.payments.chains ?? []
  const cryptoAvailable = chains.length > 0

  const loadOrders = useCallback(() => {
    api.orders().then((d) => setOrders(d.orders)).catch(() => setOrders([]))
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  /* Price the selected package server-side so the ladder is never duplicated here. */
  useEffect(() => {
    let cancelled = false
    api.quote({ quantity: 0, duration_days: 30, region: 'us-west', minutes: pack })
      .then((q) => { if (!cancelled) setPackQuote(q.total_cents) })
      .catch(() => { if (!cancelled) setPackQuote(null) })
    return () => { cancelled = true }
  }, [pack])

  const paid = useMemo(() => (orders ?? []).filter((o) => o.status === 'paid'), [orders])
  const pending = useMemo(() => (orders ?? []).filter((o) => o.status === 'pending'), [orders])

  const deviceCount = phones?.length ?? 0
  const spend = account?.spend_cents ?? 0

  const topUp = async () => {
    setBusy(true)
    try {
      const { order } = await api.createOrder({
        quantity: 0, duration_days: 30, region: 'us-west', minutes: pack,
      })
      loadOrders()
      if (cryptoAvailable) {
        setPaying(order)
      } else {
        await api.payOrder(order.id)
        toast(`${num(pack)} minutes added.`, 'ok')
        loadOrders()
        accountChanged()
        await refresh()
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not start the top-up.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Billing"
        lead="What you hold, what you have spent, and how to add runtime. Everything here is your account — no sample data."
        actions={
          <Link
            to="/console/store"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-[0.8rem] font-medium text-white transition-colors hover:bg-brand-400"
          >
            <Icon name="plus" className="size-4" />
            Buy devices
          </Link>
        }
      />

      {paying && (
        <div className="mb-4">
          <CryptoCheckout
            order={paying}
            chains={chains}
            onSettled={() => { setPaying(null); loadOrders() }}
            onCancel={() => {
              void api.cancelOrder(paying.id).catch(() => {})
              setPaying(null)
              loadOrders()
            }}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Devices held', phones === null ? null : num(deviceCount), 'phone', 'billed monthly'],
              ['Prepaid minutes', account ? num(account.minutes_balance) : null, 'clock', 'never expire'],
              ['Total spent', account ? money(spend) : null, 'wallet', `${paid.length} paid order${paid.length === 1 ? '' : 's'}`],
            ].map(([label, value, icon, foot]) => (
              <Card key={label as string} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[0.78rem] text-ink-400">{label as string}</span>
                  <span className="grid size-8 place-items-center rounded-lg bg-ink-800 text-brand-300">
                    <Icon name={icon as string} className="size-4" />
                  </span>
                </div>
                {value === null
                  ? <Skeleton className="mt-3 h-8 w-24" />
                  : <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink-50">{value as string}</p>}
                <p className="mt-3 border-t border-ink-800 pt-3 text-[0.72rem] text-ink-500">{foot as string}</p>
              </Card>
            ))}
          </div>

          {pending.length > 0 && (
            <Card className="border-warn/40 bg-warn/[0.04] p-5">
              <div className="flex items-center gap-2.5">
                <Icon name="alert" className="size-4 shrink-0 text-warn" />
                <h2 className="text-[0.92rem] font-semibold text-ink-50">
                  {pending.length} unpaid order{pending.length === 1 ? '' : 's'}
                </h2>
              </div>
              <ul className="mt-4 space-y-2.5">
                {pending.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-950/60 p-3.5 ring-1 ring-inset ring-ink-800">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.85rem] text-ink-100">
                        {o.lines.map((l) => l.description).join(' · ')}
                      </span>
                      <span className="mt-0.5 block font-mono text-[0.7rem] text-ink-500">{o.created_at}</span>
                    </span>
                    <span className="font-mono text-[0.95rem] font-semibold text-ink-50">{money(o.total_cents)}</span>
                    <Button size="sm" onClick={() => setPaying(o)}>Pay</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-ink-800 px-6 py-4">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Payment history</h2>
              <p className="mt-1 text-[0.78rem] text-ink-400">
                Every settled order, with its on-chain transaction where one exists.
              </p>
            </div>
            {orders === null ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : paid.length === 0 ? (
              <EmptyState
                icon="wallet"
                title="No payments yet"
                body="Orders appear here once they settle, each linked to the transaction that paid for it."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] border-collapse text-left text-[0.82rem]">
                  <thead>
                    <tr className="border-b border-ink-800 text-[0.7rem] uppercase tracking-wider text-ink-500">
                      <th className="px-6 py-3 font-medium">Order</th>
                      <th className="px-6 py-3 font-medium">Items</th>
                      <th className="px-6 py-3 font-medium">Paid</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800">
                    {paid.map((o) => (
                      <tr key={o.id} className="transition-colors hover:bg-ink-800/40">
                        <td className="px-6 py-3.5">
                          <code className="font-mono text-[0.72rem] text-ink-300">{o.id}</code>
                        </td>
                        <td className="px-6 py-3.5 text-ink-200">
                          {o.lines.map((l) => l.description).join(' · ')}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[0.74rem] text-ink-500">
                          {(o.paid_at ?? o.created_at).slice(0, 16)}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-ink-50">{money(o.total_cents)}</td>
                        <td className="px-6 py-3.5">
                          {o.payment?.explorer_url ? (
                            <a
                              href={o.payment.explorer_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-[0.76rem] text-brand-300 hover:text-brand-200"
                            >
                              {o.payment.chain === 'bsc' ? 'BscScan' : 'Tronscan'}
                              <Icon name="external" className="size-3.5" />
                            </a>
                          ) : (
                            <span className="text-[0.74rem] text-ink-600">account credit</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Top up runtime</h2>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-400">
              Minutes are only spent while a device is powered on, and never expire.
            </p>
            <Field className="mt-5" label="Package">
              <Select value={pack} onChange={(e) => setPack(Number(e.target.value))}>
                {MINUTE_PACKS.map((m) => (
                  <option key={m} value={m}>{num(m)} minutes</option>
                ))}
              </Select>
            </Field>
            <p className="mt-4 flex items-baseline justify-between">
              <span className="text-[0.8rem] text-ink-400">Price</span>
              {packQuote === null
                ? <Skeleton className="h-6 w-20" />
                : <span className="font-mono text-xl font-semibold text-ink-50">{money(packQuote)}</span>}
            </p>
            <Button
              className="mt-5 w-full"
              disabled={busy || packQuote === null}
              onClick={() => void topUp()}
              icon={busy ? undefined : 'plus'}
            >
              {busy ? 'Preparing…' : 'Buy minutes'}
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">How you pay</h2>
            {cryptoAvailable ? (
              <>
                <ul className="mt-4 space-y-2.5">
                  {chains.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-lg bg-ink-950/60 p-3 ring-1 ring-inset ring-ink-800">
                      <span className={cx(
                        'grid size-8 shrink-0 place-items-center rounded-lg font-mono text-[0.62rem] font-bold',
                        c.id === 'bsc' ? 'bg-[#f0b90b]/15 text-[#f0b90b]' : 'bg-[#eb0029]/15 text-[#ff5c72]',
                      )}>
                        {c.id === 'bsc' ? 'BNB' : 'TRX'}
                      </span>
                      <span>
                        <span className="block text-[0.82rem] text-ink-100">{c.label}</span>
                        <span className="block text-[0.7rem] text-ink-500">{c.token} · {c.network}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[0.72rem] leading-relaxed text-ink-500">
                  Nothing is stored on file. Each order generates its own invoice with a unique
                  amount, and settles as soon as the transfer confirms on-chain.
                </p>
              </>
            ) : (
              <p className="mt-3 text-[0.8rem] leading-relaxed text-ink-400">
                No payment network is configured on this server, so orders settle against account
                credit.
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Plan</h2>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold capitalize text-ink-50">
                {account?.plan ?? user?.plan ?? 'trial'}
              </span>
              <Badge tone="brand">{num(deviceCount)} devices</Badge>
            </p>
            <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-500">
              Your tier follows the size of your fleet — device pricing steps down automatically as
              it grows, with nothing to renegotiate.
            </p>
            <Link
              to="/pricing"
              className="mt-4 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-brand-300 hover:text-brand-200"
            >
              See the volume tiers
              <Icon name="arrowRight" className="size-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </>
  )
}
