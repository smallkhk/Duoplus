import { useState } from 'react'
import { Icon } from '@/components/Icon'
import {
  Button, Card, Field, Input, Section, SectionHeading, Select, Textarea, useToast,
} from '@/components/ui'
import { BRAND } from '@/data/site'

const CHANNELS = [
  { icon: 'mail', label: 'General', value: BRAND.email, note: 'Replies within one business day.' },
  { icon: 'building', label: 'Partners & resellers', value: BRAND.sales, note: 'Wholesale rates and white-label.' },
  { icon: 'bolt', label: 'Status', value: BRAND.status, note: 'Incidents and maintenance windows.' },
]

export function Contact() {
  const toast = useToast()
  const [sent, setSent] = useState(false)

  return (
    <Section>
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <SectionHeading
            eyebrow="Contact"
            title="Talk to someone who runs fleets"
            lead="Sales here are engineers who operate the platform. Bring the awkward questions — proxy behaviour, detection specifics, whether your use case is a fit at all."
          />
          <ul className="mt-10 space-y-4">
            {CHANNELS.map((c) => (
              <li key={c.label}>
                <Card className="flex items-start gap-4 p-5" hover>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-800 text-brand-300">
                    <Icon name={c.icon} className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.72rem] uppercase tracking-wider text-ink-500">{c.label}</p>
                    <p className="mt-1 truncate text-[0.92rem] font-medium text-ink-50">{c.value}</p>
                    <p className="mt-0.5 text-[0.78rem] text-ink-400">{c.note}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="mt-6 p-6">
            <h3 className="text-[0.9rem] font-semibold text-ink-50">Before you write</h3>
            <p className="mt-2.5 text-[0.83rem] leading-relaxed text-ink-400">
              Most questions are answered faster by the docs. The{' '}
              <a href="/developers" className="text-brand-300 hover:text-brand-200">API reference</a>{' '}
              covers authentication, rate limits and every endpoint; the{' '}
              <a href="/pricing#calculator" className="text-brand-300 hover:text-brand-200">calculator</a>{' '}
              will price a fleet without anyone getting involved.
            </p>
          </Card>
        </div>

        <Card className="p-7">
          {sent ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-ok/15 text-ok">
                <Icon name="check" className="size-6" strokeWidth={2.4} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink-50">Message sent</h3>
              <p className="mt-2 max-w-sm text-[0.85rem] leading-relaxed text-ink-400">
                We will get back to you within one business day.
              </p>
              <Button variant="ghost" className="mt-6" onClick={() => setSent(false)}>Write another</Button>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault()
                setSent(true)
                toast('Message sent — expect a reply within one business day.', 'ok')
              }}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name"><Input required placeholder="Jules Ardan" /></Field>
                <Field label="Work email"><Input required type="email" placeholder="jules@northwind.media" /></Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="What is this about?">
                  <Select defaultValue="Sales">
                    {['Sales', 'Reseller programme', 'Technical question', 'Billing', 'Something else'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Fleet size you have in mind">
                  <Select defaultValue="50–500">
                    {['Just evaluating', 'Under 50', '50–500', '500–5,000', '5,000+'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Message">
                <Textarea rows={7} required placeholder="We run 300 TikTok Shop accounts across five markets and are on a physical phone farm today…" />
              </Field>
              <Button type="submit" size="lg" className="w-full" iconRight="arrowRight">Send message</Button>
              <p className="text-center text-[0.72rem] text-ink-500">
                This demo form does not transmit anything — it renders the flow only.
              </p>
            </form>
          )}
        </Card>
      </div>
    </Section>
  )
}
