import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Badge, ButtonLink, Card, Container, Section, SectionHeading, cx } from '@/components/ui'
import { SOLUTIONS } from '@/data/site'

export function Solutions() {
  return (
    <>
      <div className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
        <Container className="relative py-20 sm:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300">Solutions</p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Eight ways teams put a{' '}
              <span className="text-gradient">thousand phones</span> to work
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-[1.05rem] leading-relaxed text-ink-300">
              Each of these is a pattern we see repeatedly, written down: the problem that forces
              people onto cloud phones, the fleet settings that actually make it work, and the scale
              customers land on.
            </p>
          </div>
          <nav className="mt-9 flex flex-wrap gap-2">
            {SOLUTIONS.map((s) => (
              <a
                key={s.slug}
                href={`#${s.slug}`}
                className="rounded-full border border-ink-700 bg-ink-900/60 px-3.5 py-1.5 text-[0.78rem] text-ink-300 transition-colors hover:border-brand-500/50 hover:text-ink-50"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </Container>
      </div>

      {SOLUTIONS.map((s, i) => (
        <div
          key={s.slug}
          id={s.slug}
          className={cx('scroll-mt-20 border-b border-ink-800', i % 2 === 1 && 'bg-ink-900/30')}
        >
          <Container>
            <div className="grid gap-10 py-16 lg:grid-cols-[1fr_1fr]">
              <div>
                <Badge tone="brand">{s.audience}</Badge>
                <h2 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-ink-50 sm:text-[1.9rem]">
                  {s.title}
                </h2>
                <p className="mt-5 max-w-xl text-pretty text-[0.98rem] leading-relaxed text-ink-300">
                  {s.problem}
                </p>
                <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink-900/70 px-3 py-2 text-[0.8rem] text-ink-300 ring-1 ring-inset ring-ink-700">
                  <Icon name="chart" className="size-4 text-accent-300" />
                  {s.metric}
                </p>
              </div>

              <Card className="p-7">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-400">
                  The play
                </p>
                <ol className="mt-5 space-y-4">
                  {s.play.map((step, n) => (
                    <li key={step} className="flex gap-3.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-500/15 font-mono text-[0.68rem] font-semibold text-brand-300">
                        {n + 1}
                      </span>
                      <span className="text-pretty text-[0.87rem] leading-relaxed text-ink-200">{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-7 flex flex-wrap gap-2.5 border-t border-ink-800 pt-5">
                  <ButtonLink to="/console" size="sm" iconRight="arrowRight">Start free</ButtonLink>
                  <ButtonLink to="/contact" size="sm" variant="ghost">Discuss this setup</ButtonLink>
                </div>
              </Card>
            </div>
          </Container>
        </div>
      ))}

      <Section>
        <SectionHeading
          align="center"
          title="Not sure which shape fits?"
          lead="Tell us what you run and how many accounts are involved. We will size a fleet, quote it, and say plainly if cloud phones are the wrong tool for it."
        />
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/contact" size="lg" iconRight="arrowRight">Talk to sales</ButtonLink>
          <ButtonLink to="/pricing" size="lg" variant="outline">Price it yourself</ButtonLink>
        </div>
        <p className="mt-6 text-center text-[0.8rem] text-ink-500">
          Running a large fleet?{' '}
          <Link to="/pricing" className="text-brand-300 hover:text-brand-200">Pricing drops as it grows →</Link>
        </p>
      </Section>
    </>
  )
}
