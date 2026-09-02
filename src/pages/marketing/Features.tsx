import { Icon } from '@/components/Icon'
import { PhoneFrame } from '@/components/PhoneFrame'
import { Badge, ButtonLink, Card, Container, Section, SectionHeading, cx } from '@/components/ui'
import { FEATURES } from '@/data/site'

const COMPARISON = [
  ['Hardware', 'Real ARM Android, racked', 'x86 emulator on a server', 'Physical handsets you own'],
  ['Provisioning', 'Seconds, self-serve', 'Minutes', 'Weeks of procurement'],
  ['Identity per device', 'Independent, rewritable', 'Often shared', 'Fixed to the hardware'],
  ['Scale limit', 'None', 'Host CPU', 'Desk space and power'],
  ['Runtime cost', 'Per minute powered on', 'Per host hour', 'Sunk hardware + electricity'],
  ['Remote access', 'Browser, mobile, API, ADB', 'Varies', 'A person in the room'],
]

export function Features() {
  return (
    <>
      <div className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
        <Container className="relative py-20 sm:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300">Capabilities</p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Eleven things that make a cloud phone{' '}
              <span className="text-gradient">indistinguishable from a real one</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-[1.05rem] leading-relaxed text-ink-300">
              Every one of these exists because an app somewhere checks for it. Together they are the
              difference between a device that passes and a device that gets a whole roster of
              accounts linked.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/console" iconRight="arrowRight">Try it free</ButtonLink>
              <ButtonLink to="/knowledge" variant="outline" icon="message">Help centre</ButtonLink>
            </div>
          </div>
        </Container>
      </div>

      <Section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <a key={f.slug} href={`#${f.slug}`} className="group">
              <Card className="flex h-full items-start gap-3 p-5" hover>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-brand-300 transition-colors group-hover:bg-brand-500/15">
                  <Icon name={f.icon} className="size-4" />
                </span>
                <span>
                  <span className="block text-[0.9rem] font-medium text-ink-50">{f.title}</span>
                  <span className="mt-1 block text-[0.78rem] leading-snug text-ink-400">{f.blurb}</span>
                </span>
              </Card>
            </a>
          ))}
        </div>
      </Section>

      <div className="border-y border-ink-800">
        {FEATURES.map((f, i) => (
          <div
            key={f.slug}
            id={f.slug}
            className={cx('scroll-mt-20 border-b border-ink-800 last:border-b-0', i % 2 === 1 && 'bg-ink-900/30')}
          >
            <Container>
              <div className={cx(
                'grid items-center gap-12 py-16 lg:grid-cols-[1fr_0.7fr] [&>*]:min-w-0',
                i % 2 === 1 && 'lg:[&>*:first-child]:order-2',
              )}>
                <div>
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                    <Icon name={f.icon} className="size-5" />
                  </span>
                  <h2 className="mt-6 text-balance text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">
                    {f.title}
                  </h2>
                  <p className="mt-4 max-w-xl text-pretty text-[1rem] leading-relaxed text-ink-300">{f.blurb}</p>
                  <p className="mt-4 max-w-xl text-pretty text-[0.9rem] leading-relaxed text-ink-400">{f.detail}</p>
                </div>
                <FeatureArt slug={f.slug} />
              </div>
            </Container>
          </div>
        ))}
      </div>

      <Section>
        <SectionHeading
          eyebrow="Comparison"
          title="Cloud phone, emulator, or a rack of handsets"
          lead="The three ways teams run many Android identities at once, and what each one actually costs you."
        />
        <div className="mt-12 overflow-x-auto rounded-2xl border border-ink-700/70">
          <table className="w-full min-w-[46rem] border-collapse text-left text-[0.85rem]">
            <thead>
              <tr className="border-b border-ink-700/70 bg-ink-900/70">
                <th className="px-5 py-4 font-medium text-ink-400"></th>
                <th className="px-5 py-4 font-semibold text-brand-300">MADOVA cloud phone</th>
                <th className="px-5 py-4 font-medium text-ink-300">Android emulator</th>
                <th className="px-5 py-4 font-medium text-ink-300">Physical phone farm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {COMPARISON.map(([label, a, b, c]) => (
                <tr key={label}>
                  <th scope="row" className="px-5 py-4 font-medium text-ink-300">{label}</th>
                  <td className="px-5 py-4 text-ink-100">{a}</td>
                  <td className="px-5 py-4 text-ink-400">{b}</td>
                  <td className="px-5 py-4 text-ink-400">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

/** Small bespoke illustration per feature, so the page is not eleven identical rows. */
function FeatureArt({ slug }: { slug: string }) {
  if (slug === 'real-arm' || slug === 'anywhere' || slug === 'streaming') {
    return (
      <div className="flex justify-center">
        <PhoneFrame className="w-40" />
      </div>
    )
  }

  if (slug === 'geo') {
    return (
      <Card className="p-6">
        <p className="text-[0.7rem] uppercase tracking-wider text-ink-500">Location stack</p>
        <ul className="mt-4 space-y-3">
          {[
            ['Proxy exit', 'Los Angeles · 104.28.61.19', 'route'],
            ['GPS fix', '34.0522, −118.2437', 'globe'],
            ['SIM identity', 'T-Mobile · MCC 310 / MNC 260', 'phone'],
            ['Serving cell', 'LAC 7241 · CID 118392', 'server'],
          ].map(([label, value, icon]) => (
            <li key={label} className="flex items-center gap-3 rounded-lg bg-ink-950/60 p-3">
              <Icon name={icon} className="size-4 shrink-0 text-brand-300" />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.75rem] text-ink-400">{label}</span>
                <span className="block truncate font-mono text-[0.78rem] text-ink-100">{value}</span>
              </span>
              <Icon name="check" className="size-3.5 shrink-0 text-ok" strokeWidth={2.6} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.72rem] leading-relaxed text-ink-500">
          All four agree, because MADOVA derives them from one another rather than leaving you to
          keep them in sync.
        </p>
      </Card>
    )
  }

  if (slug === 'api' || slug === 'automation') {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-700/70 px-4 py-2.5">
          <span className="size-2 rounded-full bg-danger/60" />
          <span className="size-2 rounded-full bg-warn/60" />
          <span className="size-2 rounded-full bg-ok/60" />
          <span className="ml-2 font-mono text-[0.68rem] text-ink-500">fleet.ts</span>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[0.72rem] leading-relaxed text-ink-300">
{`const fleet = await madova.post(
  '/api/v1/cloudPhone/list',
  { link_status: ['2'], group_id: '9JKzb' }
)

await madova.post(
  '/api/v1/cloudPhone/batchPowerOn',
  { image_ids: fleet.list.map(p => p.id) }
)

await madova.post(
  '/api/v1/cloudPhone/command',
  { image_ids: ids, command: 'input swipe 540 1600 540 400' }
)`}
        </pre>
      </Card>
    )
  }

  if (slug === 'numbers') {
    return (
      <Card className="p-6">
        <p className="text-[0.7rem] uppercase tracking-wider text-ink-500">Inbox · +1 415 555 0142</p>
        <ul className="mt-4 space-y-2.5">
          {[
            ['419283', '[TikTok] 419283 is your verification code', '10:10'],
            ['772104', 'Instagram: 772104 is your login code', '09:41'],
            ['205118', 'Your WhatsApp code: 205-118', '22:03'],
          ].map(([code, msg, at]) => (
            <li key={code} className="rounded-lg bg-ink-950/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.95rem] font-semibold text-accent-300">{code}</span>
                <span className="font-mono text-[0.68rem] text-ink-500">{at}</span>
              </div>
              <p className="mt-1 truncate text-[0.75rem] text-ink-400">{msg}</p>
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  if (slug === 'team') {
    return (
      <Card className="p-6">
        <p className="text-[0.7rem] uppercase tracking-wider text-ink-500">Access</p>
        <ul className="mt-4 space-y-2.5">
          {[
            ['Amara Osei', 'Owner', 'brand'],
            ['Dmitri Volkov', 'Admin', 'accent'],
            ['Priya Raman', 'Operator', 'neutral'],
            ['Wei Chen', 'Viewer', 'neutral'],
          ].map(([name, role, tone]) => (
            <li key={name} className="flex items-center justify-between gap-3 rounded-lg bg-ink-950/60 px-3 py-2.5">
              <span className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-full bg-ink-800 text-[0.65rem] font-semibold text-ink-300">
                  {name.split(' ').map((n) => n[0]).join('')}
                </span>
                <span className="text-[0.82rem] text-ink-100">{name}</span>
              </span>
              <Badge tone={tone as 'brand' | 'accent' | 'neutral'}>{role}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  /* Default: a compact fleet grid. */
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className={cx(
            'aspect-[9/16] rounded-lg border',
            i % 5 === 0
              ? 'border-brand-500/50 bg-brand-500/10'
              : i % 7 === 0
                ? 'border-ink-800 bg-ink-900/40'
                : 'border-ink-700 bg-ink-900',
          )}
        />
      ))}
    </div>
  )
}
