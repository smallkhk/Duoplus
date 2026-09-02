import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import {
  Accordion, Badge, ButtonLink, Card, Container, Field, Section, SectionHeading, Select, Toggle, cx,
} from '@/components/ui'
import { FAQS, PLANS } from '@/data/site'

/* ------------------------------ price model ----------------------------- */

/** List price for a device-month before volume discount. */
const DEVICE_LIST = 1.7

/** Volume tiers — the headline $0.085 is this list price at 95% off. */
const VOLUME_TIERS = [
  { min: 1, off: 0 },
  { min: 10, off: 0.4 },
  { min: 50, off: 0.65 },
  { min: 200, off: 0.8 },
  { min: 1000, off: 0.9 },
  { min: 5000, off: 0.95 },
]

/** Prepaid startup-minute packages; larger packages carry a better rate. */
const MINUTE_PACKAGES = [
  { size: 5_000, rate: 0.0042 },
  { size: 20_000, rate: 0.004 },
  { size: 100_000, rate: 0.0037 },
  { size: 500_000, rate: 0.0034 },
  { size: 1_000_000, rate: 0.003 },
]

/** Flat monthly runtime, per concurrent startup slot. */
const SUBSCRIPTION_MONTHLY = 16.91
const ANNUAL_DISCOUNT = 0.15

function volumeTier(phones: number) {
  return [...VOLUME_TIERS].reverse().find((t) => phones >= t.min) ?? VOLUME_TIERS[0]
}

function minuteRate(minutes: number) {
  return [...MINUTE_PACKAGES].reverse().find((p) => minutes >= p.size)?.rate ?? MINUTE_PACKAGES[0].rate
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 100 ? 2 : 0 })

const num = (n: number) => n.toLocaleString('en-US')

/* -------------------------------- page --------------------------------- */

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <>
      <div className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
        <Container className="relative py-20 text-center sm:py-24">
          <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300">Pricing</p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Pay for the device. Then pay for the minutes.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[1.05rem] leading-relaxed text-ink-300">
            Two meters, both under your control. A phone you keep but rarely boot costs pennies a
            month. A phone that runs around the clock is cheaper on a flat subscription. The
            calculator below will tell you which side you are on.
          </p>
          <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-ink-700 bg-ink-900/70 px-4 py-2">
            <span className={cx('text-[0.82rem]', !annual ? 'text-ink-50' : 'text-ink-400')}>Monthly</span>
            <Toggle checked={annual} onChange={setAnnual} label="Annual billing" />
            <span className={cx('text-[0.82rem]', annual ? 'text-ink-50' : 'text-ink-400')}>Annual</span>
            <Badge tone="ok">Save 15%</Badge>
          </div>
        </Container>
      </div>

      <Section>
        <div className="grid gap-4 lg:grid-cols-4">
          {PLANS.map((p) => {
            const isSub = p.id === 'subscription'
            const price = isSub && annual
              ? `$${(SUBSCRIPTION_MONTHLY * (1 - ANNUAL_DISCOUNT)).toFixed(2)}`
              : p.price
            return (
              <Card
                key={p.id}
                className={cx('relative flex flex-col p-7', p.featured && 'border-brand-500/50 bg-brand-500/[0.04]')}
                hover={!p.featured}
              >
                {p.featured && (
                  <span className="absolute -top-2.5 left-7 rounded-full bg-brand-500 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                )}
                <h2 className="text-[0.95rem] font-semibold text-ink-50">{p.name}</h2>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-mono text-[2rem] font-semibold leading-none tracking-tight text-ink-50">{price}</span>
                  <span className="text-[0.75rem] text-ink-400">{p.unit}</span>
                </p>
                <p className="mt-1.5 text-[0.72rem] text-ink-500">
                  {isSub && annual ? 'billed annually' : p.cadence}
                </p>
                <p className="mt-4 text-pretty text-[0.82rem] leading-relaxed text-ink-400">{p.pitch}</p>

                <ul className="mt-5 flex-1 space-y-2.5 border-t border-ink-800 pt-5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-2.5">
                      <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-ok" strokeWidth={2.6} />
                      <span className="text-[0.8rem] leading-snug text-ink-300">{pt}</span>
                    </li>
                  ))}
                </ul>

                {p.quantities && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {p.quantities.map((q) => (
                      <span key={q} className="rounded border border-ink-700 px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-400">
                        {q}
                      </span>
                    ))}
                  </div>
                )}

                <ButtonLink
                  to={p.id === 'trial' ? '/console' : '#calculator'}
                  variant={p.featured ? 'primary' : 'secondary'}
                  className="mt-6 w-full"
                >
                  {p.cta}
                </ButtonLink>
              </Card>
            )
          })}
        </div>
      </Section>

      <Calculator />
      <VolumeTable />

      <div className="border-t border-ink-800">
        <Section>
          <div className="grid gap-12 lg:grid-cols-[22rem_1fr]">
            <div>
              <SectionHeading eyebrow="FAQ" title="Billing questions, answered plainly" />
              <p className="mt-6 text-[0.85rem] leading-relaxed text-ink-400">
                Buying in volume? Pricing steps down automatically with the size of your fleet —
                there is nothing to apply for and nothing to negotiate.
              </p>
            </div>
            <Accordion items={FAQS.slice(1, 6)} />
          </div>
        </Section>
      </div>
    </>
  )
}

