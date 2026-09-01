import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Code, CopyButton, Field, Input, Modal, Select, Toggle, cx, useToast,
} from '@/components/ui'
import { getRequestLog, getSettings, saveSettings, type Lang, type RequestLogEntry } from '@/lib/duoplus/client'
import { API_BASE_URL, API_KEY_HEADER, API_QPS_LIMIT, ENDPOINTS } from '@/lib/duoplus/endpoints'

const DEMO_KEYS = [
  { id: 'k_prod', label: 'Production', masked: 'mdv_live_7f2a••••••••••••••••3c91', created: '2026-05-02', lastUsed: '2 min ago', calls: 184_302 },
  { id: 'k_ci', label: 'CI pipeline', masked: 'mdv_live_b41c••••••••••••••••88de', created: '2026-06-19', lastUsed: '41 min ago', calls: 22_918 },
  { id: 'k_dev', label: 'Local development', masked: 'mdv_test_0c93••••••••••••••••41aa', created: '2026-08-11', lastUsed: '3 days ago', calls: 1_204 },
]

export function ApiKeys() {
  const toast = useToast()
  const [settings, setSettings] = useState(getSettings)
  const [keyInput, setKeyInput] = useState(settings.apiKey)
  const [log, setLog] = useState<RequestLogEntry[]>(getRequestLog())
  const [createOpen, setCreateOpen] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setLog([...getRequestLog()])
    window.addEventListener('madova:request', sync)
    return () => window.removeEventListener('madova:request', sync)
  }, [])

  const update = (patch: Parameters<typeof saveSettings>[0]) => {
    setSettings(saveSettings(patch))
  }

  const liveReady = settings.live && settings.apiKey.trim().length > 0

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
                <h2 className="text-[0.95rem] font-semibold text-ink-50">Connection mode</h2>
                <p className="mt-1.5 max-w-md text-[0.82rem] leading-relaxed text-ink-400">
                  Sandbox answers every call from an in-browser fleet so the console is explorable
                  without credentials. Live mode sends the same requests to{' '}
                  <code className="font-mono text-ink-300">{API_BASE_URL}</code>.
                </p>
              </div>
              <span className={cx(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[0.78rem] font-medium ring-1 ring-inset',
                liveReady ? 'bg-ok/10 text-ok ring-ok/30' : 'bg-ink-900 text-ink-400 ring-ink-700',
              )}>
                <span className={cx('size-1.5 rounded-full', liveReady ? 'animate-pulse-dot bg-ok' : 'bg-ink-500')} />
                {liveReady ? 'Live' : 'Sandbox'}
              </span>
            </div>

            <div className="mt-6 space-y-5">
              <Field
                label={`${API_KEY_HEADER} value`}
                hint="Stored in this browser only. In production, proxy the key server-side so it never reaches a client."
              >
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="mdv_live_…"
                    className="font-mono"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      update({ apiKey: keyInput.trim() })
                      toast(keyInput.trim() ? 'API key saved to this browser.' : 'API key cleared.', 'ok')
                    }}
                  >
                    Save
                  </Button>
                </div>
              </Field>

              <div className="flex items-center justify-between gap-4 rounded-lg bg-ink-950/60 p-4 ring-1 ring-inset ring-ink-800">
                <div>
                  <p className="text-[0.85rem] font-medium text-ink-100">Send calls to the live API</p>
                  <p className="mt-0.5 text-[0.76rem] text-ink-400">
                    {settings.apiKey
                      ? 'Requests route through the /upstream dev proxy.'
                      : 'Add a key first — live mode needs one.'}
                  </p>
                </div>
                <Toggle
                  checked={settings.live}
                  onChange={(v) => {
                    if (v && !settings.apiKey) {
                      toast('Save an API key before switching to live mode.', 'danger')
                      return
                    }
                    update({ live: v })
                    toast(v ? 'Live mode on.' : 'Back to the sandbox fleet.', 'ok')
                  }}
                  label="Live mode"
                />
              </div>

              <Field label="Lang header" hint="Sets the language of human-readable messages in responses.">
                <Select
                  value={settings.lang}
                  onChange={(e) => update({ lang: e.target.value as Lang })}
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
  -H "Lang: ${settings.lang}" \\
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
                      <span>·</span>
                      <span className={entry.live ? 'text-brand-300' : ''}>{entry.live ? 'live' : 'sandbox'}</span>
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
