import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { PhoneFrame } from '@/components/PhoneFrame'
import {
  Accordion, Badge, ButtonLink, Card, Container, Section, SectionHeading, Code, cx,
} from '@/components/ui'
import { FAQS, FEATURES, PLANS, SOLUTIONS, STATS, STEPS, TESTIMONIALS } from '@/data/site'
import { API_BASE_URL, API_KEY_HEADER } from '@/lib/duoplus/endpoints'

const CUSTOMERS = [
  'Northwind Media', 'Kite Social', 'Lagos Reach', 'Anda Commerce',
  'Vertex Growth', 'Bluepeak Labs', 'Casa Digital', 'Meridian Ads',
]

const SAMPLE = `curl -X POST ${API_BASE_URL}/api/v1/cloudPhone/list \\
  -H "Content-Type: application/json" \\
  -H "${API_KEY_HEADER}: $MADOVA_KEY" \\
  -d '{"link_status":["1"],"pagesize":50,"sort_by":"created_at","order":"desc"}'`

export function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Stats />
      <Bento />
      <HowItWorks />
      <SolutionsPreview />
      <ApiBand />
      <PricingPreview />
      <Testimonials />
      <Faq />
      <FinalCta />
    </>
  )
}

/* --------------------------------- hero -------------------------------- */

