import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, CopyButton, Field, Input, Modal, Select, Skeleton, useToast,
} from '@/components/ui'
import { api, ApiError, type MemberRecord } from '@/lib/api'

const ROLE_TONE: Record<MemberRecord['role'], 'brand' | 'accent' | 'neutral'> = {
  Owner: 'brand', Admin: 'accent', Operator: 'neutral', Viewer: 'neutral',
}

const PERMISSIONS = [
  ['Provision and delete phones', ['Owner', 'Admin']],
  ['Power, restart and reskin', ['Owner', 'Admin', 'Operator']],
  ['Run ADB commands', ['Owner', 'Admin', 'Operator']],
  ['Manage proxies and groups', ['Owner', 'Admin']],
  ['Create and revoke API keys', ['Owner']],
  ['Renew and change billing', ['Owner']],
  ['View the fleet', ['Owner', 'Admin', 'Operator', 'Viewer']],
] as const

const BLANK = { name: '', email: '', role: 'Operator' }

export function Team() {
  const toast = useToast()
  const [team, setTeam] = useState<MemberRecord[] | null>(null)
  const [roles, setRoles] = useState<MemberRecord['role'][]>(['Admin', 'Operator', 'Viewer'])

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState<MemberRecord | null>(null)
  const [removing, setRemoving] = useState<MemberRecord | null>(null)
  const [busy, setBusy] = useState(false)
  /** Set once an invite is created, so the link can be handed over directly. */
  const [invite, setInvite] = useState<{ member: MemberRecord; token: string } | null>(null)

  const load = useCallback(() => {
    api.team()
      .then((d) => { setTeam(d.team); setRoles(d.roles) })
      .catch(() => setTeam([]))
  }, [])
  useEffect(() => { load() }, [load])

  const send = async () => {
    setBusy(true)
    try {
      const result = await api.inviteMember(form)
      setInvite({ member: result.member, token: result.invite_token })
      setOpen(false)
      setForm(BLANK)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not send that invitation.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const saveMember = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await api.updateMember(editing.id, { role: editing.role, status: editing.status })
      toast(`${editing.name} updated.`, 'ok')
      setEditing(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update that member.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.removeMember(removing.id)
      toast(`${removing.name} removed from the team.`, 'ok')
      setRemoving(null)
      setEditing(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove that member.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const inviteLink = invite
    ? `${window.location.origin}/join?invite=${encodeURIComponent(invite.token)}`
    : ''

  return (
    <>
      <PageHeader
        title="Team"
        lead="Roles run from Owner to Viewer. Share a phone or a whole group with a colleague without handing over the account credentials."
        actions={<Button size="sm" icon="plus" onClick={() => setOpen(true)}>Invite member</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[0.82rem]">
              <thead>
                <tr className="border-b border-ink-800 bg-ink-900/50 text-[0.7rem] uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Phones</th>
                  <th className="px-5 py-3 font-medium">Last active</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {team === null && Array.from({ length: 3 }, (_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }, (_, j) => (
                    <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                  ))}</tr>
                ))}

                {team?.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-ink-800/40">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[0.66rem] font-semibold text-white">
                          {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-100">{m.name}</span>
                          <span className="block truncate text-[0.7rem] text-ink-500">{m.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5"><Badge tone={ROLE_TONE[m.role]}>{m.role}</Badge></td>
                    <td className="px-5 py-3.5 font-mono text-ink-200">{m.phones}</td>
                    <td className="px-5 py-3.5 text-ink-400">
                      {m.status === 'invited'
                        ? <Badge tone="warn">Invite pending</Badge>
                        : m.status === 'suspended'
                          ? <Badge tone="danger">Suspended</Badge>
                          : m.last_active}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        {m.role === 'Owner' ? (
                          <span className="pr-1.5 text-[0.7rem] text-ink-600">account owner</span>
                        ) : (
                          <button
                            onClick={() => setEditing(m)}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                            aria-label={`Manage ${m.name}`}
                          >
                            <Icon name="settings" className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[0.9rem] font-semibold text-ink-50">What each role can do</h2>
          <ul className="mt-5 space-y-3.5">
            {PERMISSIONS.map(([action, roles]) => (
              <li key={action} className="border-b border-ink-800 pb-3.5 last:border-0 last:pb-0">
                <p className="text-[0.82rem] text-ink-200">{action}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <span key={r} className="rounded bg-ink-800 px-1.5 py-0.5 text-[0.66rem] text-ink-400">{r}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a team member"
        description="They receive an email invitation and pick their own password."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={send}
              loading={busy}
              disabled={form.name.trim().length < 2 || !form.email.includes('@')}
            >
              Create invitation
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ada Lovelace"
              autoFocus
            />
          </Field>
          <Field label="Work email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="colleague@company.com"
            />
          </Field>
          <Field label="Role" hint="Operators can drive phones but cannot provision or bill.">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roles.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={invite !== null}
        onClose={() => setInvite(null)}
        title={`${invite?.member.name ?? ''} is invited`}
        description="No mail transport is configured on this server, so hand them the link yourself."
        footer={<Button onClick={() => setInvite(null)}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/8 p-4">
            <code className="block break-all font-mono text-[0.76rem] text-ink-50">{inviteLink}</code>
            <div className="mt-3"><CopyButton text={inviteLink} label="Copy invite link" /></div>
          </div>
          <p className="text-[0.78rem] leading-relaxed text-ink-400">
            They join as {invite?.member.role} and pick their own password. The invitation stays
            pending on the team list until they do.
          </p>
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Manage ${editing?.name ?? ''}`}
        description={editing?.email}
        footer={
          <>
            <Button variant="danger" onClick={() => setRemoving(editing)}>Remove</Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveMember} loading={busy}>Save changes</Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Role">
            <Select
              value={editing?.role ?? 'Viewer'}
              onChange={(e) => editing && setEditing({ ...editing, role: e.target.value as MemberRecord['role'] })}
            >
              {roles.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Access" hint="Suspending keeps the record but blocks sign-in.">
            <Select
              value={editing?.status ?? 'active'}
              onChange={(e) => editing && setEditing({ ...editing, status: e.target.value as MemberRecord['status'] })}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              {editing?.status === 'invited' && <option value="invited">Invite pending</option>}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ''}?`}
        description="They lose access immediately. Devices and groups are untouched."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep them</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Remove member</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">
          You can invite them again later; it will be a fresh invitation.
        </p>
      </Modal>
    </>
  )
}
