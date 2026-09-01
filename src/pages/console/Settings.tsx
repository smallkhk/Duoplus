import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Field, Input, Select, Tabs, Toggle, useToast,
} from '@/components/ui'
import { BRAND } from '@/data/site'

type Tab = 'profile' | 'brand' | 'security' | 'notifications'

export function Settings() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <>
      <PageHeader
        title="Settings"
        lead="Account, white-label branding, security and notifications."
      />

      <Tabs<Tab>
        className="mb-5 max-w-lg"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'brand', label: 'White label' },
          { id: 'security', label: 'Security' },
          { id: 'notifications', label: 'Notifications' },
        ]}
      />

      <div className="max-w-3xl space-y-4">
        {tab === 'profile' && (
          <>
            <Card className="p-6">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Your details</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label="Full name"><Input defaultValue="Amara Osei" /></Field>
                <Field label="Email"><Input type="email" defaultValue="amara@madova.io" /></Field>
                <Field label="Company"><Input defaultValue="MADOVA" /></Field>
                <Field label="Timezone">
                  <Select defaultValue="Europe/London">
                    {['UTC', 'Europe/London', 'Europe/Berlin', 'America/Los_Angeles', 'Asia/Singapore'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-6 flex justify-end border-t border-ink-800 pt-5">
                <Button onClick={() => toast('Profile changes are not persisted in this demo build.', 'info')}>
                  Save changes
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Console language</h2>
              <p className="mt-1.5 text-[0.82rem] text-ink-400">
                Also sets the <code className="font-mono text-ink-300">Lang</code> header on API calls
                made from this console.
              </p>
              <Field className="mt-5 sm:max-w-xs" label="Language">
                <Select defaultValue="en">
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                  <option value="zh-TW">繁體中文</option>
                  <option value="ru">Русский</option>
                </Select>
              </Field>
            </Card>
          </>
        )}

        {tab === 'brand' && (
          <>
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[0.95rem] font-semibold text-ink-50">White-label console</h2>
                  <p className="mt-1.5 max-w-md text-[0.82rem] leading-relaxed text-ink-400">
                    Your sub-accounts see this branding instead of ours — in the console, on
                    transactional email and at your own domain.
                  </p>
                </div>
                <Badge tone="brand">Partner feature</Badge>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Display name"><Input defaultValue={BRAND.name} /></Field>
                <Field label="Console domain" hint="Point a CNAME at console.madova.net.">
                  <Input defaultValue="console.madova.io" />
                </Field>
                <Field label="Support email"><Input type="email" defaultValue={BRAND.email} /></Field>
                <Field label="Accent colour">
                  <div className="flex gap-2">
                    <Input defaultValue="#6D5EF8" className="font-mono" />
                    <span className="size-10 shrink-0 rounded-lg bg-brand-500 ring-1 ring-inset ring-ink-700" />
                  </div>
                </Field>
              </div>

              <div className="mt-6 space-y-3 border-t border-ink-800 pt-5">
                {[
                  ['Hide MADOVA branding entirely', true],
                  ['Send transactional email from your domain', true],
                  ['Use your logo on invoices', false],
                ].map(([label, on]) => (
                  <ToggleRow key={label as string} label={label as string} defaultOn={on as boolean} />
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Wholesale rates</h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-400">
                Your current partner tier and the discount applied to every device and minute you buy.
              </p>
              <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 sm:grid-cols-3">
                {[
                  ['Tier', 'Reseller'],
                  ['Discount', '30% off list'],
                  ['Terms', 'Net 30'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-ink-950 p-4">
                    <dt className="text-[0.72rem] text-ink-500">{k}</dt>
                    <dd className="mt-1 font-mono text-[1rem] font-semibold text-ink-50">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link
                to="/reseller"
                className="mt-5 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-brand-300 hover:text-brand-200"
              >
                Compare partner tiers
                <Icon name="arrowRight" className="size-3.5" />
              </Link>
            </Card>
          </>
        )}

        {tab === 'security' && (
          <>
            <Card className="p-6">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Password</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label="Current password"><Input type="password" placeholder="••••••••••" /></Field>
                <Field label="New password" hint="At least 10 characters, including a number.">
                  <Input type="password" placeholder="••••••••••" />
                </Field>
              </div>
              <div className="mt-6 flex justify-end border-t border-ink-800 pt-5">
                <Button onClick={() => toast('Password changes are not wired up in this demo build.', 'info')}>
                  Update password
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Access controls</h2>
              <div className="mt-5 space-y-3">
                <ToggleRow label="Require two-factor authentication for every team member" defaultOn />
                <ToggleRow label="Restrict console sign-in to an IP allowlist" defaultOn={false} />
                <ToggleRow label="Restrict ADB connections to an IP allowlist" defaultOn />
                <ToggleRow label="Email me whenever an API key is created or revoked" defaultOn />
              </div>
            </Card>

            <Card className="border-danger/30 p-6">
              <h2 className="text-[0.95rem] font-semibold text-danger">Danger zone</h2>
              <p className="mt-2 max-w-lg text-[0.82rem] leading-relaxed text-ink-400">
                Deleting the account releases every phone and its storage irreversibly, and cancels
                all sub-accounts. There is no undo and no backup.
              </p>
              <Button
                variant="danger" className="mt-5"
                onClick={() => toast('Account deletion is disabled in this demo build.', 'info')}
              >
                Delete account
              </Button>
            </Card>
          </>
        )}

        {tab === 'notifications' && (
          <Card className="p-6">
            <h2 className="text-[0.95rem] font-semibold text-ink-50">What we email you about</h2>
            <div className="mt-5 space-y-3">
              {[
                ['A phone fails to configure', true],
                ['A proxy stops responding', true],
                ['A subscription is 7 days from expiring', true],
                ['A sub-account passes 90% of its quota', true],
                ['An automation task fails twice in a row', true],
                ['Monthly usage and margin summary', false],
                ['Product updates and changelog', false],
              ].map(([label, on]) => (
                <ToggleRow key={label as string} label={label as string} defaultOn={on as boolean} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-ink-950/60 px-4 py-3 ring-1 ring-inset ring-ink-800">
      <span className="text-[0.83rem] text-ink-200">{label}</span>
      <Toggle checked={on} onChange={setOn} label={label} />
    </div>
  )
}
