import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Field, Input, Modal, Skeleton, Textarea, useToast,
} from '@/components/ui'
import { callData } from '@/lib/duoplus/client'
import { PHONES } from '@/lib/duoplus/mock'
import type { Paged, PhoneGroup } from '@/lib/duoplus/types'

export function Groups() {
  const toast = useToast()
  const [groups, setGroups] = useState<PhoneGroup[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    callData<Paged<PhoneGroup>>('/api/v1/cloudPhone/groupList', { page: 1 })
      .then((d) => setGroups(d.list))
      .catch(() => setGroups([]))
  }, [])

  const countFor = (id: string) => PHONES.filter((p) => p.group.some((g) => g.id === id)).length

  return (
    <>
      <PageHeader
        title="Groups"
        lead="Organise the fleet so filters, proxies and automations can address a whole cohort at once. Page size is fixed at 200 by the upstream endpoint."
        actions={<Button size="sm" icon="plus" onClick={() => setOpen(true)}>New group</Button>}
      />

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
                    onClick={() => toast('Editing groups is not wired up in this demo build.', 'info')}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                    aria-label={`Edit ${g.name}`}
                  >
                    <Icon name="settings" className="size-3.5" />
                  </button>
                  <button
                    onClick={() => toast('Deleting groups is not wired up in this demo build.', 'info')}
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
        open={open}
        onClose={() => setOpen(false)}
        title="New group"
        description="Groups are how proxies, automations and bulk actions address a cohort."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { setOpen(false); toast('Group creation is not wired up in this demo build.', 'info') }}>
              Create group
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name"><Input placeholder="TikTok US — wave 3" /></Field>
          <Field label="Sort order" hint="Higher values sort first in the console."><Input type="number" defaultValue={1000} /></Field>
          <Field label="Remark"><Textarea rows={3} placeholder="Creator accounts, west coast GPS" /></Field>
        </div>
      </Modal>
    </>
  )
}
