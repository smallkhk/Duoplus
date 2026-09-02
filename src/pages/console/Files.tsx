import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, EmptyState, Field, Modal, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { api, ApiError, type FileRecord, type GroupRecord } from '@/lib/api'
import { useAllPhones } from '@/lib/hooks'

const KIND_ICON: Record<FileRecord['kind'], string> = {
  apk: 'drive', image: 'grid', video: 'video', archive: 'layers', other: 'list',
}

/** Included storage before overage billing starts. */
const QUOTA_BYTES = 20 * 1024 ** 3

const gb = (bytes: number) => bytes / 1024 ** 3

export function Files() {
  const toast = useToast()
  const { phones } = useAllPhones()
  const fileInput = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<FileRecord[] | null>(null)
  const [usage, setUsage] = useState({ bytes: 0, count: 0 })
  const [groups, setGroups] = useState<GroupRecord[]>([])

  const [pushTarget, setPushTarget] = useState<FileRecord | null>(null)
  const [pushGroup, setPushGroup] = useState('')
  const [removing, setRemoving] = useState<FileRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  /** Name of the file currently uploading, so the drop zone can report progress. */
  const [uploading, setUploading] = useState<string | null>(null)

  const load = useCallback(() => {
    api.files()
      .then((d) => { setFiles(d.files); setUsage(d.usage) })
      .catch(() => setFiles([]))
  }, [])

  useEffect(() => {
    load()
    api.groups().then((d) => setGroups(d.groups)).catch(() => setGroups([]))
  }, [load])

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    for (const file of Array.from(list)) {
      setUploading(file.name)
      try {
        const { file: saved } = await api.uploadFile(file)
        toast(`${saved.name} uploaded (${saved.size}).`, 'ok')
      } catch (err) {
        toast(err instanceof ApiError ? err.message : `Could not upload ${file.name}.`, 'danger')
      }
    }
    setUploading(null)
    load()
  }

  /** Devices the push will reach: a chosen group, or the whole fleet. */
  const targets = (phones ?? []).filter((p) => !pushGroup || p.group.some((g) => g.id === pushGroup))

  const push = async () => {
    if (!pushTarget) return
    setBusy(true)
    try {
      const { pushed } = await api.pushFile(pushTarget.id, targets.map((p) => p.id))
      toast(`${pushTarget.name} pushed to ${pushed} device${pushed === 1 ? '' : 's'}.`, 'ok')
      setPushTarget(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Push failed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.deleteFile(removing.id)
      toast(`${removing.name} deleted.`, 'ok')
      setRemoving(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete that file.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const used = gb(usage.bytes)

  return (
    <>
      <PageHeader
        title="Cloud drive"
        lead="Upload build artefacts and creative once, then push them to any number of devices without the bytes crossing your uplink."
        actions={
          <Button size="sm" icon="upload" loading={uploading !== null} onClick={() => fileInput.current?.click()}>
            Upload files
          </Button>
        }
      />

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { void upload(e.target.files); e.target.value = '' }}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void upload(e.dataTransfer.files)
          }}
          onClick={() => fileInput.current?.click()}
          className={cx(
            'grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-brand-500 bg-brand-500/5' : 'border-ink-700 bg-ink-900/40 hover:border-ink-600',
          )}
        >
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-ink-800 text-brand-300">
              <Icon name={uploading ? 'refresh' : 'upload'} className={cx('size-5', uploading && 'animate-spin')} />
            </span>
            <p className="mt-4 text-[0.9rem] font-medium text-ink-100">
              {uploading ? `Uploading ${uploading}…` : 'Drop files to upload'}
            </p>
            <p className="mt-1.5 text-[0.8rem] text-ink-400">
              APK, images, video and archives. Up to 512 MB per file.
            </p>
          </div>
        </div>

        <Card className="p-6">
          <h2 className="text-[0.9rem] font-semibold text-ink-50">Storage</h2>
          <p className="mt-4 font-mono text-2xl font-semibold text-ink-50">
            {used < 0.01 && used > 0 ? '<0.01' : used.toFixed(2)} GB
          </p>
          <p className="mt-1 text-[0.76rem] text-ink-400">
            of {gb(QUOTA_BYTES)} GB included · {usage.count} file{usage.count === 1 ? '' : 's'}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400"
              style={{ width: `${Math.min(100, (usage.bytes / QUOTA_BYTES) * 100)}%` }}
            />
          </div>
          <p className="mt-4 border-t border-ink-800 pt-4 text-[0.76rem] leading-relaxed text-ink-500">
            Beyond the included allowance, storage is billed at $0.02 per GB per month.
          </p>
        </Card>
      </div>

      {files?.length === 0 ? (
        <EmptyState
          icon="drive"
          title="Nothing in the drive yet"
          body="Upload an APK or a creative pack, then push it to a whole group in one action."
          action={<Button icon="upload" onClick={() => fileInput.current?.click()}>Upload a file</Button>}
        />
      ) : (
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
                {files === null && Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }, (_, j) => (
                    <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                  ))}</tr>
                ))}

                {files?.map((f) => (
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
                        <a
                          href={`/api/files/${f.id}/download`}
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                          aria-label={`Download ${f.name}`}
                          title="Download"
                        >
                          <Icon name="download" className="size-3.5" />
                        </a>
                        <Button size="sm" variant="ghost" onClick={() => { setPushGroup(''); setPushTarget(f) }}>
                          Push
                        </Button>
                        <button
                          onClick={() => setRemoving(f)}
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
      )}

      <Modal
        open={!!pushTarget}
        onClose={() => setPushTarget(null)}
        title="Push to devices"
        description={pushTarget?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPushTarget(null)}>Cancel</Button>
            <Button onClick={push} loading={busy} disabled={targets.length === 0}>
              Push to {targets.length} device{targets.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Target group" hint="Leave on the whole fleet to reach every device.">
            <Select value={pushGroup} onChange={(e) => setPushGroup(e.target.value)}>
              <option value="">Whole fleet ({(phones ?? []).length} devices)</option>
              {groups.map((g) => {
                const n = (phones ?? []).filter((p) => p.group.some((x) => x.id === g.id)).length
                return <option key={g.id} value={g.id}>{g.name} ({n})</option>
              })}
            </Select>
          </Field>
          {targets.length === 0 && (
            <p className="text-[0.8rem] text-warn">That group has no devices in it.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        description="The bytes are erased from the drive. Copies already pushed to devices stay where they are."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Delete file</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">This cannot be undone.</p>
      </Modal>
    </>
  )
}
