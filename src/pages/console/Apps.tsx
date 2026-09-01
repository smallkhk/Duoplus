import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Button, Card, Field, Modal, Select, Skeleton, useToast,
} from '@/components/ui'
import { callData } from '@/lib/duoplus/client'
import { DRIVE_FILES, GROUPS } from '@/data/demo'
import type { InstalledApp, Paged } from '@/lib/duoplus/types'

export function Apps() {
  const toast = useToast()
  const [apps, setApps] = useState<InstalledApp[] | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    callData<Paged<InstalledApp>>('/api/v1/app/list', { image_id: '7Uw0M', pagesize: 50 })
      .then((d) => setApps(d.list))
      .catch(() => setApps([]))
  }, [])

  const install = async () => {
    setBusy(true)
    try {
      await callData('/api/v1/app/batchInstall', { image_ids: ['7Uw0M'], file_id: DRIVE_FILES[0].id })
      toast('Install queued across the selected group.', 'ok')
      setInstallOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Install failed.', 'danger')
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
            <Button variant="secondary" size="sm" icon="refresh"
              onClick={() => toast('Package lists refresh per device on the next boot.', 'info')}>
              Rescan
            </Button>
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
                <th className="px-5 py-3 font-medium">Installed</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {apps === null && Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 6 }, (_, j) => (
                  <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                ))}</tr>
              ))}

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
                  <td className="px-5 py-3.5 font-mono text-[0.74rem] text-ink-500">{a.installed_at}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost"
                        onClick={() => toast(`Launch queued for ${a.name}.`, 'ok')}>
                        Launch
                      </Button>
                      <button
                        onClick={() => toast('Uninstall is not wired up in this demo build.', 'info')}
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
        description="POST /api/v1/app/batchInstall — pushes an APK from the cloud drive."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInstallOpen(false)}>Cancel</Button>
            <Button onClick={() => void install()} disabled={busy}>{busy ? 'Queueing…' : 'Install'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="APK from the cloud drive">
            <Select defaultValue={DRIVE_FILES[0].id}>
              {DRIVE_FILES.filter((f) => f.kind === 'apk').map((f) => (
                <option key={f.id} value={f.id}>{f.name} · {f.size}</option>
              ))}
            </Select>
          </Field>
          <Field label="Target group">
            <Select defaultValue={GROUPS[0].id}>
              {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
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
    </>
  )
}
