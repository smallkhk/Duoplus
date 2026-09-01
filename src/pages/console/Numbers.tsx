import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, CopyButton, EmptyState, Skeleton, cx, useToast,
} from '@/components/ui'
import { callData } from '@/lib/duoplus/client'
import { CLOUD_NUMBERS } from '@/data/demo'
import { useAllPhones } from '@/lib/hooks'
import type { CloudNumber, Paged, SmsMessage } from '@/lib/duoplus/types'

export function Numbers() {
  const toast = useToast()
  const [active, setActive] = useState<CloudNumber & { bound_index: number | null }>(CLOUD_NUMBERS[1])
  const { phones } = useAllPhones()
  const [sms, setSms] = useState<SmsMessage[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setSms(null)
    callData<Paged<SmsMessage>>('/api/v1/cloudNumber/smsList', {
      number_id: active.id, page: 1, pagesize: 50,
    })
      .then((d) => { if (!cancelled) setSms(d.list) })
      .catch(() => { if (!cancelled) setSms([]) })
    return () => { cancelled = true }
  }, [active.id])

  const boundPhone = active.bound_index === null ? undefined : (phones ?? [])[active.bound_index % Math.max(1, (phones ?? []).length)]

  return (
    <>
      <PageHeader
        title="Cloud numbers"
        lead="Real numbers bound to a phone as its SIM identity, so the handset and the number tell the same story. Inbound codes are parsed out for you."
        actions={<Button size="sm" icon="plus" onClick={() => toast('Renting numbers is not wired up in this demo build.', 'info')}>Rent a number</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] [&>*]:min-w-0">
        <Card className="flex max-h-[42rem] flex-col overflow-hidden">
          <div className="border-b border-ink-800 px-5 py-4">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Numbers</h2>
            <p className="mt-0.5 text-[0.74rem] text-ink-400">{CLOUD_NUMBERS.length} rented</p>
          </div>
          <ul className="flex-1 divide-y divide-ink-800 overflow-y-auto">
            {CLOUD_NUMBERS.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setActive(n)}
                  className={cx(
                    'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors',
                    n.id === active.id ? 'bg-brand-500/10' : 'hover:bg-ink-800/40',
                  )}
                >
                  <span className={cx(
                    'grid size-8 shrink-0 place-items-center rounded-lg text-[0.62rem] font-semibold',
                    n.status === 1 ? 'bg-ok/12 text-ok' : 'bg-ink-800 text-ink-500',
                  )}>
                    {n.country}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[0.8rem] text-ink-100">{n.msisdn}</span>
                    <span className="block truncate text-[0.7rem] text-ink-500">{n.operator}</span>
                  </span>
                  {n.bound_index !== null
                    ? <Icon name="phone" className="size-3.5 shrink-0 text-brand-300" />
                    : <span className="shrink-0 text-[0.66rem] text-ink-600">unbound</span>}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
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
              <Badge tone={active.status === 1 ? 'ok' : 'neutral'}>
                {active.status === 1 ? 'Active' : 'Suspended'}
              </Badge>
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
                onClick={() => toast('Binding numbers is not wired up in this demo build.', 'info')}
              >
                {boundPhone ? 'Rebind' : 'Bind to a phone'}
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
              <div>
                <h2 className="text-[0.9rem] font-semibold text-ink-50">Inbox</h2>
                <p className="mt-0.5 text-[0.74rem] text-ink-400">
                  <code className="font-mono">POST /api/v1/cloudNumber/smsList</code> · times are GMT+08:00
                </p>
              </div>
              <Button
                size="sm" variant="secondary" icon="refresh"
                onClick={() => setActive({ ...active })}
              >
                Refresh
              </Button>
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
    </>
  )
}
