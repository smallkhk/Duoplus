import { PageHeader } from '@/components/ConsoleLayout'
import { AreaChart } from '@/components/Charts'
import { Icon } from '@/components/Icon'
import { Badge, Button, Card, cx, useToast } from '@/components/ui'
import { USAGE_30D } from '@/data/demo'
import { useAllPhones } from '@/lib/hooks'

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const num = (n: number) => n.toLocaleString('en-US')

const INVOICES = [
  { id: 'MDV-2026-0041882', period: 'August 2026', amount: 4_812.44, status: 'paid', due: '2026-09-01' },
  { id: 'MDV-2026-0039114', period: 'July 2026', amount: 4_398.10, status: 'paid', due: '2026-08-01' },
  { id: 'MDV-2026-0036502', period: 'June 2026', amount: 4_105.77, status: 'paid', due: '2026-07-01' },
  { id: 'MDV-2026-0033988', period: 'May 2026', amount: 3_744.20, status: 'paid', due: '2026-06-01' },
]

export function Billing() {
  const toast = useToast()
  const { phones } = useAllPhones()
  const deviceCount = phones?.length ?? 0

  const minutes = USAGE_30D.reduce((s, d) => s + d.minutes, 0)
  const runtimeCost = minutes * 0.0042
  const deviceCost = deviceCount * 0.34
  const storageCost = 0
  const total = runtimeCost + deviceCost + storageCost

  return (
    <>
      <PageHeader
        title="Billing"
        lead="Two meters: the devices you hold, and the minutes they spend powered on. This period runs to the end of the month."
        actions={
          <>
            <Button variant="secondary" size="sm" icon="wallet"
              onClick={() => toast('Payment methods are not wired up in this demo build.', 'info')}>
              Payment method
            </Button>
            <Button size="sm" icon="bolt" onClick={() => toast('Upgrades are not wired up in this demo build.', 'info')}>
              Upgrade plan
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[0.78rem] text-ink-400">Current period · 1–30 September 2026</p>
                <p className="mt-2 font-mono text-4xl font-semibold tracking-tight text-ink-50">{money(total)}</p>
                <p className="mt-1.5 text-[0.8rem] text-ink-400">Estimated, updated hourly.</p>
              </div>
              <Badge tone="brand">Volume tier: 200–999 · 80% off</Badge>
            </div>

            <dl className="mt-7 space-y-3.5 border-t border-ink-800 pt-6">
              {[
                ['Devices', `${deviceCount} phones × $0.340`, deviceCost],
                ['Startup minutes', `${num(minutes)} min × $0.0042`, runtimeCost],
                ['Cloud drive storage', '4.8 GB of 20 GB included', storageCost],
              ].map(([label, sub, amount]) => (
                <div key={label as string} className="flex items-start justify-between gap-4">
                  <dt>
                    <span className="block text-[0.85rem] text-ink-200">{label as string}</span>
                    <span className="mt-0.5 block font-mono text-[0.72rem] text-ink-500">{sub as string}</span>
                  </dt>
                  <dd className="font-mono text-[0.9rem] text-ink-50">{money(amount as number)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-6">
            <div className="mb-5">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Runtime consumption</h2>
              <p className="mt-1 text-[0.78rem] text-ink-400">Startup minutes per day, this period.</p>
            </div>
            <AreaChart
              data={USAGE_30D.map((d) => ({ label: d.label, value: d.minutes }))}
              valueFormat={(n) => `${num(n)} min`}
              label="minutes"
              height={180}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-ink-800 px-6 py-4">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Invoices</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] border-collapse text-left text-[0.82rem]">
                <thead>
                  <tr className="border-b border-ink-800 text-[0.7rem] uppercase tracking-wider text-ink-500">
                    <th className="px-6 py-3 font-medium">Invoice</th>
                    <th className="px-6 py-3 font-medium">Period</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {INVOICES.map((inv) => (
                    <tr key={inv.id} className="transition-colors hover:bg-ink-800/40">
                      <td className="px-6 py-3.5"><code className="font-mono text-[0.76rem] text-ink-200">{inv.id}</code></td>
                      <td className="px-6 py-3.5 text-ink-300">{inv.period}</td>
                      <td className="px-6 py-3.5 font-mono text-ink-100">{money(inv.amount)}</td>
                      <td className="px-6 py-3.5"><Badge tone="ok">{inv.status}</Badge></td>
                      <td className="px-6 py-3.5">
                        <div className="flex justify-end">
                          <Button
                            size="sm" variant="ghost" icon="download"
                            onClick={() => toast('Invoice PDFs are not generated in this demo build.', 'info')}
                          >
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Plan</h2>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold text-ink-50">Scale</span>
              <Badge tone="brand">Partner</Badge>
            </p>
            <ul className="mt-5 space-y-2.5 border-t border-ink-800 pt-5">
              {[
                'Wholesale rates — 30% off list',
                'Unlimited sub-accounts',
                'Net 30 payment terms',
                'Named partner manager',
              ].map((p) => (
                <li key={p} className="flex gap-2.5">
                  <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-ok" strokeWidth={2.6} />
                  <span className="text-[0.8rem] leading-snug text-ink-300">{p}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Prepaid minutes</h2>
            <p className="mt-4 font-mono text-2xl font-semibold text-ink-50">{num(412_800)}</p>
            <p className="mt-1 text-[0.76rem] text-ink-400">minutes remaining · never expire</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full w-[41%] rounded-full bg-gradient-to-r from-brand-500 to-accent-400" />
            </div>
            <p className="mt-3 text-[0.74rem] text-ink-500">
              At the current burn rate this lasts about 18 days.
            </p>
            <Button
              className="mt-5 w-full" variant="secondary" icon="plus"
              onClick={() => toast('Top-ups are not wired up in this demo build.', 'info')}
            >
              Top up minutes
            </Button>
          </Card>

          <Card className={cx('p-6')}>
            <h2 className="text-[0.9rem] font-semibold text-ink-50">Payment method</h2>
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-ink-950/60 p-4 ring-1 ring-inset ring-ink-800">
              <span className="grid size-9 place-items-center rounded-lg bg-ink-800 text-ink-300">
                <Icon name="wallet" className="size-4" />
              </span>
              <span>
                <span className="block font-mono text-[0.82rem] text-ink-100">•••• •••• •••• 4419</span>
                <span className="block text-[0.72rem] text-ink-500">Expires 08/2029</span>
              </span>
            </div>
            <p className="mt-4 text-[0.74rem] leading-relaxed text-ink-500">
              Partner accounts are invoiced net 30; the card on file is a fallback only.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
