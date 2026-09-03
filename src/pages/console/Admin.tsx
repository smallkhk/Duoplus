import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, CopyButton, Field, Input, Modal, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import {
  api, ApiError,
  type AdminSettings, type ApiKeyRecord, type ApiScope, type HealthCheck, type SettingField,
} from '@/lib/api'
import { useAuth } from '@/lib/auth'

const STATE_TONE: Record<HealthCheck['state'], 'ok' | 'warn' | 'neutral' | 'danger'> = {
  ok: 'ok', warn: 'warn', off: 'neutral', error: 'danger',
}

const STATE_LABEL: Record<HealthCheck['state'], string> = {
  ok: 'Ready', warn: 'Set this up', off: 'Off', error: 'Broken',
}

/** Which groups have a live test behind them, and what the button says. */
const TESTS: Record<string, { what: 'cloud' | 'assistant' | 'bsc' | 'tron'; label: string }> = {
  cloud: { what: 'cloud', label: 'Test the provider key' },
  assistant: { what: 'assistant', label: 'Send a test message' },
  payments_bsc: { what: 'bsc', label: 'Test the chain lookup' },
  payments_tron: { what: 'tron', label: 'Test the chain lookup' },
}

const SOURCE_NOTE: Record<SettingField['source'], string> = {
  admin: 'set here',
  env: 'from the server environment',
  default: 'default',
  unset: '',
}

