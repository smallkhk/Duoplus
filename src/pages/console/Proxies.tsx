import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Button, Card, Dot, EmptyState, Field, Input, Modal, Select, Skeleton, Textarea, cx, useToast,
} from '@/components/ui'
import { api, ApiError, type GroupRecord, type ProxyRecord } from '@/lib/api'
import { useAllPhones } from '@/lib/hooks'

const BLANK = { name: '', protocol: 'socks5', host: '', port: '', user: '', password: '', area: '' }

export function Proxies() {
  const toast = useToast()
  const [proxies, setProxies] = useState<ProxyRecord[] | null>(null)
  /* True when the provider owns the list: it has no create endpoint, so the
     add and import forms would write records it will never accept. */
  const [managed, setManaged] = useState(false)
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const { phones, reload: reloadPhones } = useAllPhones()

  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [removing, setRemoving] = useState<ProxyRecord | null>(null)
  const [form, setForm] = useState(BLANK)
  const [importText, setImportText] = useState('')
  const [importGroup, setImportGroup] = useState('')
  const [skipped, setSkipped] = useState<{ line: string; reason: string }[]>([])
  const [checking, setChecking] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.proxies()
      .then((d) => { setProxies(d.proxies); setManaged(d.managed) })
      .catch(() => setProxies([]))
  }, [])

  useEffect(() => {
    load()
    api.groups().then((d) => setGroups(d.groups)).catch(() => setGroups([]))
  }, [load])

  const boundCount = (id: string) => (phones ?? []).filter((p) => p.proxy_id === id).length
  const healthy = proxies?.filter((p) => p.healthy).length ?? 0
  const checkedCount = proxies?.filter((p) => p.latency_ms > 0 || p.healthy).length ?? 0

  const check = async (id: string) => {
    setChecking(id)
    try {
      const { proxy } = await api.checkProxy(id)
      setProxies((rows) => (rows ?? []).map((p) => (p.id === proxy.id ? proxy : p)))
      toast(proxy.healthy
        ? `${proxy.name} answered in ${proxy.latency_ms} ms.`
        : `${proxy.name} did not accept a connection.`, proxy.healthy ? 'ok' : 'danger')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not reach that proxy.', 'danger')
    } finally {
      setChecking(null)
    }
  }

  const add = async () => {
    setBusy(true)
    try {
      const { proxy } = await api.createProxy({
        name: form.name || undefined,
        host: form.host,
        port: form.port,
        user: form.user || undefined,
        password: form.password || undefined,
        protocol: form.protocol,
        area: form.area || undefined,
      })
      toast(`${proxy.name} added.`, 'ok')
      setOpen(false)
      setForm(BLANK)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not add that proxy.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    setBusy(true)
    setSkipped([])
    try {
      const result = await api.importProxies(importText, importGroup ? [importGroup] : [])
      setSkipped(result.skipped)
      toast(`${result.added.length} proxy${result.added.length === 1 ? '' : ' rows'} imported`
        + (result.skipped.length ? `, ${result.skipped.length} skipped.` : '.'),
        result.added.length > 0 ? 'ok' : 'danger')
      if (result.skipped.length === 0) { setImportOpen(false); setImportText('') }
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not import that list.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      const { detached } = await api.deleteProxy(removing.id)
      toast(detached > 0
        ? `${removing.name} deleted — ${detached} device${detached === 1 ? '' : 's'} now run direct.`
        : `${removing.name} deleted.`, 'ok')
      setRemoving(null)
      load()
      reloadPhones()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete that proxy.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Proxies"
        lead="Bring your own residential, mobile or datacentre exits. Check reachability on demand, then bind a proxy to individual devices or a whole group."
        actions={managed ? null : (
          <>
            <Button variant="secondary" size="sm" icon="upload" onClick={() => setImportOpen(true)}>
              Import list
            </Button>
            <Button size="sm" icon="plus" onClick={() => setOpen(true)}>Add proxy</Button>
          </>
        )}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          ['Total proxies', String(proxies?.length ?? '—'), 'route', 'brand'],
          ['Healthy', checkedCount === 0 ? 'not checked' : `${healthy} / ${proxies?.length ?? 0}`, 'check',
            checkedCount === 0 ? 'brand' : healthy === proxies?.length ? 'ok' : 'warn'],
          ['Phones bound', String((phones ?? []).filter((p) => p.proxy_id).length), 'phone', 'brand'],
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

      {managed && (
        <Card className="mb-4 flex items-start gap-3 p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-brand-300">
            <Icon name="info" className="size-4" />
          </span>
          <p className="text-[0.82rem] leading-relaxed text-ink-300">
            These proxies belong to your cloud phone provider and are managed in its dashboard —
            its API has no endpoint for creating them, so MADOVA lists what is there rather than
            pretending otherwise. Attach one to a device from{' '}
            <Link to="/console/phones" className="text-brand-300 underline underline-offset-2">
              Cloud phones
            </Link>.
          </p>
        </Card>
      )}

      {proxies?.length === 0 && (
        <EmptyState
          icon="route"
          title={managed ? 'No proxies on the provider account' : 'No proxies yet'}
          body={managed
            ? 'Add one in your provider’s dashboard and it will appear here, ready to attach to a device.'
            : 'Add one endpoint at a time, or paste a whole list from your provider. Devices run direct until you bind one.'}
          action={managed ? undefined : <Button icon="plus" onClick={() => setOpen(true)}>Add the first proxy</Button>}
        />
      )}

      <Card className={cx('overflow-hidden', proxies?.length === 0 && 'hidden')}>
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
                      <Dot tone={p.healthy ? 'ok' : p.latency_ms > 0 ? 'danger' : 'neutral'} />
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
                    <span className="block font-mono text-[0.68rem] text-ink-500">
                      {p.user ? `user: ${p.user}` : 'no authentication'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-300">{p.area}</td>
                  <td className="px-5 py-3.5">
                    {p.latency_ms > 0 ? (
                      <span className={cx(
                        'font-mono text-[0.78rem]',
                        p.latency_ms < 120 ? 'text-ok' : p.latency_ms < 250 ? 'text-warn' : 'text-danger',
                      )}>
                        {p.latency_ms} ms
                      </span>
                    ) : (
                      <span className="text-[0.76rem] text-ink-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.group_name.map((g) => (
                      <span key={g} className="mr-1 inline-block rounded bg-ink-800 px-1.5 py-0.5 text-[0.7rem] text-ink-300">{g}</span>
                    ))}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-ink-200">{boundCount(p.id)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      {!managed && (
                        <Button size="sm" variant="ghost" loading={checking === p.id} onClick={() => check(p.id)}>
                          {checking === p.id ? 'Checking' : 'Check'}
                        </Button>
                      )}
                      <button
                        hidden={managed}
                        onClick={() => setRemoving(p)}
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
            <Button onClick={add} loading={busy} disabled={!form.host.trim() || !form.port.trim()}>
              Add proxy
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name" hint="Optional — defaults to host:port.">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="US-Residential-15"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr_6rem]">
            <Field label="Protocol">
              <Select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                {['socks5', 'http', 'https'].map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Host">
              <Input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="104.28.61.19"
              />
            </Field>
            <Field label="Port">
              <Input
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                placeholder="3001"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username">
              <Input
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
                placeholder="madova_us15"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </Field>
          </div>
          <Field label="Country code" hint="Two letters, shown in the Area column.">
            <Input
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              placeholder="US"
              maxLength={2}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => { setImportOpen(false); setSkipped([]) }}
        title="Import a proxy list"
        description="One proxy per line. Duplicates already on the account are skipped."
        footer={
          <>
            <Button variant="ghost" onClick={() => { setImportOpen(false); setSkipped([]) }}>Close</Button>
            <Button onClick={runImport} loading={busy} disabled={importText.trim().length === 0}>
              Import
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field
            label="Proxy list"
            hint="Accepts host:port, host:port:user:pass, or a full socks5:// URL."
          >
            <Textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="font-mono text-[0.78rem]"
              placeholder={'104.28.61.19:3001\n45.90.12.4:1080:madova_de:s3cret\nsocks5://user:pw@88.2.9.14:1080'}
            />
          </Field>
          {groups.length > 0 && (
            <Field label="Attach to a group" hint="Optional.">
              <Select value={importGroup} onChange={(e) => setImportGroup(e.target.value)}>
                <option value="">No group</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
          )}
          {skipped.length > 0 && (
            <div className="rounded-xl border border-warn/25 bg-warn/8 p-4">
              <p className="text-[0.78rem] font-medium text-warn">
                {skipped.length} line{skipped.length === 1 ? '' : 's'} skipped
              </p>
              <ul className="mt-2 space-y-1">
                {skipped.slice(0, 8).map((s, i) => (
                  <li key={i} className="font-mono text-[0.7rem] text-ink-400">
                    <span className="text-ink-200">{s.line}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        description="Devices using it will fall back to a direct connection until you bind another proxy."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Delete proxy</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">
          {removing && boundCount(removing.id) > 0
            ? `${boundCount(removing.id)} device${boundCount(removing.id) === 1 ? ' is' : 's are'} bound to this proxy right now.`
            : 'No device is bound to this proxy.'}
        </p>
      </Modal>
    </>
  )
}
