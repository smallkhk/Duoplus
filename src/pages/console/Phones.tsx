import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import { PhoneFrame } from '@/components/PhoneFrame'
import {
  Badge, Button, ButtonLink, Card, Checkbox, Code, CopyButton, Dot, EmptyState, Field, Input,
  Modal, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { callData } from '@/lib/duoplus/client'
import { REGION_INDEX } from '@/data/demo'
import { api, type GroupRecord } from '@/lib/api'
import { useProxies } from '@/lib/hooks'
import {
  PHONE_STATUS_LABEL, PhoneStatus, START_PHONE_TYPE_LABEL,
  type AdbCommandResult, type BatchResult, type CloudPhone, type CloudPhoneListRequest, type Paged,
} from '@/lib/duoplus/types'

/* Status chips share one mapping so the table, drawer and filters agree. */
const STATUS_TONE: Record<number, 'ok' | 'neutral' | 'warn' | 'danger' | 'brand'> = {
  0: 'neutral', 1: 'ok', 2: 'neutral', 3: 'warn', 4: 'warn',
  10: 'brand', 11: 'brand', 12: 'danger',
}

function StatusChip({ status }: { status: number }) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  const dotTone = tone === 'brand' ? 'brand' : tone === 'ok' ? 'ok' : tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'neutral'
  return (
    <Badge tone={tone}>
      <span className={cx(status === 10 || status === 11 ? 'animate-pulse-dot' : '')}>
        <Dot tone={dotTone} />
      </span>
      {PHONE_STATUS_LABEL[status] ?? 'Unknown'}
    </Badge>
  )
}

const PAGE_SIZES = [10, 25, 50, 100]

