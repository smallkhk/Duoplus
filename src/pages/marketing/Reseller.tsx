import { useState } from 'react'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, ButtonLink, Card, Container, Field, Input, Section, SectionHeading, Select,
  Textarea, cx, useToast,
} from '@/components/ui'
import { RESELLER_TIERS } from '@/data/site'

const PLATFORM = [
  {
    icon: 'building',
    title: 'Sub-accounts with hard quotas',
    body: 'Each customer gets their own console, their own users and a device and minute quota you set. They cannot exceed it, and they never see anyone else\'s fleet.',
  },
  {
    icon: 'wallet',
    title: 'You set retail, we invoice wholesale',
    body: 'Price however your market bears — per phone, per seat, bundled into a service. You receive one consolidated invoice at wholesale rates on the first of the month.',
  },
  {
    icon: 'sparkle',
    title: 'Your brand, end to end',
    body: 'Custom domain, your logo and palette in the console, your name on transactional email. MADOVA does not appear anywhere your customers look.',
  },
  {
    icon: 'code',
    title: 'Wholesale API',
    body: 'Provision, suspend and meter sub-accounts programmatically, so signup on your side becomes a running fleet on ours without anyone touching a console.',
  },
  {
    icon: 'chart',
    title: 'Margin reporting',
    body: 'Per-customer cost, revenue and margin in one screen, exportable to CSV. You find out a client is unprofitable in week two, not at year end.',
  },
  {
    icon: 'users',
    title: 'A named partner manager',
    body: 'One person who knows your fleet, joins your customer calls when you want backup, and gives you capacity warnings before you hit them.',
  },
]

