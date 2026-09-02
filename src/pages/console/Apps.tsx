import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Field, Modal, Select, Skeleton, useToast,
} from '@/components/ui'
import {
  api, ApiError, type AppRecord, type FileRecord, type GroupRecord,
} from '@/lib/api'
import { useAllPhones } from '@/lib/hooks'

export function Apps() {
  const toast = useToast()
  const { phones } = useAllPhones()

  const [apps, setApps] = useState<AppRecord[] | null>(null)
  const [apks, setApks] = useState<FileRecord[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])

  const [installOpen, setInstallOpen] = useState(false)
  const [apk, setApk] = useState('')
  const [group, setGroup] = useState('')
  const [removing, setRemoving] = useState<AppRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.apps().then((d) => setApps(d.apps)).catch(() => setApps([]))
  }, [])

  useEffect(() => {
    load()
    api.files().then((d) => {
      const only = d.files.filter((f) => f.kind === 'apk')
      setApks(only)
      setApk((cur) => cur || only[0]?.id || '')
    }).catch(() => setApks([]))
    api.groups().then((d) => setGroups(d.groups)).catch(() => setGroups([]))
  }, [load])

  /** Devices the action reaches: a chosen group, or the whole fleet. */
  const targets = (phones ?? []).filter((p) => !group || p.group.some((g) => g.id === group))

  const install = async () => {
    setBusy(true)
    try {
      const file = apks.find((f) => f.id === apk)
      if (!file) throw new ApiError(400, 'Choose an APK from the cloud drive.')
      const { pushed } = await api.pushFile(file.id, targets.map((p) => p.id))
      toast(`${file.name} installed on ${pushed} device${pushed === 1 ? '' : 's'}.`, 'ok')
      setInstallOpen(false)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Install failed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const uninstall = async () => {
    if (!removing) return
    setBusy(true)
    try {
      const { result } = await api.uninstallApp(removing.package_name)
      toast(`${removing.name} removed from ${result.success.length} device${result.success.length === 1 ? '' : 's'}.`, 'ok')
      setRemoving(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Uninstall failed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Applications"
        lead="Packages installed across the fleet. Install and uninstall in bulk from APKs held in the cloud drive."
        actions={
          <>
            <Button variant="secondary" size="sm" icon="refresh" onClick={load}>Rescan</Button>
            <Button size="sm" icon="plus" onClick={() => setInstallOpen(true)}>Install app</Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-ink-800 bg-ink-900/50 text-[0.7rem] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3 font-medium">Application</th>
                <th className="px-5 py-3 font-medium">Package</th>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Devices</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {apps === null && Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 6 }, (_, j) => (
                  <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                ))}</tr>
              ))}

              {apps?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[0.82rem] text-ink-500">
                    No applications reported. Provision a device, or install an APK from the cloud drive.
                  </td>
                </tr>
              )}

              {apps?.map((a) => (
                <tr key={a.package_name} className="transition-colors hover:bg-ink-800/40">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-[0.65rem] font-semibold text-ink-300">
                        {a.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-medium text-ink-100">{a.name}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><code className="font-mono text-[0.74rem] text-ink-400">{a.package_name}</code></td>
                  <td className="px-5 py-3.5 font-mono text-ink-300">{a.version}</td>
                  <td className="px-5 py-3.5 font-mono text-ink-300">{a.size}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={a.devices > 0 ? 'brand' : 'neutral'}>{a.devices}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setRemoving(a)}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                        aria-label={`Uninstall ${a.name}`}
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
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        title="Install an application"
        description="Pushes an APK from the cloud drive onto the devices you choose."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInstallOpen(false)}>Cancel</Button>
            <Button onClick={install} loading={busy} disabled={!apk || targets.length === 0}>
              Install on {targets.length} device{targets.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {apks.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/5 p-3.5">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
              <p className="text-[0.78rem] leading-relaxed text-ink-300">
                There are no APKs in your cloud drive yet.{' '}
                <Link to="/console/drive" className="text-brand-300 underline underline-offset-2">
                  Upload one first
                </Link>.
              </p>
            </div>
          ) : (
            <Field label="APK from the cloud drive">
              <Select value={apk} onChange={(e) => setApk(e.target.value)}>
                {apks.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.size}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Target group">
            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Whole fleet ({(phones ?? []).length} devices)</option>
              {groups.map((g) => {
                const n = (phones ?? []).filter((p) => p.group.some((x) => x.id === g.id)).length
                return <option key={g.id} value={g.id}>{g.name} ({n})</option>
              })}
            </Select>
          </Field>
          <div className="flex items-start gap-2.5 rounded-lg bg-ink-950/60 p-3.5 ring-1 ring-inset ring-ink-800">
            <Icon name="info" className="mt-0.5 size-4 shrink-0 text-brand-300" />
            <p className="text-[0.78rem] leading-relaxed text-ink-400">
              Installs run 20 phones at a time and continue in the background. Transfers happen inside
              our network, so a 400 MB APK does not cross your uplink.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Uninstall ${removing?.name ?? ''}?`}
        description={`Removes it from all ${removing?.devices ?? 0} device${removing?.devices === 1 ? '' : 's'} carrying it.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" onClick={uninstall} loading={busy}>Uninstall</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">
          App data on each device goes with it. You can install it again from the cloud drive.
        </p>
      </Modal>
    </>
  )
}
