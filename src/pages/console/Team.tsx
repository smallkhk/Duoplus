import { useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import { Badge, Button, Card, Field, Input, Modal, Select, useToast } from '@/components/ui'
import { TEAM } from '@/lib/duoplus/mock'
import type { TeamMember } from '@/lib/duoplus/types'

const ROLE_TONE: Record<TeamMember['role'], 'brand' | 'accent' | 'neutral'> = {
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

export function Team() {
  const toast = useToast()
  const [open, setOpen] = useState(false)

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
                {TEAM.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-ink-800/40">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[0.66rem] font-semibold text-white">
                          {m.name.split(' ').map((n) => n[0]).join('')}
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
                        <button
                          onClick={() => toast('Editing members is not wired up in this demo build.', 'info')}
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                          aria-label={`Manage ${m.name}`}
                        >
                          <Icon name="settings" className="size-3.5" />
                        </button>
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
            <Button onClick={() => { setOpen(false); toast('Invitations are not wired up in this demo build.', 'info') }}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Work email"><Input type="email" placeholder="colleague@company.com" /></Field>
          <Field label="Role" hint="Operators can drive phones but cannot provision or bill.">
            <Select defaultValue="Operator">
              {['Admin', 'Operator', 'Viewer'].map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Scope" hint="Limit what they can see to a single group if you want.">
            <Select defaultValue="all">
              <option value="all">The whole fleet</option>
              <option value="group">One group only</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}
