import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Field, Input, Modal, Select, Tabs, Toggle, useToast,
} from '@/components/ui'
import { api, ApiError, type UserPrefs } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { getLang, setLang, type Lang } from '@/lib/duoplus/client'
import { BRAND } from '@/data/site'

type Tab = 'profile' | 'brand' | 'security' | 'notifications'

const TIMEZONES = [
  'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York',
  'America/Los_Angeles', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Dubai',
]

const NOTIFICATIONS: [string, string, boolean][] = [
  ['device_failed', 'A phone fails to configure', true],
  ['proxy_down', 'A proxy stops responding', true],
  ['expiring', 'A subscription is 7 days from expiring', true],
  ['quota', 'A sub-account passes 90% of its quota', true],
  ['task_failed', 'An automation task fails twice in a row', true],
  ['monthly', 'Monthly usage and margin summary', false],
  ['product', 'Product updates and changelog', false],
]

const SECURITY: [string, string, boolean][] = [
  ['require_2fa', 'Require two-factor authentication for every team member', false],
  ['ip_console', 'Restrict console sign-in to an IP allowlist', false],
  ['ip_adb', 'Restrict ADB connections to an IP allowlist', false],
  ['key_alerts', 'Email me whenever an API key is created or revoked', true],
]

export function Settings() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user, meta, refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')

  const [profile, setProfile] = useState({ name: '', company: '', timezone: 'UTC' })
  const [lang, setLangState] = useState<Lang>(getLang)
  const [brand, setBrand] = useState({
    display_name: '', console_domain: '', support_email: '', accent: '#6D5EF8',
  })
  const [notify, setNotify] = useState<Record<string, boolean>>({})
  const [security, setSecurity] = useState<Record<string, boolean>>({})

  const [passwords, setPasswords] = useState({ current: '', next: '' })
  const [closeOpen, setCloseOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const mailConfigured = Boolean(meta?.mail.configured)

  /* Seed the forms from the account once it has loaded. */
  useEffect(() => {
    if (!user) return
    const p = user.prefs ?? {}
    setProfile({ name: user.name, company: user.company, timezone: p.timezone ?? 'UTC' })
    setBrand({
      display_name: p.brand?.display_name ?? BRAND.name,
      console_domain: p.brand?.console_domain ?? '',
      support_email: p.brand?.support_email ?? user.email,
      accent: p.brand?.accent ?? '#6D5EF8',
    })
    setNotify({
      ...Object.fromEntries(NOTIFICATIONS.map(([k, , on]) => [k, on])),
      ...(p.notifications ?? {}),
    })
    setSecurity({
      ...Object.fromEntries(SECURITY.map(([k, , on]) => [k, on])),
      ...(p.security ?? {}),
    })
  }, [user])

  const save = async (what: string, patch: Parameters<typeof api.updateProfile>[0], done: string) => {
    setBusy(what)
    try {
      await api.updateProfile(patch)
      await refresh()
      toast(done, 'ok')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save that.', 'danger')
    } finally {
      setBusy(null)
    }
  }

  const changePassword = async () => {
    setBusy('password')
    try {
      await api.changePassword(passwords.current, passwords.next)
      setPasswords({ current: '', next: '' })
      toast('Password updated. Other sessions keep working until they expire.', 'ok')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not change your password.', 'danger')
    } finally {
      setBusy(null)
    }
  }

  const closeAccount = async () => {
    setBusy('close')
    try {
      await api.closeAccount(confirmEmail)
      await api.logout().catch(() => {})
      toast('Account closed.', 'ok')
      navigate('/')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not close the account.', 'danger')
    } finally {
      setBusy(null)
    }
  }

  /** A prefs patch that carries only the section being saved. */
  const prefsPatch = (part: UserPrefs) => ({ prefs: part })

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
                <Field label="Full name">
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </Field>
                <Field label="Email" hint="Contact support to change the address you sign in with.">
                  <Input type="email" value={user?.email ?? ''} readOnly className="opacity-70" />
                </Field>
                <Field label="Company">
                  <Input
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                  />
                </Field>
                <Field label="Timezone">
                  <Select
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  >
                    {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="mt-6 flex justify-end border-t border-ink-800 pt-5">
                <Button
                  loading={busy === 'profile'}
                  disabled={profile.name.trim().length < 2}
                  onClick={() => save('profile', {
                    name: profile.name,
                    company: profile.company,
                    prefs: { timezone: profile.timezone },
                  }, 'Profile saved.')}
                >
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
                <Select
                  value={lang}
                  onChange={(e) => {
                    const next = e.target.value as Lang
                    setLangState(next)
                    setLang(next)
                    void save('lang', prefsPatch({ language: next }), 'Language saved.')
                  }}
                >
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
                    Stored on your account and used wherever MADOVA addresses your customers on your
                    behalf — the support email on outbound mail, and the name on your own domain.
                  </p>
                </div>
                <Badge tone="brand">Partner feature</Badge>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Display name">
                  <Input
                    value={brand.display_name}
                    onChange={(e) => setBrand({ ...brand, display_name: e.target.value })}
                  />
                </Field>
                <Field label="Console domain" hint="Point a CNAME at this deployment, then set it here.">
                  <Input
                    value={brand.console_domain}
                    onChange={(e) => setBrand({ ...brand, console_domain: e.target.value })}
                    placeholder="console.your-domain.com"
                  />
                </Field>
                <Field label="Support email">
                  <Input
                    type="email"
                    value={brand.support_email}
                    onChange={(e) => setBrand({ ...brand, support_email: e.target.value })}
                  />
                </Field>
                <Field label="Accent colour">
                  <div className="flex gap-2">
                    <Input
                      value={brand.accent}
                      onChange={(e) => setBrand({ ...brand, accent: e.target.value })}
                      className="font-mono"
                    />
                    <span
                      className="size-10 shrink-0 rounded-lg ring-1 ring-inset ring-ink-700"
                      style={{ background: /^#[0-9a-fA-F]{3,8}$/.test(brand.accent) ? brand.accent : undefined }}
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-6 flex justify-end border-t border-ink-800 pt-5">
                <Button
                  loading={busy === 'brand'}
                  onClick={() => save('brand', prefsPatch({ brand }), 'Branding saved.')}
                >
                  Save branding
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Wholesale rates</h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-400">
                Device pricing steps down automatically with the size of your fleet — there is no tier
                to negotiate and no minimum to commit to.
              </p>
              <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 sm:grid-cols-3">
                {[
                  ['Model', 'Volume tiers'],
                  ['Best discount', '95% off list'],
                  ['Terms', 'Prepaid, on-chain'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-ink-950 p-4">
                    <dt className="text-[0.72rem] text-ink-500">{k}</dt>
                    <dd className="mt-1 font-mono text-[1rem] font-semibold text-ink-50">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </>
        )}

        {tab === 'security' && (
          <>
            <Card className="p-6">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Password</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label="Current password">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    placeholder="••••••••••"
                  />
                </Field>
                <Field label="New password" hint="At least 10 characters, including a number.">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={passwords.next}
                    onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                    placeholder="••••••••••"
                  />
                </Field>
              </div>
              <div className="mt-6 flex justify-end border-t border-ink-800 pt-5">
                <Button
                  loading={busy === 'password'}
                  disabled={!passwords.current || passwords.next.length < 10}
                  onClick={changePassword}
                >
                  Update password
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[0.95rem] font-semibold text-ink-50">Access controls</h2>
                <Button
                  size="sm" variant="secondary"
                  loading={busy === 'security'}
                  onClick={() => save('security', prefsPatch({ security }), 'Access controls saved.')}
                >
                  Save
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                {SECURITY.map(([key, label]) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    on={security[key] ?? false}
                    onChange={(v) => setSecurity({ ...security, [key]: v })}
                  />
                ))}
              </div>
            </Card>

            <Card className="border-danger/30 p-6">
              <h2 className="text-[0.95rem] font-semibold text-danger">Danger zone</h2>
              <p className="mt-2 max-w-lg text-[0.82rem] leading-relaxed text-ink-400">
                Closing the account releases every device, group, proxy, key and uploaded file
                irreversibly. Paid orders are kept as financial records. There is no undo.
              </p>
              <Button variant="danger" className="mt-5" onClick={() => setCloseOpen(true)}>
                Close account
              </Button>
            </Card>
          </>
        )}

        {tab === 'notifications' && (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">What we email you about</h2>
              <Button
                size="sm" variant="secondary"
                loading={busy === 'notify'}
                onClick={() => save('notify', prefsPatch({ notifications: notify }), 'Notification settings saved.')}
              >
                Save
              </Button>
            </div>

            {!mailConfigured && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/5 p-3.5">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
                <p className="text-[0.78rem] leading-relaxed text-ink-300">
                  No mail transport is configured on this server, so these choices are saved but
                  nothing is sent yet. Set{' '}
                  <code className="font-mono text-ink-200">MADOVA_SMTP_URL</code> to turn email on.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {NOTIFICATIONS.map(([key, label]) => (
                <ToggleRow
                  key={key}
                  label={label}
                  on={notify[key] ?? false}
                  onChange={(v) => setNotify({ ...notify, [key]: v })}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close this account?"
        description="Everything on it is deleted. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>Keep my account</Button>
            <Button
              variant="danger"
              loading={busy === 'close'}
              disabled={confirmEmail !== user?.email}
              onClick={closeAccount}
            >
              Close account permanently
            </Button>
          </>
        }
      >
        <Field label="Type your email address to confirm" hint={user?.email}>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={user?.email}
            autoComplete="off"
          />
        </Field>
      </Modal>
    </>
  )
}

function ToggleRow({
  label, on, onChange,
}: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-ink-950/60 px-4 py-3 ring-1 ring-inset ring-ink-800">
      <span className="text-[0.83rem] text-ink-200">{label}</span>
      <Toggle checked={on} onChange={onChange} label={label} />
    </div>
  )
}