/* ------------------------------ calculator ------------------------------ */

function Calculator() {
  const [phones, setPhones] = useState(250)
  const [hoursPerDay, setHoursPerDay] = useState(6)
  const [daysPerMonth, setDaysPerMonth] = useState(26)
  const [resell, setResell] = useState(false)
  const [markup, setMarkup] = useState(60)

  const result = useMemo(() => {
    const tier = volumeTier(phones)
    const devicePrice = DEVICE_LIST * (1 - tier.off)
    const deviceCost = phones * devicePrice

    const minutes = phones * hoursPerDay * 60 * daysPerMonth
    const rate = minuteRate(minutes)
    const meteredRuntime = minutes * rate

    /* A subscription slot covers one concurrently-running phone. */
    const subscriptionRuntime = phones * SUBSCRIPTION_MONTHLY

    const runtime = Math.min(meteredRuntime, subscriptionRuntime)
    const cheaper: 'metered' | 'subscription' =
      meteredRuntime <= subscriptionRuntime ? 'metered' : 'subscription'

    const total = deviceCost + runtime
    const retail = total * (1 + markup / 100)

    return {
      tier, devicePrice, deviceCost, minutes, rate, meteredRuntime, subscriptionRuntime,
      runtime, cheaper, total, retail, profit: retail - total,
      perPhone: phones > 0 ? total / phones : 0,
    }
  }, [phones, hoursPerDay, daysPerMonth, markup])

  return (
    <div id="calculator" className="scroll-mt-20 border-y border-ink-800 bg-ink-900/30">
      <Section>
        <SectionHeading
          eyebrow="Calculator"
          title="What would your fleet actually cost?"
          lead="Move the inputs. We price the devices at your volume tier, then quote runtime both ways and keep whichever is cheaper."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <Card className="p-7">
            <div className="space-y-7">
              <Slider
                label="Cloud phones"
                value={phones}
                min={1}
                max={10000}
                step={1}
                display={num(phones)}
                onChange={setPhones}
                marks={['1', '2.5k', '5k', '7.5k', '10k']}
              />
              <Slider
                label="Hours powered on, per phone per day"
                value={hoursPerDay}
                min={0.5}
                max={24}
                step={0.5}
                display={`${hoursPerDay} h`}
                onChange={setHoursPerDay}
                marks={['0.5', '6', '12', '18', '24']}
              />
              <Field label="Active days per month">
                <Select value={daysPerMonth} onChange={(e) => setDaysPerMonth(Number(e.target.value))}>
                  {[5, 10, 15, 20, 22, 26, 30].map((d) => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </Select>
              </Field>

              <div className="border-t border-ink-800 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.85rem] font-medium text-ink-100">I am reselling this</p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-500">Add your markup to see the margin.</p>
                  </div>
                  <Toggle checked={resell} onChange={setResell} label="Reseller mode" />
                </div>
                {resell && (
                  <div className="mt-5">
                    <Slider
                      label="Your markup"
                      value={markup}
                      min={10}
                      max={200}
                      step={5}
                      display={`${markup}%`}
                      onChange={setMarkup}
                      marks={['10%', '60%', '110%', '160%', '200%']}
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col p-7">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Estimated monthly cost
            </p>
            <p className="mt-3 font-mono text-[2.75rem] font-semibold leading-none tracking-tight text-ink-50">
              {money(result.total)}
            </p>
            <p className="mt-2 text-[0.8rem] text-ink-400">
              {money(result.perPhone)} per phone per month · {num(Math.round(result.minutes))} startup minutes
            </p>

            <dl className="mt-7 space-y-3 border-t border-ink-800 pt-6">
              <Row
                label={`Devices — ${num(phones)} × ${money(result.devicePrice)}`}
                sub={result.tier.off > 0 ? `${Math.round(result.tier.off * 100)}% volume discount applied` : 'List price'}
                value={money(result.deviceCost)}
              />
              <Row
                label="Runtime — metered"
                sub={`${num(Math.round(result.minutes))} min × $${result.rate.toFixed(4)}`}
                value={money(result.meteredRuntime)}
                dim={result.cheaper !== 'metered'}
                chosen={result.cheaper === 'metered'}
              />
              <Row
                label="Runtime — monthly subscription"
                sub={`${num(phones)} × ${money(SUBSCRIPTION_MONTHLY)}, unlimited minutes`}
                value={money(result.subscriptionRuntime)}
                dim={result.cheaper !== 'subscription'}
                chosen={result.cheaper === 'subscription'}
              />
            </dl>

            <div className="mt-6 flex items-start gap-2.5 rounded-lg bg-ink-950/60 p-3.5 ring-1 ring-inset ring-ink-700">
              <Icon name="bolt" className="mt-0.5 size-4 shrink-0 text-accent-300" />
              <p className="text-[0.78rem] leading-relaxed text-ink-300">
                At {hoursPerDay} h/day the{' '}
                <strong className="font-medium text-ink-100">
                  {result.cheaper === 'metered' ? 'per-minute package' : 'monthly startup subscription'}
                </strong>{' '}
                is cheaper — saving{' '}
                {money(Math.abs(result.meteredRuntime - result.subscriptionRuntime))} a month. You can
                mix both across one fleet, per phone.
              </p>
            </div>

            {resell && (
              <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700">
                {[
                  ['Your cost', money(result.total)],
                  ['Retail', money(result.retail)],
                  ['Margin', money(result.profit)],
                ].map(([l, v], i) => (
                  <div key={l} className={cx('bg-ink-950 p-4', i === 2 && 'bg-ok/5')}>
                    <dt className="text-[0.7rem] text-ink-500">{l}</dt>
                    <dd className={cx('mt-1 font-mono text-[1.05rem] font-semibold', i === 2 ? 'text-ok' : 'text-ink-50')}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-auto flex flex-wrap gap-2.5 pt-7">
              <ButtonLink to="/console" iconRight="arrowRight">Start free</ButtonLink>
              <ButtonLink to="/contact" variant="outline">Get this quoted</ButtonLink>
            </div>
            <p className="mt-4 text-[0.7rem] leading-relaxed text-ink-500">
              Estimate only. Prepaid minute packages, coupons and partner rates are applied at
              checkout; storage beyond the included allowance and cloud numbers are billed separately.
            </p>
          </Card>
        </div>
      </Section>
    </div>
  )
}

function Row({
  label, sub, value, dim = false, chosen = false,
}: { label: string; sub: string; value: string; dim?: boolean; chosen?: boolean }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 transition-opacity', dim && 'opacity-40')}>
      <dt className="min-w-0">
        <span className="flex items-center gap-2 text-[0.84rem] text-ink-200">
          {label}
          {chosen && <Badge tone="ok">applied</Badge>}
        </span>
        <span className="mt-0.5 block font-mono text-[0.7rem] text-ink-500">{sub}</span>
      </dt>
      <dd className="shrink-0 font-mono text-[0.9rem] text-ink-50">{value}</dd>
    </div>
  )
}

function Slider({
  label, value, min, max, step, display, onChange, marks,
}: {
  label: string; value: number; min: number; max: number; step: number
  display: string; onChange: (v: number) => void; marks: string[]
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="text-[0.78rem] font-medium text-ink-300">{label}</span>
        <span className="font-mono text-[0.95rem] font-semibold text-ink-50">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none
          [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-brand-400
          [&::-webkit-slider-thumb]:shadow-md
          [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink-950 [&::-moz-range-thumb]:bg-brand-400"
        style={{
          background: `linear-gradient(to right, var(--color-brand-500) ${pct}%, var(--color-ink-700) ${pct}%)`,
        }}
      />
      <div className="mt-2 flex justify-between font-mono text-[0.62rem] text-ink-600">
        {marks.map((m) => <span key={m}>{m}</span>)}
      </div>
    </div>
  )
}

/* ----------------------------- volume table ----------------------------- */

function VolumeTable() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Volume"
        title="The bigger the fleet, the cheaper the device"
        lead="Device pricing steps down automatically as your fleet grows — there is nothing to negotiate and no annual commitment to sign."
      />
      <div className="mt-12 overflow-x-auto rounded-2xl border border-ink-700/70">
        <table className="w-full min-w-[38rem] border-collapse text-left text-[0.85rem]">
          <thead>
            <tr className="border-b border-ink-700/70 bg-ink-900/70 text-[0.72rem] uppercase tracking-wider text-ink-400">
              <th className="px-5 py-3.5 font-medium">Fleet size</th>
              <th className="px-5 py-3.5 font-medium">Discount</th>
              <th className="px-5 py-3.5 font-medium">Per device / month</th>
              <th className="px-5 py-3.5 font-medium">1,000 devices / month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {VOLUME_TIERS.map((t, i) => {
              const next = VOLUME_TIERS[i + 1]
              const price = DEVICE_LIST * (1 - t.off)
              return (
                <tr key={t.min} className={cx(t.off === 0.95 && 'bg-brand-500/[0.05]')}>
                  <td className="px-5 py-3.5 font-mono text-ink-100">
                    {num(t.min)}{next ? `–${num(next.min - 1)}` : '+'}
                  </td>
                  <td className="px-5 py-3.5">
                    {t.off === 0 ? <span className="text-ink-500">—</span> : <Badge tone="brand">{Math.round(t.off * 100)}% off</Badge>}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-ink-50">${price.toFixed(3)}</td>
                  <td className="px-5 py-3.5 font-mono text-ink-400">{money(price * 1000)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-5 text-[0.8rem] text-ink-500">
        Runtime is priced separately — see the calculator above. Every discount here is applied
        automatically at checkout from the number of devices on the order.
      </p>
    </Section>
  )
}