function Hero() {
  return (
    <div className="relative overflow-hidden border-b border-ink-800">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <div className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-60" />

      <Container className="relative">
        <div className="grid items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="animate-rise">
            <Link
              to="/features"
              className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/70 py-1 pl-1 pr-3 text-[0.76rem] text-ink-300 transition-colors hover:border-brand-500/50 hover:text-ink-100"
            >
              <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[0.68rem] font-semibold text-brand-200">
                New
              </span>
              Full ADB access on every device
              <Icon name="arrowRight" className="size-3.5" />
            </Link>

            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              <span className="text-gradient block">Antidetect cloud phones</span>
              <span className="block">for multi‑account growth</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-ink-300 sm:text-[1.08rem]">
              MADOVA gives you real ARM Android devices in the cloud — each with its own
              environment, storage and hardware identity. Boot a thousand in a minute, drive them
              from a browser, and automate the whole fleet over an open API.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink to="/console" size="lg" iconRight="arrowRight">Start free — 1 phone, 30 days</ButtonLink>
              <ButtonLink to="/pricing" size="lg" variant="outline">See pricing</ButtonLink>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.8rem] text-ink-400">
              {['No card required', 'No client to install', 'Cancel any time'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Icon name="check" className="size-3.5 text-ok" strokeWidth={2.4} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <HeroArt />
        </div>
      </Container>
    </div>
  )
}

function HeroArt() {
  const fleet = [
    { name: 'TikTok-US-014', tone: 'default' as const, badge: 'US' },
    { name: 'Shop-DE-027', tone: 'busy' as const, badge: 'DE' },
    { name: 'Farm-SG-102', tone: 'off' as const, badge: 'SG' },
  ]
  return (
    <div className="relative animate-rise [animation-delay:120ms]">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-brand-500/12 blur-3xl" />

      <div className="relative grid grid-cols-3 items-end gap-3 sm:gap-4">
        {fleet.map((p, i) => (
          <div key={p.name} className={cx(i === 1 && '-translate-y-6', i === 2 && 'translate-y-3')}>
            <PhoneFrame tone={p.tone} label={p.name} />
          </div>
        ))}
      </div>

      {/* Status strip sits below the devices so it never covers a screen. */}
      <div className="relative mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/90 p-3.5 shadow-2xl backdrop-blur">
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center justify-between gap-3">
            <span className="text-[0.74rem] font-medium text-ink-200">Batch power on</span>
            <Badge tone="ok">148 / 148</Badge>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-ink-800">
            <span className="block h-full w-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400" />
          </span>
          <span className="block truncate font-mono text-[0.62rem] text-ink-500">
            POST /api/v1/cloudPhone/batchPowerOn
          </span>
        </span>
        <span className="shrink-0 border-l border-ink-800 pl-4">
          <span className="block text-[0.6rem] uppercase tracking-wider text-ink-500">Median latency</span>
          <span className="block font-mono text-lg font-semibold text-accent-300">38 ms</span>
        </span>
      </div>
    </div>
  )
}

/* ------------------------------- marquee ------------------------------- */

function Marquee() {
  return (
    <div className="overflow-hidden border-b border-ink-800 py-7">
      <p className="mb-6 text-center text-[0.72rem] uppercase tracking-[0.2em] text-ink-500">
        Fleets running on MADOVA
      </p>
      <div className="relative flex" aria-hidden="true">
        <div className="flex shrink-0 animate-marquee items-center gap-14 pr-14">
          {[...CUSTOMERS, ...CUSTOMERS].map((c, i) => (
            <span key={c + i} className="whitespace-nowrap text-[0.95rem] font-medium tracking-tight text-ink-600">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- stats -------------------------------- */

function Stats() {
  return (
    <Container>
      <dl className="grid grid-cols-2 divide-ink-800 border-b border-ink-800 py-12 sm:divide-x lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="px-6 py-4 text-center">
            <dt className="font-mono text-3xl font-semibold tracking-tight text-ink-50">{s.value}</dt>
            <dd className="mt-1.5 text-[0.8rem] text-ink-400">{s.label}</dd>
          </div>
        ))}
      </dl>
    </Container>
  )
}

/* -------------------------------- bento -------------------------------- */

function Bento() {
  const [hero, ...rest] = FEATURES
  return (
    <Section id="capabilities">
      <SectionHeading
        eyebrow="Capabilities"
        title="A phone farm, minus the phones"
        lead="Everything a rack of handsets gave you — the hardware, the identities, the SIMs — delivered as infrastructure you can call from code."
      />

      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        {/* Lead tile spans two columns and carries the device art. */}
        <Card className="relative overflow-hidden p-8 lg:col-span-2" hover>
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center">
            <div className="flex-1">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                <Icon name={hero.icon} className="size-5" />
              </span>
              <h3 className="mt-5 text-xl font-semibold text-ink-50">{hero.title}</h3>
              <p className="mt-3 max-w-md text-pretty text-[0.9rem] leading-relaxed text-ink-300">{hero.detail}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Android 11–14', 'ARM Cortex', 'No translation layer', 'Real sensors'].map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </div>
            <PhoneFrame className="w-32 shrink-0 sm:w-36" />
          </div>
        </Card>

        <Card className="p-8" hover>
          <span className="grid size-10 place-items-center rounded-xl bg-accent-400/12 text-accent-300">
            <Icon name="fingerprint" className="size-5" />
          </span>
          <h3 className="mt-5 text-xl font-semibold text-ink-50">A coherent fingerprint</h3>
          <p className="mt-3 text-pretty text-[0.9rem] leading-relaxed text-ink-300">
            Proxy exit, GPS fix, SIM identity and serving cell are the four things apps cross-check.
            MADOVA keeps them consistent so a device never contradicts itself.
          </p>
          <dl className="mt-6 space-y-2 font-mono text-[0.72rem]">
            {[
              ['proxy.exit', 'Los Angeles, US'],
              ['gps', '34.0522, −118.2437'],
              ['sim.mcc/mnc', '310 / 260'],
              ['locale', 'en-US · America/Los_Angeles'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-ink-800 pb-2">
                <dt className="text-ink-500">{k}</dt>
                <dd className="truncate text-right text-ok">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {rest.slice(0, 6).map((f) => (
          <Card key={f.slug} className="p-7" hover>
            <span className="grid size-9 place-items-center rounded-lg bg-ink-800 text-brand-300">
              <Icon name={f.icon} className="size-4.5" />
            </span>
            <h3 className="mt-4 text-[1.05rem] font-semibold text-ink-50">{f.title}</h3>
            <p className="mt-2 text-pretty text-[0.85rem] leading-relaxed text-ink-400">{f.blurb}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <ButtonLink to="/features" variant="outline" iconRight="arrowRight">All capabilities</ButtonLink>
      </div>
    </Section>
  )
}

/* ----------------------------- how it works ---------------------------- */

function HowItWorks() {
  return (
    <div className="border-y border-ink-800 bg-ink-900/30">
      <Section>
        <SectionHeading
          eyebrow="How it works"
          title="From nothing to a running fleet in four moves"
          lead="No hardware to buy, no lead time, no ops rota. The whole lifecycle is a console screen or an API call."
        />
        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-700/70 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-ink-950 p-7">
              <span className="font-mono text-[0.72rem] font-semibold tracking-widest text-brand-400">{s.n}</span>
              <h3 className="mt-4 text-[1.05rem] font-semibold text-ink-50">{s.title}</h3>
              <p className="mt-2.5 text-pretty text-[0.85rem] leading-relaxed text-ink-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}

/* ------------------------------ solutions ------------------------------ */

function SolutionsPreview() {
  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Solutions"
          title="Whatever you run a lot of, run it here"
          lead="Eight patterns our customers repeat, each with the fleet shape and settings that make it work."
        />
        <ButtonLink to="/solutions" variant="outline" iconRight="arrowRight">Browse all</ButtonLink>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SOLUTIONS.slice(0, 8).map((s) => (
          <Link key={s.slug} to={`/solutions#${s.slug}`} className="group">
            <Card className="flex h-full flex-col p-6" hover>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-brand-300">{s.audience}</p>
              <h3 className="mt-3 text-[1rem] font-semibold leading-snug text-ink-50">{s.title}</h3>
              <p className="mt-2.5 flex-1 text-pretty text-[0.82rem] leading-relaxed text-ink-400">{s.problem}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[0.78rem] font-medium text-ink-300 transition-colors group-hover:text-brand-300">
                See the play
                <Icon name="arrowRight" className="size-3.5" />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </Section>
  )
}

/* --------------------------------- api --------------------------------- */

function ApiBand() {
  return (
    <div className="border-y border-ink-800 bg-ink-900/30">
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <SectionHeading
              eyebrow="Developers"
              title="Every console action is one HTTP call"
              lead="A flat JSON API over POST, authenticated with a single header. List and filter the fleet, boot and stop phones, rewrite fingerprints, install apps, run shell commands and read SMS."
            />
            <ul className="mt-8 space-y-3.5">
              {[
                ['Single header auth', `Send your key as ${API_KEY_HEADER}. Rotate it from the console at any time.`],
                ['Predictable envelope', 'Every response is { code, data, message }. Batch calls report success and failure per device.'],
                ['ADB when you need a shell', 'Run any command that finishes inside ten seconds, across up to twenty phones at once.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <Icon name="check" className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                  <span>
                    <span className="text-[0.88rem] font-medium text-ink-100">{t}</span>
                    <span className="mt-0.5 block text-[0.82rem] leading-relaxed text-ink-400">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/register" iconRight="arrowRight">Start with a free phone</ButtonLink>
              <ButtonLink to="/pricing" variant="outline">See pricing</ButtonLink>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[0.72rem] text-ink-500">
              <Icon name="terminal" className="size-3.5" />
              List every powered-on phone
            </div>
            <Code>{SAMPLE}</Code>
            <div className="mt-3">
              <Code>{`{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "7Uw0M",
        "name": "TikTok-US-014",
        "status": 1,
        "os": "Android 12",
        "ip": "104.28.61.19",
        "area": "United States",
        "adb": "adb.madova.net:20100",
        "expired_at": "2026-06-10 19:14:56"
      }
    ],
    "page": 1,
    "pagesize": 50,
    "total": 96,
    "total_page": 2
  },
  "message": "Success"
}`}</Code>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

/* -------------------------------- pricing ------------------------------ */

function PricingPreview() {
  return (
    <div className="border-y border-ink-800 bg-ink-900/30">
      <Section>
        <SectionHeading
          align="center"
          eyebrow="Pricing"
          title="Pay for the device, then for the minutes"
          lead="Two meters, both of which you control. Keep a phone for pennies a month and pay only for the time it actually spends powered on."
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-4">
          {PLANS.map((p) => (
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
              <h3 className="text-[0.95rem] font-semibold text-ink-50">{p.name}</h3>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold tracking-tight text-ink-50">{p.price}</span>
                <span className="text-[0.75rem] text-ink-400">{p.unit}</span>
              </p>
              <p className="mt-1 text-[0.72rem] text-ink-500">{p.cadence}</p>
              <p className="mt-4 flex-1 text-pretty text-[0.82rem] leading-relaxed text-ink-400">{p.pitch}</p>
              <ButtonLink
                to="/pricing"
                variant={p.featured ? 'primary' : 'secondary'}
                className="mt-6 w-full"
              >
                {p.cta}
              </ButtonLink>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-center text-[0.8rem] text-ink-500">
          Volume discounts to 95% off · Wholesale rates for resellers ·{' '}
          <Link to="/pricing" className="text-brand-300 hover:text-brand-200">Full pricing and the calculator →</Link>
        </p>
      </Section>
    </div>
  )
}

/* ----------------------------- testimonials ---------------------------- */

function Testimonials() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Customers"
        title="Teams that retired their phone farms"
      />
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <Card key={t.name} className="flex flex-col p-7" hover>
            <div className="flex gap-0.5 text-warn">
              {Array.from({ length: 5 }, (_, i) => (
                <Icon key={i} name="star" className="size-3.5" filled />
              ))}
            </div>
            <blockquote className="mt-5 flex-1 text-pretty text-[0.92rem] leading-relaxed text-ink-200">
              “{t.quote}”
            </blockquote>
            <footer className="mt-6 border-t border-ink-800 pt-4">
              <p className="text-[0.85rem] font-medium text-ink-100">{t.name}</p>
              <p className="mt-0.5 text-[0.76rem] text-ink-500">{t.role}</p>
            </footer>
          </Card>
        ))}
      </div>
    </Section>
  )
}

/* ---------------------------------- faq -------------------------------- */

function Faq() {
  return (
    <div className="border-t border-ink-800">
      <Section>
        <div className="grid gap-12 lg:grid-cols-[22rem_1fr]">
          <div>
            <SectionHeading eyebrow="FAQ" title="Questions we get before the first phone boots" />
            <p className="mt-6 text-[0.85rem] leading-relaxed text-ink-400">
              Not covered here?{' '}
              <Link to="/contact" className="text-brand-300 hover:text-brand-200">Ask us directly</Link> — we answer
              within a business day.
            </p>
          </div>
          <Accordion items={FAQS} />
        </div>
      </Section>
    </div>
  )
}

/* ------------------------------ final CTA ------------------------------ */

function FinalCta() {
  return (
    <div className="relative overflow-hidden border-t border-ink-800">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <Container className="relative py-24 text-center">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-50 sm:text-[2.75rem]">
          Boot your first cloud phone in the next sixty seconds
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[0.98rem] leading-relaxed text-ink-300">
          One phone, thirty days, thirty minutes of runtime — free, and no card. If it does not
          survive contact with your apps, you have lost nothing but a minute.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/console" size="lg" iconRight="arrowRight">Open the console</ButtonLink>
          <ButtonLink to="/contact" size="lg" variant="outline">Talk to sales</ButtonLink>
        </div>
      </Container>
    </div>
  )
}
