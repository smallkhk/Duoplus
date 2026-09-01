import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Button, Card, Dot, Field, Input, Modal, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { callData } from '@/lib/duoplus/client'
import { PHONES } from '@/lib/duoplus/mock'
import type { Paged, Proxy } from '@/lib/duoplus/types'

export function Proxies() {
  const toast = useToast()
  const [proxies, setProxies] = useState<Proxy[] | null>(null)
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)

  useEffect(() => {
    callData<Paged<Proxy>>('/api/v1/proxy/list', { page: 1, pagesize: 100 })
      .then((d) => setProxies(d.list))
      .catch(() => setProxies([]))
  }, [])

  const boundCount = (id: string) => PHONES.filter((p) => p.proxy_id === id).length
  const healthy = proxies?.filter((p) => p.healthy).length ?? 0

  const check = (id: string) => {
    setChecking(id)
    setTimeout(() => {
      setChecking(null)
      toast('Proxy reachable — latency unchanged.', 'ok')
    }, 900)
  }

  return (
    <>
      <PageHeader
        title="Proxies"
        lead="Bring your own residential, mobile or datacentre exits. MADOVA health-checks them on a schedule and routes device DNS through the tunnel."
        actions={
          <>
            <Button variant="secondary" size="sm" icon="upload"
              onClick={() => toast('Bulk import is not wired up in this demo build.', 'info')}>
              Import list
            </Button>
            <Button size="sm" icon="plus" onClick={() => setOpen(true)}>Add proxy</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          ['Total proxies', String(proxies?.length ?? '—'), 'route', 'brand'],
          ['Healthy', `${healthy} / ${proxies?.length ?? 0}`, 'check', healthy === proxies?.length ? 'ok' : 'warn'],
          ['Phones bound', String(PHONES.filter((p) => p.proxy_id).length), 'phone', 'brand'],
        ].map(([label, value, icon, tone]) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span className={cx(
              'grid size-10 shrink-0 place-items-center rounded-xl',
              tone === 'ok' ? 'bg-ok/12 text-ok' : tone === 'warn' ? 'bg-warn/12 text-warn' : 'bg-brand-500/15 text-brand-300',
            )}>
              <Icon name={icon} className="size-5" />
            </span>
            <span>
              <span className="block text-[0.76rem] text-ink-400">{label}</span>
              <span className="mt-0.5 block font-mono text-xl font-semibold text-ink-50">{value}</span>
            </span>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] border-collapse text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-ink-800 bg-ink-900/50 text-[0.7rem] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3 font-medium">Proxy</th>
                <th className="px-5 py-3 font-medium">Endpoint</th>
                <th className="px-5 py-3 font-medium">Area</th>
                <th className="px-5 py-3 font-medium">Latency</th>
                <th className="px-5 py-3 font-medium">Groups</th>
                <th className="px-5 py-3 font-medium">Phones</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {proxies === null && Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 7 }, (_, j) => (
                  <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                ))}</tr>
              ))}

              {proxies?.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-ink-800/40">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2.5">
                      <Dot tone={p.healthy ? 'ok' : 'danger'} />
                      <span>
                        <span className="block font-medium text-ink-100">{p.name}</span>
                        <span className="block font-mono text-[0.68rem] text-ink-500">{p.id}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="font-mono text-[0.76rem] text-ink-200">
                      {p.protocol}://{p.host}:{p.port}
                    </code>
                    <span className="block font-mono text-[0.68rem] text-ink-500">user: {p.user}</span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-300">{p.area}</td>
                  <td className="px-5 py-3.5">
                    <span className={cx(
                      'font-mono text-[0.78rem]',
                      p.latency_ms < 120 ? 'text-ok' : p.latency_ms < 250 ? 'text-warn' : 'text-danger',
                    )}>
                      {p.latency_ms} ms
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {p.group_name.map((g) => (
                      <span key={g} className="mr-1 inline-block rounded bg-ink-800 px-1.5 py-0.5 text-[0.7rem] text-ink-300">{g}</span>
                    ))}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-ink-200">{boundCount(p.id)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm" variant="ghost"
                        disabled={checking === p.id}
                        onClick={() => check(p.id)}
                      >
                        {checking === p.id ? 'Checking…' : 'Check'}
                      </Button>
                      <button
                        onClick={() => toast('Deleting proxies is not wired up in this demo build.', 'info')}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                        aria-label={`Delete ${p.name}`}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a proxy"
        description="Bind it to a group afterwards, or attach it to individual phones."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { setOpen(false); toast('Adding proxies is not wired up in this demo build.', 'info') }}>
              Add proxy
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name"><Input placeholder="US-Residential-15" /></Field>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr_6rem]">
            <Field label="Protocol">
              <Select defaultValue="socks5">
                {['socks5', 'http', 'https'].map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Host"><Input placeholder="104.28.61.19" /></Field>
            <Field label="Port"><Input placeholder="3001" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username"><Input placeholder="madova_us15" /></Field>
            <Field label="Password"><Input type="password" placeholder="••••••••" /></Field>
          </div>
          <Field label="Route device DNS through the proxy" hint="Recommended — stops DNS resolving around the tunnel.">
            <Select defaultValue="1">
              <option value="1">Enabled</option>
              <option value="2">Disabled</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}