export function Phones() {
  const toast = useToast()

  const [filters, setFilters] = useState<CloudPhoneListRequest>({
    page: 1, pagesize: 25, sort_by: 'created_at', order: 'desc',
  })
  const [nameInput, setNameInput] = useState('')
  const [data, setData] = useState<Paged<CloudPhone> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<CloudPhone | null>(null)
  const [adbOpen, setAdbOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupRecord[]>([])

  useEffect(() => {
    api.groups().then((d) => setGroups(d.groups)).catch(() => setGroups([]))
  }, [])

  const load = useCallback(async (next: CloudPhoneListRequest) => {
    setLoading(true)
    try {
      const res = await callData<Paged<CloudPhone>>('/api/v1/cloudPhone/list', next as Record<string, unknown>)
      setData(res)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load the fleet.', 'danger')
      setData({ list: [], page: 1, pagesize: next.pagesize ?? 25, total: 0, total_page: 1 })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load(filters) }, [filters, load])

  /* Debounce the name box so typing does not fire a call per keystroke. */
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.name === (nameInput || undefined) ? f : { ...f, name: nameInput || undefined, page: 1 }))
    }, 350)
    return () => clearTimeout(t)
  }, [nameInput])

  const rows = data?.list ?? []
  const allSelected = rows.length > 0 && rows.every((p) => selected.has(p.id))
  const someSelected = rows.some((p) => selected.has(p.id))
  const selectedIds = useMemo(() => [...selected], [selected])

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) rows.forEach((p) => next.delete(p.id))
      else rows.forEach((p) => next.add(p.id))
      return next
    })
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  /** Batch endpoints take at most 20 IDs, so chunk and aggregate. */
  const runBatch = async (path: string, label: string) => {
    if (selectedIds.length === 0) return
    setBusy(label)
    const chunks: string[][] = []
    for (let i = 0; i < selectedIds.length; i += 20) chunks.push(selectedIds.slice(i, i + 20))

    let ok = 0
    const failures: string[] = []
    try {
      for (const chunk of chunks) {
        const res = await callData<BatchResult>(path, { image_ids: chunk })
        ok += res.success.length
        for (const id of res.fail) failures.push(`${id}: ${res.fail_reason[id] ?? 'failed'}`)
      }
      if (failures.length === 0) {
        toast(`${label} — ${ok} phone${ok === 1 ? '' : 's'}.`, 'ok')
      } else {
        toast(`${label} — ${ok} succeeded, ${failures.length} failed. ${failures[0]}`, 'danger')
      }
      await load(filters)
    } catch (err) {
      toast(err instanceof Error ? err.message : `${label} failed.`, 'danger')
    } finally {
      setBusy(null)
    }
  }

  const setFilter = (patch: Partial<CloudPhoneListRequest>) =>
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }))

  const activeFilterCount = [
    filters.name, filters.group_id, filters.proxy_id,
    filters.link_status?.length, filters.region_id?.length,
    filters.start_phone_type?.length, filters.tag_ids?.length,
  ].filter(Boolean).length

  return (
    <>
      <PageHeader
        title="Cloud phones"
        lead="Every device on the account. Selection drives the batch endpoints — power, root, renewal and ADB all take up to 20 phones per call."
        actions={
          <>
            <Button variant="secondary" size="sm" icon="refresh" onClick={() => void load(filters)}>Refresh</Button>
            <ButtonLink to="/console/buy" size="sm" icon="plus">New cloud phone</ButtonLink>
          </>
        }
      />

      {/* filters */}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Filter by name…"
              className="pl-9"
              aria-label="Filter by name"
            />
          </div>

          <Select
            value={filters.link_status?.[0] ?? ''}
            onChange={(e) => setFilter({ link_status: e.target.value ? [e.target.value] : undefined })}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {Object.entries(PHONE_STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>

          <Select
            value={filters.group_id ?? ''}
            onChange={(e) => setFilter({ group_id: e.target.value || undefined })}
            aria-label="Group"
          >
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>

          <Select
            value={filters.region_id?.[0] ?? ''}
            onChange={(e) => setFilter({ region_id: e.target.value ? [e.target.value] : undefined })}
            aria-label="Region"
          >
            <option value="">All regions</option>
            {Object.values(REGION_INDEX).map((r) => (
              <option key={r.region} value={r.region}>{r.flag} {r.area}</option>
            ))}
          </Select>

          <Select
            value={`${filters.sort_by}:${filters.order}`}
            onChange={(e) => {
              const [sort_by, order] = e.target.value.split(':') as [CloudPhoneListRequest['sort_by'], 'asc' | 'desc']
              setFilter({ sort_by, order })
            }}
            aria-label="Sort"
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="expired_at:asc">Expiring soonest</option>
            <option value="os:asc">OS version</option>
          </Select>
        </div>

        {activeFilterCount > 0 && (
          <div className="mt-3 flex items-center gap-3 border-t border-ink-800 pt-3">
            <span className="text-[0.75rem] text-ink-500">{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</span>
            <button
              onClick={() => {
                setNameInput('')
                setFilters({ page: 1, pagesize: filters.pagesize, sort_by: 'created_at', order: 'desc' })
              }}
              className="text-[0.75rem] font-medium text-brand-300 hover:text-brand-200"
            >
              Clear all
            </button>
          </div>
        )}
      </Card>

      {/* bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-[4.25rem] z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/40 bg-ink-900/95 p-3 shadow-lg backdrop-blur">
          <span className="mr-1 flex items-center gap-2 px-2 text-[0.82rem] font-medium text-ink-100">
            <Badge tone="brand">{selectedIds.length}</Badge>
            selected
          </span>
          <Button size="sm" variant="secondary" icon="power" disabled={!!busy}
            onClick={() => void runBatch('/api/v1/cloudPhone/batchPowerOn', 'Powered on')}>
            {busy === 'Powered on' ? 'Powering on…' : 'Power on'}
          </Button>
          <Button size="sm" variant="secondary" icon="pause" disabled={!!busy}
            onClick={() => void runBatch('/api/v1/cloudPhone/batchPowerOff', 'Powered off')}>
            Power off
          </Button>
          <Button size="sm" variant="secondary" icon="restart" disabled={!!busy}
            onClick={() => void runBatch('/api/v1/cloudPhone/batchRestart', 'Restarted')}>
            Restart
          </Button>
          <Button size="sm" variant="secondary" icon="terminal" disabled={!!busy} onClick={() => setAdbOpen(true)}>
            Run ADB
          </Button>
          <Button size="sm" variant="secondary" icon="refresh" disabled={!!busy} onClick={() => setRenewOpen(true)}>
            Renew
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {/* table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-ink-800 bg-ink-900/50 text-[0.7rem] uppercase tracking-wider text-ink-500">
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={toggleAll}
                    label="Select all on this page"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">Network</th>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {loading && rows.length === 0 && Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  <td className="px-4 py-4"><Skeleton className="size-4" /></td>
                  {Array.from({ length: 7 }, (_, j) => (
                    <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))}

              {rows.map((p) => {
                const region = REGION_INDEX[p.region]
                return (
                  <tr
                    key={p.id}
                    className={cx(
                      'transition-colors',
                      selected.has(p.id) ? 'bg-brand-500/[0.07]' : 'hover:bg-ink-800/40',
                    )}
                  >
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} label={`Select ${p.name}`} />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDetail(p)} className="group text-left">
                        <span className="block font-medium text-ink-100 group-hover:text-brand-200">{p.name}</span>
                        <span className="mt-0.5 block font-mono text-[0.68rem] text-ink-500">
                          {p.id}{p.remark && ` · ${p.remark}`}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                    <td className="px-4 py-3">
                      <span className="block text-ink-200">{p.device.model}</span>
                      <span className="block text-[0.7rem] text-ink-500">{p.os} · {p.size}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-ink-200">{region?.flag} {p.area}</span>
                      <span className="block font-mono text-[0.7rem] text-ink-500">{p.ip}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.group.map((g) => (
                        <span key={g.id} className="mr-1 inline-block rounded bg-ink-800 px-1.5 py-0.5 text-[0.7rem] text-ink-300">
                          {g.name}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-mono text-[0.74rem] text-ink-300">{p.expired_at.slice(0, 10)}</span>
                      <span className="block text-[0.68rem] text-ink-500">
                        {p.renewal_status === 1 ? 'Auto-renews' : 'Manual renewal'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetail(p)}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                        aria-label={`Open ${p.name}`}
                      >
                        <Icon name="chevronRight" className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && rows.length === 0 && (
          <EmptyState
            title="No phones match these filters"
            body="Loosen the filters, or provision a phone to get started. The free trial includes one device for 30 days."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setNameInput('')
                  setFilters({ page: 1, pagesize: filters.pagesize, sort_by: 'created_at', order: 'desc' })
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 px-4 py-3">
            <p className="text-[0.78rem] text-ink-400">
              Showing <span className="text-ink-100">{(data.page - 1) * data.pagesize + 1}</span>–
              <span className="text-ink-100">{Math.min(data.page * data.pagesize, data.total)}</span> of{' '}
              <span className="text-ink-100">{data.total}</span>
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={filters.pagesize}
                onChange={(e) => setFilter({ pagesize: Number(e.target.value) })}
                className="!h-8 !w-auto !text-[0.76rem]"
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
              </Select>
              <Button
                size="sm" variant="secondary" icon="chevronLeft"
                disabled={data.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                Prev
              </Button>
              <span className="px-1 font-mono text-[0.76rem] text-ink-400">
                {data.page} / {data.total_page}
              </span>
              <Button
                size="sm" variant="secondary" iconRight="chevronRight"
                disabled={data.page >= data.total_page}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <PhoneDrawer phone={detail} onClose={() => setDetail(null)} onChanged={() => void load(filters)} />
      <AdbModal open={adbOpen} onClose={() => setAdbOpen(false)} ids={selectedIds} />
      <RenewModal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        ids={selectedIds}
        onDone={() => void load(filters)}
      />
    </>
  )
}

/* ------------------------------- drawer -------------------------------- */

type DrawerTab = 'overview' | 'screen' | 'fingerprint' | 'adb'

function PhoneDrawer({
  phone, onClose, onChanged,
}: { phone: CloudPhone | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const { proxies, managed, reload: reloadProxies } = useProxies()
  const [tab, setTab] = useState<DrawerTab>('overview')
  const [busy, setBusy] = useState(false)
  const [proxyOpen, setProxyOpen] = useState(false)
  const [proxyPick, setProxyPick] = useState('')

  useEffect(() => { setTab('overview') }, [phone?.id])

  useEffect(() => {
    if (!phone) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phone, onClose])

  if (!phone) return null

  const power = async (path: string, label: string) => {
    setBusy(true)
    try {
      const res = await callData<BatchResult>(path, { image_ids: [phone.id] })
      if (res.fail.length) toast(res.fail_reason[phone.id] ?? `${label} failed.`, 'danger')
      else toast(`${phone.name} — ${label.toLowerCase()}.`, 'ok')
      onChanged()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : `${label} failed.`, 'danger')
    } finally {
      setBusy(false)
    }
  }

  const region = REGION_INDEX[phone.region]
  const proxy = (proxies ?? []).find((p) => p.id === phone.proxy_id)
  /* Status 0 is "Not configured" — with no exit the device cannot boot. */
  const needsProxy = phone.status === PhoneStatus.NotConfigured && !phone.proxy_id

  const attachProxy = async () => {
    setBusy(true)
    try {
      const { result } = proxyPick
        ? await api.bindProxy(proxyPick, [phone.id])
        : await api.unbindProxy([phone.id])
      if (result.fail.length > 0) {
        throw new Error(result.fail_reason[result.fail[0]] ?? 'The provider refused the change')
      }
      toast(proxyPick
        ? `${(proxies ?? []).find((p) => p.id === proxyPick)?.name ?? 'Proxy'} attached to ${phone.name}.`
        : `Proxy detached from ${phone.name}.`, 'ok')
      setProxyOpen(false)
      reloadProxies()
      onChanged()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change the proxy.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${phone.name} details`}
        className="relative flex h-full w-full max-w-2xl flex-col border-l border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-800 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-lg font-semibold text-ink-50">{phone.name}</h2>
              <StatusChip status={phone.status} />
            </div>
            <p className="mt-1 font-mono text-[0.72rem] text-ink-500">
              {phone.id} · {phone.device.model} · {phone.os}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <Icon name="x" className="size-4" />
          </button>
        </header>

        <div className="flex gap-1 border-b border-ink-800 px-6">
          {([
            ['overview', 'Overview'], ['screen', 'Screen'],
            ['fingerprint', 'Fingerprint'], ['adb', 'ADB'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cx(
                '-mb-px border-b-2 px-3.5 py-2.5 text-[0.83rem] font-medium transition-colors',
                tab === id ? 'border-brand-500 text-ink-50' : 'border-transparent text-ink-400 hover:text-ink-100',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'overview' && (
            <div className="space-y-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  ['Status', PHONE_STATUS_LABEL[phone.status]],
                  ['Region', `${region?.flag ?? ''} ${phone.area}`],
                  ['IP address', phone.ip],
                  ['Storage', phone.size],
                  ['Created', phone.created_at],
                  ['Expires', phone.expired_at],
                  ['Auto-renewal', phone.renewal_status === 1 ? 'On' : 'Off'],
                  ['Startup mode', START_PHONE_TYPE_LABEL[phone.start_phone_type]],
                  ['Sharing', phone.share_status === 1 ? 'Shared' : phone.share_status === 2 ? 'Not shared' : 'Not configured'],
                  ['HTTP service', phone.http_status === 1 ? 'Enabled' : 'Disabled'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[0.72rem] text-ink-500">{k}</dt>
                    <dd className="mt-0.5 text-[0.85rem] text-ink-100">{v}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-ink-500">Proxy</p>
                  <Button size="sm" variant="ghost" onClick={() => { setProxyPick(phone.proxy_id ?? ''); setProxyOpen(true) }}>
                    {proxy ? 'Change' : 'Attach a proxy'}
                  </Button>
                </div>
                {proxy ? (
                  <div className="flex items-center gap-3 rounded-lg bg-ink-950/60 p-3.5 ring-1 ring-inset ring-ink-800">
                    <Dot tone={proxy.healthy ? 'ok' : 'neutral'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.83rem] text-ink-100">{proxy.name}</span>
                      <span className="block font-mono text-[0.7rem] text-ink-500">
                        {proxy.protocol}://{proxy.host}:{proxy.port}
                      </span>
                    </span>
                    {proxy.latency_ms > 0 && (
                      <span className="font-mono text-[0.74rem] text-ink-400">{proxy.latency_ms} ms</span>
                    )}
                  </div>
                ) : (
                  <div className={cx(
                    'rounded-lg p-3.5 ring-1 ring-inset',
                    needsProxy ? 'bg-warn/8 ring-warn/30' : 'bg-ink-950/60 ring-ink-800',
                  )}>
                    <p className="text-[0.82rem] leading-relaxed text-ink-300">
                      {needsProxy
                        ? 'This device is not configured yet. A cloud phone needs an exit before '
                          + 'it can start — attach a proxy and it will come up on the next boot.'
                        : 'No proxy attached. The device uses the data centre’s own exit.'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wider text-ink-500">ADB</p>
                <div className="flex items-center gap-2 rounded-lg bg-ink-950/60 p-3.5 ring-1 ring-inset ring-ink-800">
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-ink-100">
                    adb connect {phone.adb}
                  </code>
                  <CopyButton text={`adb connect ${phone.adb}`} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-ink-800 pt-5">
                <Button size="sm" icon="power" disabled={busy}
                  onClick={() => void power('/api/v1/cloudPhone/batchPowerOn', 'Powered on')}>
                  Power on
                </Button>
                <Button size="sm" variant="secondary" icon="pause" disabled={busy}
                  onClick={() => void power('/api/v1/cloudPhone/batchPowerOff', 'Powered off')}>
                  Power off
                </Button>
                <Button size="sm" variant="secondary" icon="restart" disabled={busy}
                  onClick={() => void power('/api/v1/cloudPhone/batchRestart', 'Restarted')}>
                  Restart
                </Button>
              </div>
            </div>
          )}

          {tab === 'screen' && (
            <div className="flex flex-col items-center">
              <PhoneFrame
                className="w-56"
                tone={phone.status === PhoneStatus.PoweredOn ? 'default' : 'off'}
              />
              <p className="mt-5 max-w-sm text-center text-[0.8rem] leading-relaxed text-ink-400">
                {phone.status === PhoneStatus.PoweredOn
                  ? 'The live stream renders here in the product. This build shows a static frame.'
                  : 'The phone is not powered on. Start it to mirror the screen.'}
              </p>
              <div className="mt-5 flex gap-2">
                {[
                  ['Back', 'chevronLeft'], ['Home', 'grid'], ['Recents', 'list'],
                ].map(([label, icon]) => (
                  <Button key={label} size="sm" variant="secondary" icon={icon}>{label}</Button>
                ))}
              </div>
            </div>
          )}

          {tab === 'fingerprint' && (
            <dl className="space-y-3">
              {[
                ['Model', phone.device.model], ['IMEI', phone.device.imei],
                ['Serial number', phone.device.serialno], ['Android ID', phone.device.android_id],
                ['GAID', phone.device.gaid], ['Resolution', phone.device.dpi_name],
                ['Timezone', phone.device.timezone], ['Language', phone.device.language],
                ['GPS', `${phone.device.latitude}, ${phone.device.longitude}`],
                ['SIM country', phone.device.sim_country], ['SIM operator', phone.device.sim_operator],
                ['Wi-Fi SSID', phone.device.wifi_name], ['Bluetooth name', phone.device.bluetooth_name],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-ink-800 pb-3">
                  <dt className="shrink-0 text-[0.78rem] text-ink-400">{k}</dt>
                  <dd className="truncate text-right font-mono text-[0.78rem] text-ink-100">{v}</dd>
                </div>
              ))}
              <p className="pt-2 text-[0.75rem] leading-relaxed text-ink-500">
                Rewrite any of these with <code className="font-mono text-brand-300">POST /api/v1/cloudPhone/update</code>.
                Omitted fields are left untouched.
              </p>
            </dl>
          )}

          {tab === 'adb' && <AdbPanel ids={[phone.id]} />}
        </div>
      </aside>

      <Modal
        open={proxyOpen}
        onClose={() => setProxyOpen(false)}
        title={`Proxy for ${phone.name}`}
        description={managed
          ? 'These come from your cloud phone provider. Pick one and the device is reconfigured to use it.'
          : 'Pick one of the proxies on your account, or detach to use the data centre’s own exit.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setProxyOpen(false)}>Cancel</Button>
            <Button onClick={attachProxy} loading={busy}>
              {proxyPick ? 'Attach proxy' : 'Detach proxy'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {(proxies ?? []).length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/5 p-3.5">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
              <p className="text-[0.8rem] leading-relaxed text-ink-300">
                {managed
                  ? 'There are no proxies on your provider account yet. Add one in the provider’s '
                    + 'dashboard and it will appear here — its API has no endpoint for creating them.'
                  : 'No proxies on the account yet. Add one on the Proxies page first.'}
              </p>
            </div>
          ) : (
            <Field label="Proxy" hint="Device DNS is routed through the tunnel, which stops it resolving around the proxy.">
              <Select value={proxyPick} onChange={(e) => setProxyPick(e.target.value)}>
                <option value="">No proxy — use the data centre exit</option>
                {(proxies ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.area} · {p.host}:{p.port}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {needsProxy && (
            <p className="text-[0.8rem] leading-relaxed text-ink-400">
              The device reports <span className="text-ink-200">Not configured</span>. Attaching an
              exit is what clears that — it will boot on the next power-on.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

/* -------------------------------- ADB ---------------------------------- */

const ADB_PRESETS = [
  { label: 'List files', cmd: 'ls' },
  { label: 'Device model', cmd: 'getprop ro.product.model' },
  { label: 'Installed packages', cmd: 'pm list packages' },
  { label: 'Screen size', cmd: 'wm size' },
  { label: 'Go home', cmd: 'input keyevent 3' },
  { label: 'Swipe up', cmd: 'input swipe 540 1600 540 400' },
]

function AdbPanel({ ids }: { ids: string[] }) {
  const toast = useToast()
  const [command, setCommand] = useState('getprop ro.product.model')
  const [output, setOutput] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!command.trim()) return
    setBusy(true)
    try {
      const body = ids.length === 1
        ? { image_id: ids[0], command }
        : { image_ids: ids.slice(0, 20), command }
      const data = await callData<AdbCommandResult | Record<string, AdbCommandResult>>(
        '/api/v1/cloudPhone/command', body,
      )
      setOutput(JSON.stringify(data, null, 2))
      toast(`Command ran on ${Math.min(ids.length, 20)} phone${ids.length === 1 ? '' : 's'}.`, 'ok')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Command failed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ADB_PRESETS.map((p) => (
          <button
            key={p.cmd}
            onClick={() => setCommand(p.cmd)}
            className={cx(
              'rounded-lg px-2.5 py-1 text-[0.74rem] transition-colors',
              command === p.cmd ? 'bg-brand-500/15 text-brand-200' : 'bg-ink-800 text-ink-400 hover:text-ink-100',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Field label="Command" hint="The adb shell prefix is not needed. Commands must finish within 10 seconds.">
        <div className="flex gap-2">
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && void run()}
            className="font-mono"
            placeholder="pm list packages"
          />
          <Button onClick={() => void run()} disabled={busy} icon={busy ? undefined : 'play'}>
            {busy ? 'Running…' : 'Run'}
          </Button>
        </div>
      </Field>

      <p className="mt-3 text-[0.74rem] text-ink-500">
        Targets {Math.min(ids.length, 20)} phone{ids.length === 1 ? '' : 's'}
        {ids.length > 20 && ` (of ${ids.length} selected — the endpoint accepts 20 per call)`}.
      </p>

      <div className="mt-4">
        {output
          ? <Code className="max-h-72">{output}</Code>
          : (
            <div className="grid h-32 place-items-center rounded-xl border border-dashed border-ink-700 bg-ink-950/50 text-center">
              <p className="text-[0.8rem] text-ink-500">Output appears here.</p>
            </div>
          )}
      </div>
    </div>
  )
}

function AdbModal({ open, onClose, ids }: { open: boolean; onClose: () => void; ids: string[] }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Run an ADB command"
      description={`POST /api/v1/cloudPhone/command · ${ids.length} phone${ids.length === 1 ? '' : 's'} selected`}
    >
      <AdbPanel ids={ids} />
    </Modal>
  )
}

/* -------------------------------- renew -------------------------------- */

function RenewModal({
  open, onClose, ids, onDone,
}: { open: boolean; onClose: () => void; ids: string[]; onDone: () => void }) {
  const toast = useToast()
  const [duration, setDuration] = useState('30')
  const [coupon, setCoupon] = useState('')
  const [busy, setBusy] = useState(false)

  const RATES: Record<string, number> = { '7': 0.03, '30': 0.085, '90': 0.24, '180': 0.44, '360': 0.79 }
  const estimate = ids.length * (RATES[duration] ?? 0)

  const submit = async () => {
    setBusy(true)
    try {
      const res = await callData<{ order_id: string }>('/api/v1/cloudPhone/renewal', {
        image_ids: ids,
        duration,
        ...(coupon ? { coupon_code: coupon } : {}),
      })
      toast(`Renewal ordered — ${res.order_id}`, 'ok')
      onDone()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Renewal failed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Renew subscription"
      description={`POST /api/v1/cloudPhone/renewal · ${ids.length} phone${ids.length === 1 ? '' : 's'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? 'Placing order…' : `Renew ${ids.length}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Duration">
          <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {['7', '30', '90', '180', '360'].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </Select>
        </Field>
        <Field label="Coupon code" hint="Optional.">
          <Input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="MADOVA-XXXX" />
        </Field>
        <div className="flex items-baseline justify-between rounded-lg bg-ink-950/60 p-4 ring-1 ring-inset ring-ink-800">
          <span className="text-[0.82rem] text-ink-400">Estimated device charge</span>
          <span className="font-mono text-lg font-semibold text-ink-50">
            ${estimate.toFixed(2)}
          </span>
        </div>
        <p className="text-[0.75rem] leading-relaxed text-ink-500">
          Device charges only — runtime is metered separately. Volume discounts and partner rates are
          applied when the order is settled.
        </p>
      </div>
    </Modal>
  )
}

