import { useParams, Link } from 'react-router-dom'
import { Container, Section, cx } from '@/components/ui'
import { BRAND } from '@/data/site'

const DOCS: Record<string, { title: string; updated: string; intro: string; sections: { h: string; p: string[] }[] }> = {
  terms: {
    title: 'Terms of service',
    updated: '1 August 2026',
    intro: `These terms govern your use of ${BRAND.name} cloud phones, the console and the API. They are written to be read, not to be survived.`,
    sections: [
      {
        h: 'The service',
        p: [
          `${BRAND.name} provides access to Android devices hosted on our infrastructure, resold under licence from our upstream capacity provider. You get an isolated environment, storage and device identity for each phone you hold.`,
          'We do not guarantee that any third-party application will permit, tolerate or continue to work with a cloud phone. Platform policies change and are outside our control.',
        ],
      },
      {
        h: 'Your account',
        p: [
          'You are responsible for everything done with your credentials and API keys. Keys can be rotated at any time from the console, and you should rotate one immediately if you believe it has leaked.',
          'One account may hold many phones and many team members. Sharing a single login between people is a bad idea and is not supported — invite team members instead.',
        ],
      },
      {
        h: 'Billing',
        p: [
          'Devices are billed monthly for as long as you hold them. Runtime is billed either per startup minute or on a flat monthly subscription, whichever you have configured for each phone.',
          'Prepaid minute packages do not expire. Device subscriptions renew automatically unless auto-renewal is switched off, and a phone whose subscription lapses moves to Renewal overdue before its storage is released.',
          'Fees are exclusive of tax. Invoices are due on receipt; partner accounts are net 30.',
        ],
      },
      {
        h: 'Suspension',
        p: [
          'We may suspend a phone, an account or an API key that is causing harm to the platform, to another customer, or to a third party — most commonly for the activity described in the acceptable use policy.',
          'Where suspension is not urgent we will tell you first and give you a chance to fix it.',
        ],
      },
      {
        h: 'Liability',
        p: [
          'Our liability in any twelve-month period is limited to the fees you paid us in that period. We are not liable for lost profits, lost accounts, or the consequences of a third-party platform banning you.',
          'Nothing here limits liability that cannot be limited by law.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    updated: '1 August 2026',
    intro: `What ${BRAND.name} collects, why, and what we do not want to know.`,
    sections: [
      {
        h: 'What we collect',
        p: [
          'Account data: your name, work email, company and billing details. Usage data: which phones exist, when they were powered on, how many minutes they consumed, and which API endpoints your key called.',
          'Operational logs: request metadata, error traces and proxy health results, retained for 30 days for debugging and abuse investigation.',
        ],
      },
      {
        h: 'What we do not collect',
        p: [
          'We do not inspect the contents of your device storage, read the accounts you log into, or index the screens you view. Device storage is yours.',
          'We do not sell customer data, and we do not use your usage patterns to train anything.',
        ],
      },
      {
        h: 'Sub-processors',
        p: [
          'Our upstream capacity provider hosts the physical devices. Payments are handled by our payment processor. Transactional email goes through our email provider. Each holds only the data required to perform its function.',
        ],
      },
      {
        h: 'Your rights',
        p: [
          `Ask us for a copy of your data, ask us to correct it, or ask us to delete it — write to ${BRAND.email} and we will act within 30 days. Deleting an account releases its device storage irreversibly.`,
        ],
      },
    ],
  },
  aup: {
    title: 'Acceptable use policy',
    updated: '1 August 2026',
    intro: 'Cloud phones are general-purpose infrastructure. This is the short list of things you may not do with ours.',
    sections: [
      {
        h: 'Not permitted',
        p: [
          'Fraud of any kind — payment fraud, identity theft, phishing pages, fake storefronts, or impersonating a real person or organisation.',
          'Distributing malware, running botnet nodes, or using phones to attack, scan or overload systems you do not own.',
          'Content that sexualises minors, incites violence, or is illegal in the jurisdiction it is served from or to.',
          'Bulk unsolicited messaging, SMS pumping, or reselling access to numbers for one-time-code arbitrage.',
        ],
      },
      {
        h: 'Your responsibility as a reseller',
        p: [
          'If you resell MADOVA capacity, this policy flows down to your customers and you are responsible for enforcing it. We will ask you to act on a sub-account before we act on it ourselves, unless the harm is ongoing.',
        ],
      },
      {
        h: 'Reporting',
        p: [
          `Report abuse to ${BRAND.email}. Include the phone ID, IP or sub-account where you can — it lets us act in hours rather than days.`,
        ],
      },
    ],
  },
}

export function Legal() {
  const { doc = 'terms' } = useParams()
  const content = DOCS[doc] ?? DOCS.terms

  return (
    <Section>
      <Container className="!px-0">
        <div className="grid gap-12 lg:grid-cols-[14rem_1fr]">
          <nav className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-500">Legal</p>
            <ul className="mt-4 space-y-1">
              {Object.entries(DOCS).map(([slug, d]) => (
                <li key={slug}>
                  <Link
                    to={`/legal/${slug}`}
                    className={cx(
                      'block rounded-lg px-3 py-2 text-[0.83rem] transition-colors',
                      slug === doc ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-100',
                    )}
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <article className="max-w-2xl">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
              {content.title}
            </h1>
            <p className="mt-3 font-mono text-[0.75rem] text-ink-500">Last updated {content.updated}</p>
            <p className="mt-6 text-pretty text-[1rem] leading-relaxed text-ink-300">{content.intro}</p>

            {content.sections.map((s) => (
              <section key={s.h} className="mt-10">
                <h2 className="text-[1.15rem] font-semibold text-ink-50">{s.h}</h2>
                {s.p.map((para, i) => (
                  <p key={i} className="mt-3.5 text-pretty text-[0.9rem] leading-relaxed text-ink-300">{para}</p>
                ))}
              </section>
            ))}

            <p className="mt-14 rounded-xl border border-ink-700/70 bg-ink-900/50 p-5 text-[0.8rem] leading-relaxed text-ink-400">
              This is demonstration copy for a portfolio build of the {BRAND.name} site. It is not
              legal advice and has not been reviewed by a lawyer.
            </p>
          </article>
        </div>
      </Container>
    </Section>
  )
}
