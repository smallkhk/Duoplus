import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Skeleton, Textarea, useToast,
} from '@/components/ui'
import { api, ApiError, type GroupRecord } from '@/lib/api'
import { useAllPhones } from '@/lib/hooks'

const BLANK = { name: '', sort: '1000', remark: '' }

export function Groups() {
  const toast = useToast()
  const [groups, setGroups] = useState<GroupRecord[] | null>(null)
  const { phones, reload: reloadPhones } = useAllPhones()

  const [form, setForm] = useState(BLANK)
  /** The group being edited, or 'new' for the create dialog. */
  const [editing, setEditing] = useState<GroupRecord | 'new' | null>(null)
  const [removing, setRemoving] = useState<GroupRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.groups().then((d) => setGroups(d.groups)).catch(() => setGroups([]))
  }, [])
  useEffect(() => { load() }, [load])

  const countFor = (id: string) => (phones ?? []).filter((p) => p.group.some((g) => g.id === id)).length

  const openCreate = () => { setForm(BLANK); setEditing('new') }
  const openEdit = (g: GroupRecord) => {
    setForm({ name: g.name, sort: String(g.sort), remark: g.remark })
    setEditing(g)
  }

  const save = async () => {
    setBusy(true)
    try {
      const input = { name: form.name, sort: Number(form.sort), remark: form.remark }
      if (editing === 'new') {
        const { group } = await api.createGroup(input)
        toast(`${group.name} created.`, 'ok')
      } else if (editing) {
        const { group } = await api.updateGroup(editing.id, input)
        toast(`${group.name} saved.`, 'ok')
      }
      setEditing(null)
      load()
      reloadPhones()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save the group.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      const { moved, moved_to } = await api.deleteGroup(removing.id)
      toast(moved > 0
        ? `${removing.name} deleted — ${moved} device${moved === 1 ? '' : 's'} moved to ${moved_to}.`
        : `${removing.name} deleted.`, 'ok')
      setRemoving(null)
      load()
      reloadPhones()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete the group.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Groups"
        lead="Organise the fleet so filters, proxies and automations can address a whole cohort at once."
        actions={<Button size="sm" icon="plus" onClick={openCreate}>New group</Button>}
      />

      {groups?.length === 0 && (
        <EmptyState
          icon="layers"
          title="No groups yet"
          body="Groups are how proxies, automations and bulk actions address a cohort of devices."
          action={<Button icon="plus" onClick={openCreate}>Create the first group</Button>}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups === null && Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="p-6"><Skeleton className="h-24 w-full" /></Card>
        ))}

        {groups?.map((g) => {
          const count = countFor(g.id)
          return (
            <Card key={g.id} className="flex flex-col p-6" hover>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                  <Icon name="layers" className="size-5" />
                </span>
                <Badge tone={count > 0 ? 'brand' : 'neutral'}>{count} phones</Badge>
              </div>
              <h2 className="mt-4 text-[1.02rem] font-semibold text-ink-50">{g.name}</h2>
              <p className="mt-1.5 flex-1 text-[0.8rem] leading-relaxed text-ink-400">
                {g.remark || <span className="text-ink-600">No remark</span>}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-ink-800 pt-4">
                <span className="font-mono text-[0.7rem] text-ink-500">{g.id} · sort {g.sort}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(g)}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                    aria-label={`Edit ${g.name}`}
                  >
                    <Icon name="settings" className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setRemoving(g)}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                    aria-label={`Delete ${g.name}`}
                  >
                    <Icon name="trash" className="size-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New group' : `Edit ${editing ? editing.name : ''}`}
        description="Groups are how proxies, automations and bulk actions address a cohort."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} loading={busy} disabled={form.name.trim().length < 2}>
              {editing === 'new' ? 'Create group' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="TikTok US — wave 3"
              autoFocus
            />
          </Field>
          <Field label="Sort order" hint="Higher values sort first in the console.">
            <Input
              type="number"
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: e.target.value })}
            />
          </Field>
          <Field label="Remark">
            <Textarea
              rows={3}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="Creator accounts, west coast GPS"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        description={
          removing && countFor(removing.id) > 0
            ? `${countFor(removing.id)} device${countFor(removing.id) === 1 ? '' : 's'} will move to your fallback group. No device is deleted.`
            : 'The group is empty, so nothing else changes.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Delete group</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">
          Deleting a group never deletes a device. This cannot be undone.
        </p>
      </Modal>
    </>
  )
}