export function Reseller() {
  return (
    <>
      <div className="relative overflow-hidden border-b border-ink-800">
        <div className="pointer-events-none absolute inset-0 bg-aurora" />
        <div className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-50" />
        <Container className="relative py-20 sm:py-28">
          <div className="max-w-3xl">
            <Badge tone="brand">Partner programme</Badge>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.06] tracking-tight sm:text-[3.4rem]">
              Run a cloud phone business{' '}
              <span className="text-gradient">without running the infrastructure</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-[1.05rem] leading-relaxed text-ink-300">
              You have the customers, the market and the support relationship. MADOVA has the fleet,
              the control plane and the billing engine. Take wholesale rates from 30% off list, set
              your own retail pricing, and put your own name on all of it.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#apply" className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-500 px-6 text-[0.95rem] font-medium text-white shadow-[0_10px_30px_-12px] shadow-brand-500/70 transition-colors hover:bg-brand-400">
                Apply to the programme
                <Icon name="arrowRight" className="size-4" />
              </a>
              <ButtonLink to="/pricing#calculator" size="lg" variant="outline">Model your margin</ButtonLink>
            </div>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-700 bg-ink-700 lg:grid-cols-4">
            {[
              ['45%', 'Maximum wholesale discount'],
              ['Yours', 'Retail pricing and brand'],
              ['30 days', 'Net payment terms'],
              ['5,000+', 'Phones a partner can hold'],
            ].map(([v, l]) => (
              <div key={l} className="bg-ink-950 p-6">
                <dt className="font-mono text-[1.7rem] font-semibold leading-none text-ink-50">{v}</dt>
                <dd className="mt-2 text-[0.78rem] leading-snug text-ink-400">{l}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </div>

      <Section id="tiers">
        <SectionHeading
          eyebrow="Tiers"
          title="Three ways to partner"
          lead="Start by referring, grow into reselling, and take the whole thing white-label when your fleet justifies it. Moving up a tier takes an email, not a renegotiation."
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {RESELLER_TIERS.map((t) => (
            <Card
              key={t.name}
              className={cx('relative flex flex-col p-7', t.featured && 'border-brand-500/50 bg-brand-500/[0.04]')}
              hover={!t.featured}
            >
              {t.featured && (
                <span className="absolute -top-2.5 left-7 rounded-full bg-brand-500 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white">
                  Most partners
                </span>
              )}
              <h3 className="text-lg font-semibold text-ink-50">{t.name}</h3>
              <p className="mt-1.5 text-[0.78rem] text-ink-500">{t.fleet}</p>
              <p className="mt-5 font-mono text-2xl font-semibold tracking-tight text-brand-300">{t.discount}</p>
              <p className="mt-1.5 text-[0.8rem] text-ink-400">{t.margin}</p>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-ink-800 pt-5">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-ok" strokeWidth={2.6} />
                    <span className="text-[0.82rem] leading-snug text-ink-300">{p}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#apply"
                className={cx(
                  'mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors',
                  t.featured
                    ? 'bg-brand-500 text-white hover:bg-brand-400'
                    : 'bg-ink-800 text-ink-50 ring-1 ring-inset ring-ink-700 hover:bg-ink-700',
                )}
              >
                Apply
              </a>
            </Card>
          ))}
        </div>
      </Section>

      <div id="white-label" className="scroll-mt-20 border-y border-ink-800 bg-ink-900/30">
        <Section>
          <SectionHeading
            eyebrow="The platform"
            title="What you get on day one"
            lead="Not a discount code and a wish of luck — the operational machinery you would otherwise have to build before your first customer signs."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM.map((p) => (
              <Card key={p.title} className="p-7" hover>
                <span className="grid size-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                  <Icon name={p.icon} className="size-5" />
                </span>
                <h3 className="mt-5 text-[1.02rem] font-semibold text-ink-50">{p.title}</h3>
                <p className="mt-2.5 text-pretty text-[0.85rem] leading-relaxed text-ink-400">{p.body}</p>
              </Card>
            ))}
          </div>
        </Section>
      </div>

      <ApplyForm />
    </>
  )
}

function ApplyForm() {
  const toast = useToast()
  const [sent, setSent] = useState(false)

  return (
    <div id="apply" className="scroll-mt-20">
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading
              eyebrow="Apply"
              title="Tell us about your book of business"
              lead="We read every application ourselves. If cloud phones are not the right product for your customers we will say so rather than sign you up."
            />
            <ul className="mt-8 space-y-4">
              {[
                ['One business day', 'to a first reply from a person, not an autoresponder.'],
                ['A pilot fleet', 'provisioned free while we work through commercials.'],
                ['No exclusivity', 'and no minimum term — you can stop whenever you like.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <Icon name="check" className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                  <span className="text-[0.86rem] leading-relaxed text-ink-300">
                    <strong className="font-medium text-ink-100">{t}</strong> {d}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="p-7">
            {sent ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-ok/15 text-ok">
                  <Icon name="check" className="size-6" strokeWidth={2.4} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink-50">Application received</h3>
                <p className="mt-2 max-w-sm text-[0.85rem] leading-relaxed text-ink-400">
                  A partner manager will reply within one business day with wholesale rates and a
                  pilot fleet you can put in front of a customer.
                </p>
                <Button variant="ghost" className="mt-6" onClick={() => setSent(false)}>
                  Submit another
                </Button>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  setSent(true)
                  toast('Application submitted — we will reply within one business day.', 'ok')
                }}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Company"><Input required placeholder="Northwind Media" /></Field>
                  <Field label="Website"><Input placeholder="northwind.media" /></Field>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Your name"><Input required placeholder="Jules Ardan" /></Field>
                  <Field label="Work email"><Input required type="email" placeholder="jules@northwind.media" /></Field>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Tier you are after">
                    <Select defaultValue="Reseller">
                      {RESELLER_TIERS.map((t) => <option key={t.name}>{t.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Phones in year one">
                    <Select defaultValue="300–1,000">
                      {['Under 300', '300–1,000', '1,000–5,000', '5,000+'].map((o) => <option key={o}>{o}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Who are your customers, and what do they run?" hint="A couple of sentences is plenty.">
                  <Textarea rows={4} placeholder="We manage TikTok Shop storefronts for 60 sellers across SEA…" />
                </Field>
                <Button type="submit" size="lg" className="w-full" iconRight="arrowRight">
                  Submit application
                </Button>
                <p className="text-center text-[0.72rem] text-ink-500">
                  This demo form does not transmit anything — it renders the flow only.
                </p>
              </form>
            )}
          </Card>
        </div>
      </Section>
    </div>
  )
}
