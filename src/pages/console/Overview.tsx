import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { AreaChart, BarList, Donut, Heatmap } from '@/components/Charts'
import { Icon } from '@/components/Icon'
import { Badge, ButtonLink, Card, Dot, Skeleton, cx } from '@/components/ui'
import { callData } from '@/lib/duoplus/client'
import { AUTOMATIONS, PROXIES, REGION_INDEX, SUB_ACCOUNTS, USAGE_30D } from '@/lib/duoplus/mock'
import { PHONE_STATUS_LABEL, PhoneStatus, type CloudPhone, type Paged } from '@/lib/duoplus/types'

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = (n: number) => n.toLocaleString('en-US')

export function Overview() {
  const [phones, setPhones] = useState<CloudPhone[] | null>(null)

  useEffect(() => {
    let cancelled = false

    /* The endpoint caps a page at 100, so walk the pages to summarise the whole fleet. */
    const loadAll = async () => {
      const rows: CloudPhone[] = []
      let page = 1
      let pages = 1
      do {
        const data = await callData<Paged<CloudPhone>>('/api/v1/cloudPhone/list', { page, pagesize: 100 })
        rows.push(...data.list)
        pages = data.total_page
        page++
      } while (page <= pages && page <= 10)
      return rows
    }

    loadAll()
      .then((rows) => { if (!cancelled) setPhones(rows) })
      .catch(() => { if (!cancelled) setPhones([]) })
    return () => { cancelled = true }
  }, [])

  const byStatus = (s: PhoneStatus) => phones?.filter((p) => p.status === s).length ?? 0
  const total = phones?.length ?? 0

  const statusBreakdown = [
    { label: PHONE_STATUS_LABEL[1], value: byStatus(PhoneStatus.PoweredOn), color: '#34d399' },
    { label: PHONE_STATUS_LABEL[2], value: byStatus(PhoneStatus.PoweredOff), color: '#565e80' },
    { label: 'Booting up', value: byStatus(PhoneStatus.PoweringOn) + byStatus(PhoneStatus.Configuring), color: '#6d5ef8' },
    { label: 'Expired', value: byStatus(PhoneStatus.Expired) + byStatus(PhoneStatus.RenewalOverdue), color: '#fbbf24' },
    { label: 'Unconfigured', value: byStatus(PhoneStatus.NotConfigured) + byStatus(PhoneStatus.ConfigurationFailed), color: '#fb7185' },
  ].filter((s) => s.value > 0)

  const byRegion = Object.values(
    (phones ?? []).reduce<Record<string, { label: string; value: number }>>((acc, p) => {
      const label = REGION_INDEX[p.region]?.area ?? p.region
      acc[label] ??= { label, value: 0 }
      acc[label].value++
      return acc
    }, {}),
  ).sort((a, b) => b.value - a.value).slice(0, 6)

  const minutesThisMonth = USAGE_30D.reduce((s, d) => s + d.minutes, 0)
  const revenueThisMonth = SUB_ACCOUNTS.reduce((s, a) => s + a.mrr, 0)
  const unhealthyProxies = PROXIES.filter((p) => !p.healthy).length

  return (
    <>
      <PageHeader
        title="Overview"
        lead="Fleet health, consumption and reseller revenue for the current billing period."
        actions={
          <>
            <ButtonLink to="/console/phones" variant="secondary" size="sm" icon="phone">Manage phones</ButtonLink>
            <ButtonLink to="/console/phones" size="sm" icon="plus">New cloud phone</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Cloud phones"
          value={phones === null ? null : num(total)}
          delta="+12 this week"
          tone="ok"
          icon="phone"
          foot={`${byStatus(PhoneStatus.PoweredOn)} powered on right now`}
        />
        <Kpi
          label="Startup minutes · 30d"
          value={num(minutesThisMonth)}
          delta="+8.4%"
          tone="ok"
          icon="clock"
          foot={`${money(minutesThisMonth * 0.0042)} at the metered rate`}
        />
        <Kpi
          label="Sub-account MRR"
          value={money(revenueThisMonth)}
          delta="+3 accounts"
          tone="ok"
          icon="wallet"
          foot={`${SUB_ACCOUNTS.filter((a) => a.status === 'active').length} active resellers`}
        />
        <Kpi
          label="Proxy health"
          value={`${PROXIES.length - unhealthyProxies}/${PROXIES.length}`}
          delta={unhealthyProxies > 0 ? `${unhealthyProxies} failing` : 'all healthy'}
          tone={unhealthyProxies > 0 ? 'warn' : 'ok'}
          icon="route"
          foot="Checked every 15 minutes"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Startup minutes consumed</h2>
              <p className="mt-1 text-[0.78rem] text-ink-400">Last 30 days across the whole fleet.</p>
            </div>
            <Badge tone="brand">30d</Badge>
          </div>
          <AreaChart
            data={USAGE_30D.map((d) => ({ label: d.label, value: d.minutes }))}
            valueFormat={(n) => `${num(n)} min`}
            label="minutes"
            height={210}
          />
        </Card>

        <Card className="p-6">
          <h2 className="text-[0.95rem] font-semibold text-ink-50">Fleet status</h2>
          <p className="mt-1 text-[0.78rem] text-ink-400">Live from <code className="font-mono text-ink-500">/api/v1/cloudPhone/list</code></p>
          <div className="mt-6">
            {phones === null ? (
              <div className="flex items-center gap-6">
                <Skeleton className="size-[168px] rounded-full" />
                <div className="flex-1 space-y-3">
                  {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}
                </div>
              </div>
            ) : (
              <Donut data={statusBreakdown} centerValue={num(total)} centerLabel="phones" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-6">
          <h2 className="text-[0.95rem] font-semibold text-ink-50">Phones by region</h2>
          <p className="mt-1 mb-5 text-[0.78rem] text-ink-400">Where your fleet is physically racked.</p>
          {phones === null
            ? <div className="space-y-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            : <BarList data={byRegion} />}
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Automation</h2>
              <p className="mt-1 text-[0.78rem] text-ink-400">Scheduled and triggered runs.</p>
            </div>
            <Link to="/console/automation" className="text-[0.75rem] text-brand-300 hover:text-brand-200">View all</Link>
          </div>
          <ul className="mt-5 space-y-3">
            {AUTOMATIONS.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <Dot tone={a.status === 'running' ? 'ok' : a.status === 'failed' ? 'danger' : a.status === 'paused' ? 'neutral' : 'brand'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.82rem] text-ink-100">{a.name}</span>
                  <span className="block truncate text-[0.7rem] text-ink-500">{a.trigger} · {a.targets} phones</span>
                </span>
                <span className={cx('shrink-0 font-mono text-[0.74rem]', a.success_rate > 0.9 ? 'text-ok' : 'text-warn')}>
                  {Math.round(a.success_rate * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-[0.95rem] font-semibold text-ink-50">Boot activity</h2>
          <p className="mt-1 mb-5 text-[0.78rem] text-ink-400">Power-ons per day, last 14 weeks.</p>
          <div className="overflow-x-auto pb-1">
            <Heatmap />
          </div>
          <div className="mt-4 flex items-center justify-between text-[0.68rem] text-ink-500">
            <span>Less</span>
            <span className="flex gap-1">
              {[10, 35, 60, 85].map((v) => (
                <span key={v} className="size-2.5 rounded-[2px]" style={{ background: `color-mix(in srgb, #6d5ef8 ${v}%, #141829)` }} />
              ))}
            </span>
            <span>More</span>
          </div>
          <Link
            to="/console/phones"
            className="mt-6 flex items-center justify-between rounded-lg bg-ink-950/60 px-3.5 py-2.5 text-[0.8rem] text-ink-300 ring-1 ring-inset ring-ink-800 transition-colors hover:text-ink-100"
          >
            Open the fleet table
            <Icon name="arrowRight" className="size-3.5" />
          </Link>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-6 py-4">
          <div>
            <h2 className="text-[0.95rem] font-semibold text-ink-50">Sub-accounts</h2>
            <p className="mt-1 text-[0.78rem] text-ink-400">Customers reselling MADOVA capacity under your brand.</p>
          </div>
          <Link to="/console/resellers" className="text-[0.78rem] font-medium text-brand-300 hover:text-brand-200">
            Manage sub-accounts →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-ink-800 text-[0.7rem] uppercase tracking-wider text-ink-500">
                <th className="px-6 py-3 font-medium">Company</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Phones</th>
                <th className="px-6 py-3 font-medium">Minutes used</th>
                <th className="px-6 py-3 font-medium">MRR</th>
                <th className="px-6 py-3 font-medium">Margin</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {SUB_ACCOUNTS.slice(0, 5).map((a) => {
                const pct = Math.round((a.minutes_used / a.minutes_quota) * 100)
                return (
                  <tr key={a.id} className="transition-colors hover:bg-ink-800/40">
                    <td className="px-6 py-3.5">
                      <span className="block font-medium text-ink-100">{a.company}</span>
                      <span className="block text-[0.72rem] text-ink-500">{a.contact}</span>
                    </td>
                    <td className="px-6 py-3.5 text-ink-300">{a.plan}</td>
                    <td className="px-6 py-3.5 font-mono text-ink-200">{num(a.phones)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-800">
                          <div
                            className={cx('h-full rounded-full', pct > 92 ? 'bg-warn' : 'bg-brand-500')}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[0.72rem] text-ink-400">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-ink-100">{money(a.mrr)}</td>
                    <td className="px-6 py-3.5 font-mono text-ok">{Math.round(a.margin * 100)}%</td>
                    <td className="px-6 py-3.5">
                      <Badge tone={a.status === 'active' ? 'ok' : a.status === 'trial' ? 'brand' : a.status === 'past_due' ? 'warn' : 'neutral'}>
                        {a.status.replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function Kpi({
  label, value, delta, tone, icon, foot,
}: {
  label: string; value: string | null; delta: string
  tone: 'ok' | 'warn' | 'danger'; icon: string; foot: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[0.78rem] text-ink-400">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg bg-ink-800 text-brand-300">
          <Icon name={icon} className="size-4" />
        </span>
      </div>
      {value === null
        ? <Skeleton className="mt-3 h-8 w-24" />
        : <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink-50">{value}</p>}
      <div className="mt-2.5 flex items-center gap-2">
        <Badge tone={tone}>{delta}</Badge>
      </div>
      <p className="mt-3 border-t border-ink-800 pt-3 text-[0.72rem] text-ink-500">{foot}</p>
    </Card>
  )
}
