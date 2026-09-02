import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { BarList } from '@/components/Charts'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Field, Input, Modal, Select, Skeleton, Tabs, cx, useToast,
} from '@/components/ui'
import { api, ApiError, type SubAccountRecord as SubAccount } from '@/lib/api'

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = (n: number) => n.toLocaleString('en-US')

const STATUS_TONE: Record<SubAccount['status'], 'ok' | 'brand' | 'warn' | 'neutral'> = {
  active: 'ok', trial: 'brand', past_due: 'warn', churned: 'neutral',
}

type Filter = 'all' | SubAccount['status']

const BLANK = {
  company: '', contact: '', email: '', plan: 'Starter',
  minutes_quota: '50000', mrr: '0', margin: '35',
}

export function Resellers() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<SubAccount[] | null>(null)
  const [plans, setPlans] = useState<string[]>(['Starter', 'Growth', 'Scale', 'Enterprise'])
  const [filter, setFilter] = useState<Filter>('all')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState<SubAccount | null>(null)
  const [removing, setRemoving] = useState<SubAccount | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.subAccounts()
      .then((d) => { setAccounts(d.sub_accounts); setPlans(d.plans) })
      .catch(() => setAccounts([]))
  }, [])
  useEffect(() => { load() }, [load])

  const all = useMemo(() => accounts ?? [], [accounts])
  const rows = useMemo(
    () => (filter === 'all' ? all : all.filter((a) => a.status === filter)),
    [all, filter],
  )

  const active = all.filter((a) => a.status === 'active')
  const mrr = all.reduce((s, a) => s + a.mrr, 0)
  /* margin is stored as whole percent, so scale it back to a fraction for money maths. */
  const margin = all.reduce((s, a) => s + a.mrr * (a.margin / 100), 0)
  const phones = all.reduce((s, a) => s + a.phones, 0)

  const create = async () => {
    setBusy(true)
    try {
      const { sub_account } = await api.createSubAccount({
        company: form.company,
        contact: form.contact,
        email: form.email,
        plan: form.plan,
        minutes_quota: Number(form.minutes_quota),
        mrr: Number(form.mrr),
        margin: Number(form.margin),
      })
      toast(`${sub_account.company} created.`, 'ok')
      setOpen(false)
      setForm(BLANK)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create that sub-account.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await api.updateSubAccount(editing.id, {
        plan: editing.plan,
        status: editing.status,
        minutes_quota: editing.minutes_quota,
        mrr: editing.mrr,
        margin: editing.margin,
      })
      toast(`${editing.company} saved.`, 'ok')
      setEditing(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save that sub-account.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.deleteSubAccount(removing.id)
      toast(`${removing.company} removed.`, 'ok')
      setRemoving(null)
      setEditing(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove that sub-account.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Sub-accounts"
        lead="Customers reselling MADOVA capacity under your brand. Each has its own console, users and quota, and none of them can see another."
        actions={
          <>
            <a
              href="/api/sub-accounts.csv"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-medium text-ink-100 ring-1 ring-inset ring-ink-700 transition-colors hover:bg-ink-800/70"
            >
              <Icon name="download" className="size-4" />
              Export CSV
            </a>
            <Button size="sm" icon="plus" onClick={() => setOpen(true)}>New sub-account</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Sub-accounts', String(all.length), `${active.length} active`, 'building'],
          ['Phones resold', num(phones), 'across all customers', 'phone'],
          ['Monthly revenue', money(mrr), 'billed to your customers', 'wallet'],
          ['Your margin', money(Math.round(margin)), mrr > 0 ? `${Math.round((margin / mrr) * 100)}% blended` : 'no revenue yet', 'chart'],
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
                { id: 'all', label: 'All', count: all.length },
                { id: 'active', label: 'Active', count: active.length },
                { id: 'trial', label: 'Trial', count: all.filter((a) => a.status === 'trial').length },
                { id: 'past_due', label: 'Past due', count: all.filter((a) => a.status === 'past_due').length },
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
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {accounts === null && Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }, (_, j) => (
                    <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                  ))}</tr>
                ))}

                {accounts !== null && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[0.82rem] text-ink-500">
                      {all.length === 0
                        ? 'No sub-accounts yet.'
                        : 'No sub-accounts match that filter.'}
                    </td>
                  </tr>
                )}

                {rows.map((a) => {
                  const pct = a.minutes_quota > 0 ? Math.round((a.minutes_used / a.minutes_quota) * 100) : 0
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
                      <td className="px-5 py-3.5 font-mono text-ok">{a.margin}%</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={STATUS_TONE[a.status]}>{a.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setEditing(a)}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                            aria-label={`Manage ${a.company}`}
                          >
                            <Icon name="settings" className="size-3.5" />
                          </button>
                        </div>
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
            {all.length === 0 ? (
              <p className="text-[0.8rem] text-ink-500">Nothing to chart yet.</p>
            ) : (
              <BarList
                data={[...all].sort((a, b) => b.mrr - a.mrr).slice(0, 6)
                  .map((a) => ({ label: a.company, value: a.mrr }))}
                valueFormat={money}
              />
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Needs attention</h2>
            <ul className="mt-4 space-y-3">
              {all.filter((a) => a.status === 'past_due'
                || (a.minutes_quota > 0 && a.minutes_used / a.minutes_quota > 0.92)).length === 0 && (
                <li className="text-[0.8rem] text-ink-500">Nothing needs chasing right now.</li>
              )}
              {all
                .filter((a) => a.status === 'past_due'
                  || (a.minutes_quota > 0 && a.minutes_used / a.minutes_quota > 0.92))
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
            <Button
              onClick={create}
              loading={busy}
              disabled={form.company.trim().length < 2 || form.contact.trim().length < 2 || !form.email.includes('@')}
            >
              Create sub-account
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Northwind Media"
                autoFocus
              />
            </Field>
            <Field label="Primary contact">
              <Input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="Rae Okonjo"
              />
            </Field>
          </div>
          <Field label="Contact email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ops@northwind.media"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan">
              <Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                {plans.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Monthly revenue" hint="What you bill them, in whole dollars.">
              <Input
                type="number"
                value={form.mrr}
                onChange={(e) => setForm({ ...form, mrr: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Minute quota per month" hint="Hard cap — the sub-account cannot exceed it.">
            <Input
              type="number"
              value={form.minutes_quota}
              onChange={(e) => setForm({ ...form, minutes_quota: e.target.value })}
            />
          </Field>
          <Field label="Your margin over wholesale">
            <Select value={form.margin} onChange={(e) => setForm({ ...form, margin: e.target.value })}>
              {[20, 30, 35, 45, 60, 80].map((m) => <option key={m} value={m}>{m}%</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.company ?? ''}
        description={`${editing?.contact ?? ''} · ${editing?.email ?? ''}`}
        footer={
          <>
            <Button variant="danger" onClick={() => setRemoving(editing)}>Remove</Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} loading={busy}>Save changes</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan">
              <Select
                value={editing?.plan ?? ''}
                onChange={(e) => editing && setEditing({ ...editing, plan: e.target.value })}
              >
                {plans.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={editing?.status ?? 'trial'}
                onChange={(e) => editing && setEditing({ ...editing, status: e.target.value as SubAccount['status'] })}
              >
                {(['trial', 'active', 'past_due', 'churned'] as const).map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly revenue">
              <Input
                type="number"
                value={editing?.mrr ?? 0}
                onChange={(e) => editing && setEditing({ ...editing, mrr: Number(e.target.value) })}
              />
            </Field>
            <Field label="Margin %">
              <Input
                type="number"
                value={editing?.margin ?? 0}
                onChange={(e) => editing && setEditing({ ...editing, margin: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Minute quota per month">
            <Input
              type="number"
              value={editing?.minutes_quota ?? 0}
              onChange={(e) => editing && setEditing({ ...editing, minutes_quota: Number(e.target.value) })}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.company ?? ''}?`}
        description="The customer record is deleted. Devices you provisioned for them are not."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Remove sub-account</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">This cannot be undone.</p>
      </Modal>
    </>
  )
}
