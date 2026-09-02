import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Code, CopyButton, Field, Input, Modal, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { api, ApiError, type ApiKeyRecord, type ApiScope } from '@/lib/api'
import { getLang, getRequestLog, setLang, type Lang, type RequestLogEntry } from '@/lib/duoplus/client'
import { useAuth } from '@/lib/auth'
import { API_BASE_URL, API_QPS_LIMIT, ENDPOINTS } from '@/lib/duoplus/endpoints'

/** The public API is served from this deployment, so the origin is the base URL. */
const origin = typeof window === 'undefined' ? 'https://your-madova-domain' : window.location.origin

export function ApiKeys() {
  const toast = useToast()
  const { meta } = useAuth()
  const [lang, setLangState] = useState<Lang>(getLang)
  const [log, setLog] = useState<RequestLogEntry[]>(getRequestLog())

  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null)
  const [scopes, setScopes] = useState<ApiScope[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<string[]>(['phones:read'])
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<ApiKeyRecord | null>(null)
  /** The one moment a secret is visible. Cleared as soon as the dialog closes. */
  const [issued, setIssued] = useState<{ key: ApiKeyRecord; secret: string } | null>(null)

  const upstream = Boolean(meta?.cloud.upstream)

  const load = useCallback(() => {
    api.keys()
      .then((d) => { setKeys(d.keys); setScopes(d.scopes) })
      .catch(() => setKeys([]))
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    setBusy(true)
    try {
      const result = await api.createKey({ name, scopes: chosen })
      setIssued(result)
      setCreateOpen(false)
      setName('')
      setChosen(['phones:read'])
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create that key.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const rotate = async (key: ApiKeyRecord) => {
    try {
      setIssued(await api.rotateKey(key.id))
      toast(`${key.name} rotated — the old secret stopped working immediately.`, 'ok')
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not rotate that key.', 'danger')
    }
  }

  const revoke = async () => {
    if (!revoking) return
    setBusy(true)
    try {
      await api.revokeKey(revoking.id)
      toast(`${revoking.name} revoked.`, 'ok')
      setRevoking(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not revoke that key.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const toggleScope = (id: string) =>
    setChosen((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]))

  const active = keys?.filter((k) => k.status === 'active') ?? []

  useEffect(() => {
    const sync = () => setLog([...getRequestLog()])
    window.addEventListener('madova:request', sync)
    return () => window.removeEventListener('madova:request', sync)
  }, [])

  return (
    <>
      <PageHeader
        title="API"
        lead="Keys, connection mode and a live log of every call this console has made. The endpoints are documented in full on the developer reference."
        actions={
          <>
            <Link
              to="/developers"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-medium text-ink-100 ring-1 ring-inset ring-ink-700 transition-colors hover:bg-ink-800/70"
            >
              <Icon name="code" className="size-4" />
              API reference
            </Link>
            <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>Create key</Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <div className="space-y-4">
          {/* connection */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[0.95rem] font-semibold text-ink-50">Where device calls go</h2>
                <p className="mt-1.5 max-w-md text-[0.82rem] leading-relaxed text-ink-400">
                  The browser never holds a cloud phone key. Every call from this console posts to
                  the MADOVA API server, which attaches the key and decides where it resolves.
                </p>
              </div>
              <span className={cx(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[0.78rem] font-medium ring-1 ring-inset',
                upstream ? 'bg-ok/10 text-ok ring-ok/30' : 'bg-ink-900 text-ink-400 ring-ink-700',
              )}>
                <span className={cx('size-1.5 rounded-full', upstream ? 'animate-pulse-dot bg-ok' : 'bg-ink-500')} />
                {upstream ? 'Live upstream' : 'MADOVA engine'}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-lg bg-ink-950/60 p-4 ring-1 ring-inset ring-ink-800">
                <p className="text-[0.85rem] font-medium text-ink-100">
                  {upstream ? 'Forwarding to the upstream API' : 'Served by this server'}
                </p>
                <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-400">
                  {upstream
                    ? <>Calls are forwarded to <code className="font-mono text-ink-300">{API_BASE_URL}</code> with the
                       account key, serialised to respect the 1 QPS per-endpoint limit.</>
                    : <>No upstream key is configured, so the server answers from its own device engine.
                       Everything you do here is real and persists — it just is not talking to the
                       upstream fleet. Set <code className="font-mono text-ink-300">MADOVA_UPSTREAM_KEY</code> on
                       the server to forward instead.</>}
                </p>
              </div>

              <Field label="Lang header" hint="Sets the language of human-readable messages in API responses.">
                <Select
                  value={lang}
                  onChange={(e) => {
                    const next = e.target.value as Lang
                    setLangState(next)
                    setLang(next)
                    toast(`Lang header set to ${next}.`, 'ok')
                  }}
                  className="sm:!w-48"
                >
                  <option value="en">en — English</option>
                  <option value="zh">zh — 简体中文</option>
                  <option value="zh-TW">zh-TW — 繁體中文</option>
                  <option value="ru">ru — Русский</option>
                </Select>
              </Field>
            </div>
          </Card>

          {/* keys */}
          <Card className="overflow-hidden">
            <div className="border-b border-ink-800 px-6 py-4">
              <h2 className="text-[0.95rem] font-semibold text-ink-50">Keys</h2>
              <p className="mt-1 text-[0.8rem] text-ink-400">
                Each key carries only the scopes you grant it. Rotating issues a new secret and retires the old one; revoking takes effect immediately.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-[0.82rem]">
                <thead>
                  <tr className="border-b border-ink-800 text-[0.7rem] uppercase tracking-wider text-ink-500">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Key</th>
                    <th className="px-6 py-3 font-medium">Scopes</th>
                    <th className="px-6 py-3 font-medium">Last used</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {keys === null && Array.from({ length: 3 }, (_, i) => (
                    <tr key={i}>{Array.from({ length: 5 }, (_, j) => (
                      <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                    ))}</tr>
                  ))}

                  {keys?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-[0.82rem] text-ink-500">
                        No keys yet. Create one to call the API from your own code.
                      </td>
                    </tr>
                  )}

                  {keys?.map((k) => (
                    <tr key={k.id} className={cx('transition-colors hover:bg-ink-800/40', k.revoked_at && 'opacity-55')}>
                      <td className="px-6 py-3.5">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-ink-100">{k.name}</span>
                          {k.revoked_at && <Badge tone="danger">revoked</Badge>}
                        </span>
                        <span className="block text-[0.7rem] text-ink-500">Created {k.created_at.slice(0, 10)}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <code className="font-mono text-[0.74rem] text-ink-300">{k.prefix}…</code>
                        <span className="block text-[0.68rem] text-ink-600">shown once at creation</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="flex flex-wrap gap-1">
                          {k.scopes.map((sc) => (
                            <span key={sc} className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[0.66rem] text-ink-300">
                              {sc}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-ink-400">
                        {k.last_used_at ? k.last_used_at.slice(0, 16) : 'never'}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex justify-end gap-1">
                          {!k.revoked_at && (
                            <>
                              <button
                                onClick={() => rotate(k)}
                                className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                                aria-label={`Rotate ${k.name}`}
                                title="Rotate — issues a new secret and kills this one"
                              >
                                <Icon name="refresh" className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setRevoking(k)}
                                className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                                aria-label={`Revoke ${k.name}`}
                              >
                                <Icon name="trash" className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* quickstart */}
          <Card className="p-6">
            <h2 className="text-[0.95rem] font-semibold text-ink-50">Your first call</h2>
            <p className="mt-1.5 mb-4 text-[0.82rem] text-ink-400">
              Every endpoint is a POST that takes JSON and returns the same envelope.
            </p>
            <Code>{`curl -X POST ${origin}/v1/cloudPhone/list \\
  -H "Content-Type: application/json" \\
  -H "Lang: ${lang}" \\
  -H "Authorization: Bearer $MADOVA_KEY" \\
  -d '{"page":1,"pagesize":10}'`}</Code>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[0.75rem] text-ink-500">
                {ENDPOINTS.length} endpoints documented · {API_QPS_LIMIT} QPS per endpoint ·{' '}
                {active.length} active key{active.length === 1 ? '' : 's'}
              </p>
              <CopyButton
                text={`curl -X POST ${origin}/v1/cloudPhone/list -H "Content-Type: application/json" -H "Authorization: Bearer $MADOVA_KEY" -d '{"page":1,"pagesize":10}'`}
                label="Copy command"
              />
            </div>
          </Card>
        </div>

        {/* request log */}
        <Card className="flex max-h-[46rem] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
            <div>
              <h2 className="text-[0.9rem] font-semibold text-ink-50">Request log</h2>
              <p className="mt-0.5 text-[0.74rem] text-ink-400">Calls made by this console session.</p>
            </div>
            <Badge tone="neutral">{log.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto">
            {log.length === 0 ? (
              <p className="px-5 py-10 text-center text-[0.8rem] text-ink-500">
                No calls yet. Open the fleet table to generate some.
              </p>
            ) : (
              <ul className="divide-y divide-ink-800">
                {log.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <code className="min-w-0 truncate font-mono text-[0.72rem] text-ink-200">{entry.path}</code>
                      <Badge tone={entry.ok ? 'ok' : 'danger'}>{entry.code || 'ERR'}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2.5 font-mono text-[0.66rem] text-ink-500">
                      <span>{entry.at}</span>
                      <span>·</span>
                      <span>{entry.ms} ms</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create an API key"
        description="Keys are shown once. Store it somewhere your code can read it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={busy} disabled={name.trim().length < 2 || chosen.length === 0}>
              Create key
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name" hint="Something you will recognise in the log six months from now.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production scheduler"
              autoFocus
            />
          </Field>
          <Field label="Scopes" hint="A key can only call what its scopes allow. Grant the least you need.">
            <div className="space-y-2">
              {scopes.map((sc) => (
                <label
                  key={sc.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-800 p-3 transition-colors hover:border-ink-700"
                >
                  <input
                    type="checkbox"
                    checked={chosen.includes(sc.id)}
                    onChange={() => toggleScope(sc.id)}
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
          <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/5 p-3.5">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="text-[0.78rem] leading-relaxed text-ink-300">
              The secret is shown once, at creation, and is stored only as a hash — MADOVA cannot
              recover it for you. Treat it like a password and never commit it.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title={`${issued?.key.name ?? 'Key'} is ready`}
        description="Copy it now. This is the only time it will ever be shown."
        footer={<Button onClick={() => setIssued(null)}>I have saved it</Button>}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/8 p-4">
            <code className="block break-all font-mono text-[0.8rem] text-ink-50">{issued?.secret}</code>
            <div className="mt-3">
              <CopyButton text={issued?.secret ?? ''} label="Copy key" />
            </div>
          </div>
          <p className="text-[0.78rem] leading-relaxed text-ink-400">
            Scopes: {issued?.key.scopes.join(', ')}. Send it as{' '}
            <code className="font-mono text-ink-200">Authorization: Bearer …</code> against{' '}
            <code className="font-mono text-ink-200">{origin}/v1/…</code>
          </p>
        </div>
      </Modal>

      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={`Revoke ${revoking?.name ?? ''}?`}
        description="Anything using this key stops working the moment you confirm."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>Keep it</Button>
            <Button variant="danger" onClick={revoke} loading={busy}>Revoke key</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">
          Revoking is permanent. To replace a key without downtime, rotate it instead — that issues
          the new secret and retires the old one in a single step.
        </p>
      </Modal>
    </>
  )
}
