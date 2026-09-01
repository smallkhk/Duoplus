import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { BarList } from '@/components/Charts'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Field, Input, Modal, Select, Tabs, cx, useToast,
} from '@/components/ui'
import { SUB_ACCOUNTS } from '@/data/demo'
import type { SubAccount } from '@/lib/duoplus/types'

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = (n: number) => n.toLocaleString('en-US')

const STATUS_TONE: Record<SubAccount['status'], 'ok' | 'brand' | 'warn' | 'neutral'> = {
  active: 'ok', trial: 'brand', past_due: 'warn', churned: 'neutral',
}

type Filter = 'all' | SubAccount['status']

export function Resellers() {
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState(false)

  const rows = useMemo(
    () => filter === 'all' ? SUB_ACCOUNTS : SUB_ACCOUNTS.filter((a) => a.status === filter),
    [filter],
  )

  const active = SUB_ACCOUNTS.filter((a) => a.status === 'active')
  const mrr = SUB_ACCOUNTS.reduce((s, a) => s + a.mrr, 0)
  const margin = SUB_ACCOUNTS.reduce((s, a) => s + a.mrr * a.margin, 0)
  const phones = SUB_ACCOUNTS.reduce((s, a) => s + a.phones, 0)

  return (
    <>
      <PageHeader
        title="Sub-accounts"
        lead="Customers reselling MADOVA capacity under your brand. Each has its own console, users and quota, and none of them can see another."
        actions={
          <>
            <Button variant="secondary" size="sm" icon="download"
              onClick={() => toast('CSV export is not wired up in this demo build.', 'info')}>
              Export CSV
            </Button>
            <Button size="sm" icon="plus" onClick={() => setOpen(true)}>New sub-account</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Sub-accounts', String(SUB_ACCOUNTS.length), `${active.length} active`, 'building'],
          ['Phones resold', num(phones), 'across all customers', 'phone'],
          ['Monthly revenue', money(mrr), 'billed to your customers', 'wallet'],
          ['Your margin', money(Math.round(margin)), `${Math.round((margin / mrr) * 100)}% blended`, 'chart'],
        ].map(([label, value, foot, icon]) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[0.78rem] text-ink-400">{label}</span>
              <span className="grid size-8 place-items-center rounded-lg bg-ink-800 text-brand-300">
                <Icon name={icon} className="size-4" />
              </span>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink-50">{value}</p>
            <p className="mt-2 text-[0.72rem] text-ink-500">{foot}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-5 py-4">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Customers</h2>
            <Tabs<Filter>
              value={filter}
              onChange={setFilter}
              tabs={[
                { id: 'all', label: 'All', count: SUB_ACCOUNTS.length },
                { id: 'active', label: 'Active', count: active.length },
                { id: 'trial', label: 'Trial', count: SUB_ACCOUNTS.filter((a) => a.status === 'trial').length },
                { id: 'past_due', label: 'Past due', count: SUB_ACCOUNTS.filter((a) => a.status === 'past_due').length },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-[0.82rem]">
              <thead>
                <tr className="border-b border-ink-800 text-[0.7rem] uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Phones</th>
                  <th className="px-5 py-3 font-medium">Quota used</th>
                  <th className="px-5 py-3 font-medium">MRR</th>
                  <th className="px-5 py-3 font-medium">Margin</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {rows.map((a) => {
                  const pct = Math.round((a.minutes_used / a.minutes_quota) * 100)
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-ink-800/40">
                      <td className="px-5 py-3.5">
                        <span className="block font-medium text-ink-100">{a.company}</span>
                        <span className="block text-[0.7rem] text-ink-500">{a.email} · since {a.since}</span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-300">{a.plan}</td>
                      <td className="px-5 py-3.5 font-mono text-ink-200">{num(a.phones)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-800">
                            <div
                              className={cx('h-full rounded-full', pct > 92 ? 'bg-warn' : 'bg-brand-500')}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[0.72rem] text-ink-400">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-ink-100">{money(a.mrr)}</td>
                      <td className="px-5 py-3.5 font-mono text-ok">{Math.round(a.margin * 100)}%</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={STATUS_TONE[a.status]}>{a.status.replace('_', ' ')}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Revenue by customer</h2>
            <p className="mt-1 mb-5 text-[0.76rem] text-ink-400">Monthly recurring, this period.</p>
            <BarList
              data={[...SUB_ACCOUNTS].sort((a, b) => b.mrr - a.mrr).slice(0, 6)
                .map((a) => ({ label: a.company, value: a.mrr }))}
              valueFormat={money}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Needs attention</h2>
            <ul className="mt-4 space-y-3">
              {SUB_ACCOUNTS
                .filter((a) => a.status === 'past_due' || a.minutes_used / a.minutes_quota > 0.92)
                .map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 rounded-lg bg-ink-950/60 p-3 ring-1 ring-inset ring-ink-800">
                    <Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-warn" />
                    <span>
                      <span className="block text-[0.82rem] text-ink-100">{a.company}</span>
                      <span className="block text-[0.72rem] text-ink-400">
                        {a.status === 'past_due'
                          ? 'Invoice past due — suspend or chase.'
                          : `${Math.round((a.minutes_used / a.minutes_quota) * 100)}% of the minute quota consumed.`}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New sub-account"
        description="Provisions an isolated console for a customer, under your brand and your pricing."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { setOpen(false); toast('Sub-account creation is not wired up in this demo build.', 'info') }}>
              Create sub-account
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company"><Input placeholder="Northwind Media" /></Field>
            <Field label="Primary contact email"><Input type="email" placeholder="ops@northwind.media" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan">
              <Select defaultValue="Growth">
                {['Starter', 'Growth', 'Scale'].map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Phone quota"><Input type="number" defaultValue={200} /></Field>
          </div>
          <Field label="Minute quota per month" hint="Hard cap — the sub-account cannot exceed it.">
            <Input type="number" defaultValue={90000} />
          </Field>
          <Field label="Your markup over wholesale">
            <Select defaultValue="60">
              {[30, 45, 60, 80, 100].map((m) => <option key={m} value={m}>{m}%</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}
