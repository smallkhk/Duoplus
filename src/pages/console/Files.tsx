import { useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import { Badge, Button, Card, Field, Modal, Select, cx, useToast } from '@/components/ui'
import { callData } from '@/lib/duoplus/client'
import { DRIVE_FILES, GROUPS } from '@/data/demo'
import type { CloudDriveFile } from '@/lib/duoplus/types'

const KIND_ICON: Record<CloudDriveFile['kind'], string> = {
  apk: 'drive', image: 'grid', video: 'video', archive: 'layers', other: 'list',
}

export function Files() {
  const toast = useToast()
  const [pushTarget, setPushTarget] = useState<CloudDriveFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const used = 4.8
  const quota = 20

  const push = async () => {
    if (!pushTarget) return
    setBusy(true)
    try {
      await callData('/api/v1/cloudDrive/push', {
        image_ids: ['7Uw0M'],
        file_id: pushTarget.id,
        path: '/sdcard/Download',
      })
      toast(`${pushTarget.name} queued for push.`, 'ok')
      setPushTarget(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Push failed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Cloud drive"
        lead="Upload build artefacts and creative once, then push them to any number of devices without the bytes crossing your uplink."
        actions={<Button size="sm" icon="upload" onClick={() => toast('Uploading is not wired up in this demo build.', 'info')}>Upload files</Button>}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            toast('Uploading is not wired up in this demo build.', 'info')
          }}
          className={cx(
            'grid place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-brand-500 bg-brand-500/5' : 'border-ink-700 bg-ink-900/40',
          )}
        >
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-ink-800 text-brand-300">
              <Icon name="upload" className="size-5" />
            </span>
            <p className="mt-4 text-[0.9rem] font-medium text-ink-100">Drop files to upload</p>
            <p className="mt-1.5 text-[0.8rem] text-ink-400">
              APK, images, video and archives. Up to 4 GB per file.
            </p>
          </div>
        </div>

        <Card className="p-6">
          <h2 className="text-[0.9rem] font-semibold text-ink-50">Storage</h2>
          <p className="mt-4 font-mono text-2xl font-semibold text-ink-50">{used} GB</p>
          <p className="mt-1 text-[0.76rem] text-ink-400">of {quota} GB included</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400"
              style={{ width: `${(used / quota) * 100}%` }}
            />
          </div>
          <p className="mt-4 border-t border-ink-800 pt-4 text-[0.76rem] leading-relaxed text-ink-500">
            Beyond the included allowance, storage is billed at $0.02 per GB per month.
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-ink-800 bg-ink-900/50 text-[0.7rem] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3 font-medium">File</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Uploaded</th>
                <th className="px-5 py-3 font-medium">Pushed to</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {DRIVE_FILES.map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-ink-800/40">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-brand-300">
                        <Icon name={KIND_ICON[f.kind]} className="size-4" />
                      </span>
                      <span>
                        <span className="block font-medium text-ink-100">{f.name}</span>
                        <span className="block font-mono text-[0.68rem] text-ink-500">{f.id}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><Badge>{f.kind}</Badge></td>
                  <td className="px-5 py-3.5 font-mono text-ink-300">{f.size}</td>
                  <td className="px-5 py-3.5 font-mono text-[0.74rem] text-ink-500">{f.uploaded_at}</td>
                  <td className="px-5 py-3.5 font-mono text-ink-200">{f.pushed_to} phones</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setPushTarget(f)}>Push</Button>
                      <button
                        onClick={() => toast('Deleting files is not wired up in this demo build.', 'info')}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                        aria-label={`Delete ${f.name}`}
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
        open={!!pushTarget}
        onClose={() => setPushTarget(null)}
        title="Push to devices"
        description={`POST /api/v1/cloudDrive/push · ${pushTarget?.name ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPushTarget(null)}>Cancel</Button>
            <Button onClick={() => void push()} disabled={busy}>{busy ? 'Queueing…' : 'Push file'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Target group">
            <Select defaultValue={GROUPS[0].id}>
              {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label="Destination path" hint="Defaults to the device's Download folder.">
            <Select defaultValue="/sdcard/Download">
              {['/sdcard/Download', '/sdcard/DCIM/Camera', '/sdcard/Movies', '/sdcard/Pictures'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}