export function Admin() {
  const toast = useToast()
  const { isAdmin, ready } = useAuth()

  const [settings, setSettings] = useState<AdminSettings | null>(null)
  /** Edits not yet saved, keyed by setting. */
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({})

  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null)
  const [scopes, setScopes] = useState<ApiScope[]>([])
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [keyScopes, setKeyScopes] = useState<string[]>(['phones:read'])
  const [issued, setIssued] = useState<{ key: ApiKeyRecord; secret: string } | null>(null)

  const [checking, setChecking] = useState(false)
  const [integration, setIntegration] = useState<{
    ok: boolean
    summary: string
    steps: { label: string; ok: boolean; detail: string }[]
  } | null>(null)
  const [revoking, setRevoking] = useState<ApiKeyRecord | null>(null)

  const load = useCallback(() => {
    api.adminSettings().then(setSettings).catch(() => setSettings(null))
    api.adminKeys().then((d) => { setKeys(d.keys); setScopes(d.scopes) }).catch(() => setKeys([]))
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (ready && !isAdmin) return <Navigate to="/console" replace />

  const valueOf = (field: SettingField) => draft[field.key] ?? field.value

  const saveGroup = async (groupId: string, fields: SettingField[]) => {
    const patch: Record<string, string> = {}
    for (const f of fields) if (f.key in draft) patch[f.key] = draft[f.key]
    if (Object.keys(patch).length === 0) {
      toast('Nothing changed in that section.', 'info')
      return
    }
    setSaving(groupId)
    try {
      const next = await api.saveAdminSettings(patch)
      setSettings(next)
      setDraft((d) => {
        const rest = { ...d }
        for (const key of Object.keys(patch)) delete rest[key]
        return rest
      })
      toast('Saved — it applies to the next request, no restart needed.', 'ok')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save that.', 'danger')
    } finally {
      setSaving(null)
    }
  }

  const runTest = async (groupId: string) => {
    const test = TESTS[groupId]
    if (!test) return
    setTesting(groupId)
    try {
      const result = await api.testConfig(test.what)
      setResults((r) => ({ ...r, [groupId]: result }))
    } catch (err) {
      setResults((r) => ({
        ...r,
        [groupId]: { ok: false, message: err instanceof ApiError ? err.message : 'The test could not run.' },
      }))
    } finally {
      setTesting(null)
    }
  }

  const createKey = async () => {
    setSaving('key')
    try {
      setIssued(await api.createAdminKey({ name: keyName, scopes: keyScopes }))
      setKeyOpen(false)
      setKeyName('')
      setKeyScopes(['phones:read'])
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create that key.', 'danger')
    } finally {
      setSaving(null)
    }
  }

  const revokeKey = async () => {
    if (!revoking) return
    setSaving('key')
    try {
      await api.revokeAdminKey(revoking.id)
      toast(`${revoking.name} revoked.`, 'ok')
      setRevoking(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not revoke that key.', 'danger')
    } finally {
      setSaving(null)
    }
  }

  const demoCheck = settings?.health.find((c) => c.id === 'demo') ?? null

  const runIntegration = async () => {
    setChecking(true)
    try {
      setIntegration(await api.checkIntegration())
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'The check could not run.', 'danger')
    } finally {
      setChecking(false)
    }
  }

  const purgeDemo = async () => {
    setSaving('demo')
    try {
      const result = await api.removeDemo()
      setSettings((s) => (s ? { ...s, health: result.health } : s))
      toast(result.message, 'ok')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove the demo data.', 'danger')
    } finally {
      setSaving(null)
    }
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const activeKeys = keys?.filter((k) => k.status === 'active') ?? []

  return (
    <>
      <PageHeader
        title="Site settings"
        lead="Everything MADOVA needs to take money and hand out phones. Saved here rather than in a file on the server, and applied on the next request — no restart, no shell."
      />

      {demoCheck && (
        <Card className="mb-4 border-danger/40 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger/12 text-danger">
                <Icon name="alert" className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[0.95rem] font-semibold text-danger">Demo data is still here</h2>
                <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-ink-300">
                  {demoCheck.detail} Removing it deletes the demo login and every device it owns.
                  Nothing of yours is touched.
                </p>
              </div>
            </div>
            <Button variant="danger" loading={saving === 'demo'} onClick={purgeDemo}>
              Remove demo data
            </Button>
          </div>
        </Card>
      )}

      {/* end-to-end device check */}
      <Card className="mb-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-brand-300">
              <Icon name="cpu" className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Check the device integration</h2>
              <p className="mt-1 max-w-xl text-[0.82rem] leading-relaxed text-ink-400">
                Reads your provider account end to end — credentials, devices, proxies and groups —
                and reports what it found. Every call is a read, so this spends{' '}
                <span className="text-ink-200">no runtime minutes</span>. Only powering a device on
                costs those.
              </p>
            </div>
          </div>
          <Button variant="secondary" loading={checking} onClick={runIntegration}>
            Run the check
          </Button>
        </div>

        {integration && (
          <div className="mt-5 space-y-2.5">
            {integration.steps.map((step, i) => (
              <div
                key={`${step.label}-${i}`}
                className="flex flex-wrap items-start gap-3 rounded-lg bg-ink-950/60 px-4 py-3 ring-1 ring-inset ring-ink-800"
              >
                <Badge tone={step.ok ? 'ok' : 'warn'}>{step.ok ? 'Pass' : 'Action'}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.84rem] font-medium text-ink-100">{step.label}</span>
                  <span className="mt-0.5 block text-[0.78rem] leading-relaxed text-ink-400">{step.detail}</span>
                </span>
              </div>
            ))}
            <p className={cx(
              'rounded-lg border p-3.5 text-[0.8rem] leading-relaxed',
              integration.ok
                ? 'border-ok/30 bg-ok/8 text-ink-200'
                : 'border-warn/30 bg-warn/8 text-ink-200',
            )}>
              {integration.summary}
            </p>
          </div>
        )}
      </Card>

      {/* what works right now */}
      <Card className="mb-4 p-6">
        <h2 className="text-[0.95rem] font-semibold text-ink-50">What is working</h2>
        <p className="mt-1 text-[0.8rem] text-ink-400">
          Read top to bottom, this is what a customer can and cannot do on your site today.
        </p>
        <ul className="mt-5 space-y-2.5">
          {settings === null && Array.from({ length: 5 }, (_, i) => (
            <li key={i}><Skeleton className="h-10 w-full" /></li>
          ))}
          {settings?.health.map((check, i) => (
            <li
              key={`${check.id}-${i}`}
              className="flex flex-wrap items-start gap-3 rounded-lg bg-ink-950/60 px-4 py-3 ring-1 ring-inset ring-ink-800"
            >
              <Badge tone={STATE_TONE[check.state]}>{STATE_LABEL[check.state]}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.84rem] font-medium text-ink-100">{check.label}</span>
                <span className="mt-0.5 block text-[0.78rem] leading-relaxed text-ink-400">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* the settings themselves */}
      <div className="space-y-4">
        {settings === null && Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="p-6"><Skeleton className="h-40 w-full" /></Card>
        ))}

        {settings?.groups.map((group) => {
          const test = TESTS[group.id]
          const result = results[group.id]
          const dirty = group.fields.some((f) => f.key in draft)
          return (
            <Card key={group.id} className="p-6" data-settings-group={group.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-brand-300">
                    <Icon name={group.icon} className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[0.95rem] font-semibold text-ink-50">{group.label}</h2>
                    <p className="mt-1 max-w-xl text-[0.8rem] leading-relaxed text-ink-400">{group.lead}</p>
                  </div>
                </div>
                {dirty && <Badge tone="warn">unsaved</Badge>}
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    hint={[field.hint, SOURCE_NOTE[field.source] && `(${SOURCE_NOTE[field.source]})`]
                      .filter(Boolean).join(' ')}
                    className={field.kind === 'select' || field.key.endsWith('_base') ? 'sm:col-span-2' : undefined}
                  >
                    {field.kind === 'select' ? (
                      <Select
                        value={valueOf(field)}
                        onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                      >
                        {(field.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type={field.kind === 'number' ? 'number' : 'text'}
                        value={valueOf(field)}
                        onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        className={field.kind === 'secret' ? 'font-mono text-[0.78rem]' : undefined}
                        onFocus={(e) => {
                          /* A masked secret clears on focus: typing replaces it,
                             leaving it alone keeps what is stored. */
                          if (field.kind === 'secret' && e.target.value.includes('•')) {
                            setDraft({ ...draft, [field.key]: '' })
                          }
                        }}
                      />
                    )}
                  </Field>
                ))}
              </div>

              {result && (
                <div className={cx(
                  'mt-5 flex items-start gap-2.5 rounded-lg border p-3.5',
                  result.ok ? 'border-ok/30 bg-ok/8' : 'border-danger/30 bg-danger/8',
                )}>
                  <Icon name={result.ok ? 'check' : 'alert'}
                    className={cx('mt-0.5 size-4 shrink-0', result.ok ? 'text-ok' : 'text-danger')} />
                  <p className="text-[0.8rem] leading-relaxed text-ink-200">{result.message}</p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-ink-800 pt-5">
                {test && (
                  <Button
                    variant="secondary"
                    loading={testing === group.id}
                    onClick={() => runTest(group.id)}
                  >
                    {test.label}
                  </Button>
                )}
                <Button
                  loading={saving === group.id}
                  disabled={!dirty}
                  onClick={() => saveGroup(group.id, group.fields)}
                >
                  Save changes
                </Button>
              </div>
            </Card>
          )
        })}

        {/* the operator's own API keys */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-brand-300">
                <Icon name="key" className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[0.95rem] font-semibold text-ink-50">Your API keys</h2>
                <p className="mt-1 max-w-xl text-[0.8rem] leading-relaxed text-ink-400">
                  For automating your own fleet from a script. These are yours alone — customers
                  never see this, and cannot mint one.
                </p>
              </div>
            </div>
            <Button size="sm" icon="plus" onClick={() => setKeyOpen(true)}>Create key</Button>
          </div>

          {activeKeys.length > 0 && (
            <ul className="mt-5 divide-y divide-ink-800 overflow-hidden rounded-xl ring-1 ring-inset ring-ink-800">
              {activeKeys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-3 bg-ink-950/50 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.84rem] font-medium text-ink-100">{k.name}</span>
                    <span className="block font-mono text-[0.7rem] text-ink-500">
                      {k.prefix}… · {k.scopes.join(', ')} · {k.last_used_at ? `used ${k.last_used_at.slice(0, 16)}` : 'never used'}
                    </span>
                  </span>
                  <button
                    onClick={() => setRevoking(k)}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                    aria-label={`Revoke ${k.name}`}
                  >
                    <Icon name="trash" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-5 border-t border-ink-800 pt-4 text-[0.78rem] leading-relaxed text-ink-500">
            Send one as <code className="font-mono text-ink-300">Authorization: Bearer …</code> against{' '}
            <code className="font-mono text-ink-300">{origin}/v1/…</code>
          </p>
        </Card>
      </div>

      {settings?.updated_at && (
        <p className="mt-4 text-center text-[0.74rem] text-ink-600">
          Last changed {settings.updated_at}
        </p>
      )}

      <Modal
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        title="Create an API key"
        description="Shown once, stored only as a hash. It cannot be recovered later."
        footer={
          <>
            <Button variant="ghost" onClick={() => setKeyOpen(false)}>Cancel</Button>
            <Button
              onClick={createKey}
              loading={saving === 'key'}
              disabled={keyName.trim().length < 2 || keyScopes.length === 0}
            >
              Create key
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name">
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Nightly restart script"
              autoFocus
            />
          </Field>
          <Field label="Scopes" hint="A key can only call what its scopes allow.">
            <div className="space-y-2">
              {scopes.map((sc) => (
                <label
                  key={sc.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-800 p-3 transition-colors hover:border-ink-700"
                >
                  <input
                    type="checkbox"
                    checked={keyScopes.includes(sc.id)}
                    onChange={() => setKeyScopes((cur) =>
                      cur.includes(sc.id) ? cur.filter((x) => x !== sc.id) : [...cur, sc.id])}
                    className="mt-0.5 size-4 accent-brand-500"
                  />
                  <span>
                    <code className="block font-mono text-[0.76rem] text-ink-100">{sc.id}</code>
                    <span className="block text-[0.76rem] text-ink-400">{sc.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title={`${issued?.key.name ?? 'Key'} is ready`}
        description="Copy it now. This is the only time it will be shown."
        footer={<Button onClick={() => setIssued(null)}>I have saved it</Button>}
      >
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/8 p-4">
          <code className="block break-all font-mono text-[0.8rem] text-ink-50">{issued?.secret}</code>
          <div className="mt-3"><CopyButton text={issued?.secret ?? ''} label="Copy key" /></div>
        </div>
      </Modal>

      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={`Revoke ${revoking?.name ?? ''}?`}
        description="Anything using this key stops working immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>Keep it</Button>
            <Button variant="danger" onClick={revokeKey} loading={saving === 'key'}>Revoke key</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">This cannot be undone.</p>
      </Modal>
    </>
  )
}
