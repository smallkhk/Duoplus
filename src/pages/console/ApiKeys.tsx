import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Code, CopyButton, Field, Input, Modal, Select, cx, useToast,
} from '@/components/ui'
import { getLang, getRequestLog, setLang, type Lang, type RequestLogEntry } from '@/lib/duoplus/client'
import { useAuth } from '@/lib/auth'
import { API_BASE_URL, API_KEY_HEADER, API_QPS_LIMIT, ENDPOINTS } from '@/lib/duoplus/endpoints'

const DEMO_KEYS = [
  { id: 'k_prod', label: 'Production', masked: 'mdv_live_7f2a••••••••••••••••3c91', created: '2026-05-02', lastUsed: '2 min ago', calls: 184_302 },
  { id: 'k_ci', label: 'CI pipeline', masked: 'mdv_live_b41c••••••••••••••••88de', created: '2026-06-19', lastUsed: '41 min ago', calls: 22_918 },
  { id: 'k_dev', label: 'Local development', masked: 'mdv_test_0c93••••••••••••••••41aa', created: '2026-08-11', lastUsed: '3 days ago', calls: 1_204 },
]

export function ApiKeys() {
  const toast = useToast()
  const { meta } = useAuth()
  const [lang, setLangState] = useState<Lang>(getLang)
  const [log, setLog] = useState<RequestLogEntry[]>(getRequestLog())
  const [createOpen, setCreateOpen] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)

  const upstream = Boolean(meta?.cloud.upstream)

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
                Keys are account-scoped and grant access to every endpoint. Revoking one takes effect immediately.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-[0.82rem]">
                <thead>
                  <tr className="border-b border-ink-800 text-[0.7rem] uppercase tracking-wider text-ink-500">
                    <th className="px-6 py-3 font-medium">Label</th>
                    <th className="px-6 py-3 font-medium">Key</th>
                    <th className="px-6 py-3 font-medium">Calls</th>
                    <th className="px-6 py-3 font-medium">Last used</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {DEMO_KEYS.map((k) => (
                    <tr key={k.id} className="transition-colors hover:bg-ink-800/40">
                      <td className="px-6 py-3.5">
                        <span className="block font-medium text-ink-100">{k.label}</span>
                        <span className="block text-[0.7rem] text-ink-500">Created {k.created}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <code className="font-mono text-[0.74rem] text-ink-300">
                          {revealed === k.id ? k.masked.replace(/•+/, 'REDACTED_IN_DEMO') : k.masked}
                        </code>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-ink-200">{k.calls.toLocaleString('en-US')}</td>
                      <td className="px-6 py-3.5 text-ink-400">{k.lastUsed}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setRevealed(revealed === k.id ? null : k.id)}
                          >
                            {revealed === k.id ? 'Hide' : 'Reveal'}
                          </Button>
                          <button
                            onClick={() => toast('Key rotation is not wired up in this demo build.', 'info')}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                            aria-label={`Rotate ${k.label}`}
                          >
                            <Icon name="refresh" className="size-3.5" />
                          </button>
                          <button
                            onClick={() => toast('Key revocation is not wired up in this demo build.', 'info')}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                            aria-label={`Revoke ${k.label}`}
                          >
                            <Icon name="trash" className="size-3.5" />
                          </button>
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
            <Code>{`curl -X POST ${API_BASE_URL}/api/v1/cloudPhone/list \\
  -H "Content-Type: application/json" \\
  -H "Lang: ${lang}" \\
  -H "${API_KEY_HEADER}: $MADOVA_KEY" \\
  -d '{"page":1,"pagesize":10}'`}</Code>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[0.75rem] text-ink-500">
                {ENDPOINTS.length} endpoints documented · {API_QPS_LIMIT} QPS per endpoint
              </p>
              <CopyButton
                text={`curl -X POST ${API_BASE_URL}/api/v1/cloudPhone/list -H "Content-Type: application/json" -H "${API_KEY_HEADER}: $MADOVA_KEY" -d '{"page":1,"pagesize":10}'`}
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
            <Button onClick={() => { setCreateOpen(false); toast('Key creation is not wired up in this demo build.', 'info') }}>
              Create key
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Label" hint="Something you will recognise in the log six months from now.">
            <Input placeholder="Production scheduler" />
          </Field>
          <Field label="Environment">
            <Select defaultValue="live">
              <option value="live">Live — bills real usage</option>
              <option value="test">Test — sandbox fleet only</option>
            </Select>
          </Field>
          <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/5 p-3.5">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="text-[0.78rem] leading-relaxed text-ink-300">
              A key grants access to every endpoint on the account, including renewal, which spends
              money. Treat it like a password and never commit it.
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}
