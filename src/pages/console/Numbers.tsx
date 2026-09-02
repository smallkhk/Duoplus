import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, CopyButton, EmptyState, Field, Modal, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { api, ApiError, type NumberRecord, type SmsRecord } from '@/lib/api'
import { accountChanged, useAuth } from '@/lib/auth'
import { useAllPhones } from '@/lib/hooks'

/** Countries MADOVA carries numbers in, matching the regions it sells devices in. */
const COUNTRIES = [
  { cc: 'US', label: 'United States' },
  { cc: 'DE', label: 'Germany' },
  { cc: 'GB', label: 'United Kingdom' },
  { cc: 'SG', label: 'Singapore' },
  { cc: 'JP', label: 'Japan' },
  { cc: 'BR', label: 'Brazil' },
  { cc: 'IN', label: 'India' },
  { cc: 'AE', label: 'United Arab Emirates' },
  { cc: 'ID', label: 'Indonesia' },
  { cc: 'NG', label: 'Nigeria' },
]

const MONTHLY_CENTS = 250
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export function Numbers() {
  const toast = useToast()
  const { account, refresh } = useAuth()
  const { phones } = useAllPhones()

  const [numbers, setNumbers] = useState<NumberRecord[] | null>(null)
  const [sms, setSms] = useState<SmsRecord[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const [rentOpen, setRentOpen] = useState(false)
  const [country, setCountry] = useState('US')
  const [months, setMonths] = useState('1')
  const [bindOpen, setBindOpen] = useState(false)
  const [bindTo, setBindTo] = useState('')
  const [releasing, setReleasing] = useState<NumberRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.numbers()
      .then((d) => {
        setNumbers(d.numbers)
        setSms(d.sms)
        setActiveId((cur) => (cur && d.numbers.some((n) => n.id === cur) ? cur : d.numbers[0]?.id ?? null))
      })
      .catch(() => { setNumbers([]); setSms([]) })
  }, [])
  useEffect(() => { load() }, [load])

  const active = numbers?.find((n) => n.id === activeId) ?? null
  const boundPhone = active?.bound_image_id
    ? (phones ?? []).find((p) => p.id === active.bound_image_id)
    : undefined

  const cost = MONTHLY_CENTS * Math.max(1, Number(months) || 1)
  const credit = account?.credit_cents ?? 0

  const rent = async () => {
    setBusy(true)
    try {
      const { number, charged_cents } = await api.rentNumber({ country, months: Number(months) })
      toast(`${number.msisdn} rented for ${money(charged_cents)}.`, 'ok')
      setRentOpen(false)
      setActiveId(number.id)
      load()
      accountChanged()
      await refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not rent that number.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const bind = async () => {
    if (!active) return
    setBusy(true)
    try {
      await api.bindNumber(active.id, bindTo || null)
      toast(bindTo
        ? `${active.msisdn} bound to ${(phones ?? []).find((p) => p.id === bindTo)?.name ?? 'the device'}.`
        : `${active.msisdn} unbound.`, 'ok')
      setBindOpen(false)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not bind that number.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const release = async () => {
    if (!releasing) return
    setBusy(true)
    try {
      await api.releaseNumber(releasing.id)
      toast(`${releasing.msisdn} released.`, 'ok')
      setReleasing(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not release that number.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Cloud numbers"
        lead="Real numbers bound to a phone as its SIM identity, so the handset and the number tell the same story. Inbound codes are parsed out for you."
        actions={
          <Button size="sm" icon="plus" onClick={() => setRentOpen(true)}>Rent a number</Button>
        }
      />

      {numbers?.length === 0 ? (
        <EmptyState
          icon="message"
          title="No numbers rented"
          body={`A number costs ${money(MONTHLY_CENTS)} a month and binds to one device as its SIM identity. Verification codes land in an inbox here.`}
          action={<Button icon="plus" onClick={() => setRentOpen(true)}>Rent the first number</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr] [&>*]:min-w-0">
          <Card className="flex max-h-[42rem] flex-col overflow-hidden">
            <div className="border-b border-ink-800 px-5 py-4">
              <h2 className="text-[0.9rem] font-semibold text-ink-50">Numbers</h2>
              <p className="mt-0.5 text-[0.74rem] text-ink-400">{numbers?.length ?? 0} rented</p>
            </div>
            <ul className="flex-1 divide-y divide-ink-800 overflow-y-auto">
              {numbers === null && Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="px-5 py-4"><Skeleton className="h-8 w-full" /></li>
              ))}
              {numbers?.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => setActiveId(n.id)}
                    className={cx(
                      'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors',
                      n.id === activeId ? 'bg-brand-500/10' : 'hover:bg-ink-800/40',
                    )}
                  >
                    <span className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-lg text-[0.62rem] font-semibold',
                      n.status === 1 ? 'bg-ok/12 text-ok' : 'bg-ink-800 text-ink-500',
                    )}>
                      {n.msisdn.slice(0, 3)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[0.8rem] text-ink-100">{n.msisdn}</span>
                      <span className="block truncate text-[0.7rem] text-ink-500">{n.operator}</span>
                    </span>
                    {n.bound_image_id
                      ? <Icon name="phone" className="size-3.5 shrink-0 text-brand-300" />
                      : <span className="shrink-0 text-[0.66rem] text-ink-600">unbound</span>}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-4">
            {active && (
              <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-mono text-xl font-semibold text-ink-50">{active.msisdn}</h2>
                      <CopyButton text={active.msisdn} />
                    </div>
                    <p className="mt-1.5 text-[0.82rem] text-ink-400">
                      {active.operator} · {active.country} · expires {active.expired_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={active.status === 1 ? 'ok' : 'neutral'}>
                      {active.status === 1 ? 'Active' : 'Suspended'}
                    </Badge>
                    <button
                      onClick={() => setReleasing(active)}
                      className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                      aria-label={`Release ${active.msisdn}`}
                    >
                      <Icon name="trash" className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink-800 pt-5">
                  <span className="text-[0.8rem] text-ink-400">Bound to</span>
                  {boundPhone ? (
                    <span className="flex items-center gap-2 rounded-lg bg-ink-950/60 px-3 py-1.5 ring-1 ring-inset ring-ink-800">
                      <Icon name="phone" className="size-3.5 text-brand-300" />
                      <span className="text-[0.82rem] text-ink-100">{boundPhone.name}</span>
                      <code className="font-mono text-[0.7rem] text-ink-500">{boundPhone.id}</code>
                    </span>
                  ) : (
                    <span className="text-[0.82rem] text-ink-500">No phone — bind one to use it as a SIM identity.</span>
                  )}
                  <Button
                    size="sm" variant="ghost" className="ml-auto"
                    onClick={() => { setBindTo(active.bound_image_id ?? ''); setBindOpen(true) }}
                  >
                    {boundPhone ? 'Rebind' : 'Bind to a phone'}
                  </Button>
                </div>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
                <div>
                  <h2 className="text-[0.9rem] font-semibold text-ink-50">Inbox</h2>
                  <p className="mt-0.5 text-[0.74rem] text-ink-400">
                    Codes are extracted from the message body as they arrive.
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon="refresh" onClick={load}>Refresh</Button>
              </div>

              {sms === null ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : sms.length === 0 ? (
                <EmptyState
                  icon="message"
                  title="No messages yet"
                  body="Verification codes arrive here within seconds of being sent, with the code already extracted."
                />
              ) : (
                <ul className="divide-y divide-ink-800">
                  {sms.map((m, i) => (
                    <li key={i} className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-ink-800/30">
                      <span className="shrink-0 rounded-lg bg-accent-400/12 px-2.5 py-1.5 font-mono text-[0.95rem] font-semibold text-accent-300">
                        {m.code}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-pretty text-[0.85rem] leading-relaxed text-ink-200">{m.message}</span>
                        <span className="mt-1 block font-mono text-[0.7rem] text-ink-500">{m.received_at}</span>
                      </span>
                      <CopyButton text={m.code} label="Copy code" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={rentOpen}
        onClose={() => setRentOpen(false)}
        title="Rent a number"
        description="Charged against your account credit the moment you confirm."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRentOpen(false)}>Cancel</Button>
            <Button onClick={rent} loading={busy} disabled={credit < cost}>
              Rent for {money(cost)}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Country">
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.cc} value={c.cc}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Term">
            <Select value={months} onChange={(e) => setMonths(e.target.value)}>
              {[1, 3, 6, 12].map((m) => (
                <option key={m} value={m}>{m} month{m === 1 ? '' : 's'} — {money(MONTHLY_CENTS * m)}</option>
              ))}
            </Select>
          </Field>
          <div className={cx(
            'rounded-xl border p-4',
            credit < cost ? 'border-warn/30 bg-warn/8' : 'border-ink-800 bg-ink-950/50',
          )}>
            <div className="flex items-center justify-between text-[0.82rem]">
              <span className="text-ink-400">Account credit</span>
              <span className="font-mono text-ink-100">{money(credit)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[0.82rem]">
              <span className="text-ink-400">This rental</span>
              <span className="font-mono text-ink-100">−{money(cost)}</span>
            </div>
            {credit < cost && (
              <p className="mt-3 border-t border-warn/20 pt-3 text-[0.78rem] leading-relaxed text-ink-300">
                Not enough credit.{' '}
                <Link to="/console/billing" className="text-brand-300 underline underline-offset-2">
                  Top up on the billing page
                </Link>{' '}
                and come back.
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        title={`Bind ${active?.msisdn ?? ''}`}
        description="The device reports this number as its SIM identity. One number, one device."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBindOpen(false)}>Cancel</Button>
            <Button onClick={bind} loading={busy}>{bindTo ? 'Bind' : 'Unbind'}</Button>
          </>
        }
      >
        <Field label="Device">
          <Select value={bindTo} onChange={(e) => setBindTo(e.target.value)}>
            <option value="">Not bound to any device</option>
            {(phones ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.area}</option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={releasing !== null}
        onClose={() => setReleasing(null)}
        title={`Release ${releasing?.msisdn ?? ''}?`}
        description="The number goes back to the pool immediately and its inbox is erased. Remaining term is not refunded."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReleasing(null)}>Keep it</Button>
            <Button variant="danger" onClick={release} loading={busy}>Release number</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">
          You will not be able to get this number back once someone else rents it.
        </p>
      </Modal>
    </>
  )
}
