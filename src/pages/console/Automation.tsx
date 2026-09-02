import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Dot, EmptyState, Field, Input, Modal, Select, Skeleton, cx, useToast,
} from '@/components/ui'
import { api, ApiError, type GroupRecord, type TaskRecord } from '@/lib/api'
import { useAllPhones } from '@/lib/hooks'

const STATUS_TONE: Record<TaskRecord['status'], 'ok' | 'brand' | 'neutral' | 'danger'> = {
  running: 'ok', scheduled: 'brand', paused: 'neutral', failed: 'danger',
}

/** Prefills for the create dialog — each maps onto a real action the fleet supports. */
const TEMPLATES = [
  {
    icon: 'restart', title: 'Nightly restart',
    body: 'Reboot a whole group once a day so long-lived sessions and leaked memory get cleared out.',
    fill: { name: 'Nightly restart', action: 'restart', trigger: 'daily', command: '' },
  },
  {
    icon: 'power', title: 'Wake the fleet',
    body: 'Power on every device in a group on a schedule, ready for the working day.',
    fill: { name: 'Wake the fleet', action: 'power_on', trigger: 'daily', command: '' },
  },
  {
    icon: 'sync', title: 'Warm-up scroll',
    body: 'Open an app and scroll for a while, so an account has ordinary activity before it posts.',
    fill: {
      name: 'Warm-up scroll',
      action: 'command',
      trigger: 'daily',
      command: 'input swipe 540 1600 540 400',
    },
  },
  {
    icon: 'terminal', title: 'Health check',
    body: 'Run one ADB command across a group and record how many devices answered.',
    fill: { name: 'Health check', action: 'command', trigger: 'hourly', command: 'getprop ro.product.model' },
  },
]

const BLANK = { name: '', action: 'restart', trigger: 'daily', group_id: '', command: '' }

export function Automation() {
  const toast = useToast()
  const { phones } = useAllPhones()

  const [tasks, setTasks] = useState<TaskRecord[] | null>(null)
  const [actions, setActions] = useState<{ id: string; label: string }[]>([])
  const [triggers, setTriggers] = useState<string[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [removing, setRemoving] = useState<TaskRecord | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.tasks()
      .then((d) => { setTasks(d.tasks); setActions(d.actions); setTriggers(d.triggers) })
      .catch(() => setTasks([]))
  }, [])

  useEffect(() => {
    load()
    api.groups().then((d) => setGroups(d.groups)).catch(() => setGroups([]))
  }, [load])

  const rows = tasks ?? []
  const countBy = (status: TaskRecord['status']) => rows.filter((t) => t.status === status).length

  const openFrom = (fill?: typeof BLANK) => { setForm(fill ? { ...BLANK, ...fill } : BLANK); setOpen(true) }

  const create = async () => {
    setBusy(true)
    try {
      const { task } = await api.createTask({
        name: form.name,
        action: form.action,
        trigger: form.trigger,
        group_id: form.group_id || undefined,
        command: form.action === 'command' ? form.command : undefined,
      })
      toast(`${task.name} created — ${task.targets} device${task.targets === 1 ? '' : 's'} in scope.`, 'ok')
      setOpen(false)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create that task.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (t: TaskRecord) => {
    const next = t.status === 'paused' ? 'scheduled' : 'paused'
    try {
      await api.setTaskStatus(t.id, next)
      setTasks((cur) => (cur ?? []).map((x) => (x.id === t.id ? { ...x, status: next } : x)))
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not change that task.', 'danger')
    }
  }

  const run = async (t: TaskRecord) => {
    setRunning(t.id)
    try {
      const { ok, failed } = await api.runTask(t.id)
      toast(failed === 0
        ? `${t.name} ran on ${ok} device${ok === 1 ? '' : 's'}.`
        : `${t.name}: ${ok} succeeded, ${failed} failed.`, failed === 0 ? 'ok' : 'danger')
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That run failed.', 'danger')
    } finally {
      setRunning(null)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.deleteTask(removing.id)
      toast(`${removing.name} deleted.`, 'ok')
      setRemoving(null)
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete that task.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const scopeSize = form.group_id
    ? (phones ?? []).filter((p) => p.group.some((g) => g.id === form.group_id)).length
    : (phones ?? []).length

  return (
    <>
      <PageHeader
        title="Tasks & RPA"
        lead="Schedules and on-demand runs that fan out across the fleet. Every run records how many devices answered, per task."
        actions={<Button size="sm" icon="plus" onClick={() => openFrom()}>New task</Button>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {([
          ['Running', 'running', 'ok'],
          ['Scheduled', 'scheduled', 'brand'],
          ['Paused', 'paused', 'neutral'],
          ['Failing', 'failed', 'danger'],
        ] as const).map(([label, status, tone]) => (
          <Card key={label} className="flex items-center gap-3 p-5">
            <Dot tone={tone} />
            <span>
              <span className="block text-[0.76rem] text-ink-400">{label}</span>
              <span className="mt-0.5 block font-mono text-xl font-semibold text-ink-50">
                {tasks === null ? '—' : countBy(status)}
              </span>
            </span>
          </Card>
        ))}
      </div>

      {tasks?.length === 0 ? (
        <div className="mb-4">
          <EmptyState
            icon="workflow"
            title="No tasks yet"
            body="A task addresses a group and runs a real fleet action — power, restart, or an ADB command — on a schedule or on demand."
            action={<Button icon="plus" onClick={() => openFrom()}>Create the first task</Button>}
          />
        </div>
      ) : (
        <Card className="mb-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-[0.82rem]">
              <thead>
                <tr className="border-b border-ink-800 bg-ink-900/50 text-[0.7rem] uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Trigger</th>
                  <th className="px-5 py-3 font-medium">Targets</th>
                  <th className="px-5 py-3 font-medium">Last run</th>
                  <th className="px-5 py-3 font-medium">Success</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {tasks === null && Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }, (_, j) => (
                    <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                  ))}</tr>
                ))}

                {tasks?.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-ink-800/40">
                    <td className="px-5 py-3.5">
                      <span className="block font-medium text-ink-100">{t.name}</span>
                      <span className="block font-mono text-[0.68rem] text-ink-500">{t.action}</span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-300">{t.trigger}</td>
                    <td className="px-5 py-3.5 font-mono text-ink-200">{t.targets}</td>
                    <td className="px-5 py-3.5 font-mono text-[0.74rem] text-ink-400">{t.last_run}</td>
                    <td className="px-5 py-3.5">
                      {t.last_run === '—' ? (
                        <span className="text-[0.76rem] text-ink-600">never run</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-800">
                            <div
                              className={cx('h-full rounded-full',
                                t.success_rate > 90 ? 'bg-ok' : t.success_rate > 70 ? 'bg-warn' : 'bg-danger')}
                              style={{ width: `${t.success_rate}%` }}
                            />
                          </div>
                          <span className="font-mono text-[0.74rem] text-ink-300">{t.success_rate}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge></td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => toggle(t)}
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                          aria-label={t.status === 'paused' ? `Resume ${t.name}` : `Pause ${t.name}`}
                        >
                          <Icon name={t.status === 'paused' ? 'play' : 'pause'} className="size-3.5" />
                        </button>
                        <button
                          onClick={() => run(t)}
                          disabled={running === t.id}
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-50"
                          aria-label={`Run ${t.name} now`}
                        >
                          <Icon name={running === t.id ? 'refresh' : 'bolt'}
                            className={cx('size-3.5', running === t.id && 'animate-spin')} />
                        </button>
                        <button
                          onClick={() => setRemoving(t)}
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-danger/10 hover:text-danger"
                          aria-label={`Delete ${t.name}`}
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

      <div>
        <h2 className="mb-3 text-[0.9rem] font-semibold text-ink-50">Start from a template</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATES.map((t) => (
            <Card key={t.title} className="p-5" hover>
              <button onClick={() => openFrom({ ...BLANK, ...t.fill })} className="w-full text-left">
                <span className="grid size-9 place-items-center rounded-lg bg-ink-800 text-brand-300">
                  <Icon name={t.icon} className="size-4" />
                </span>
                <span className="mt-4 block text-[0.92rem] font-semibold text-ink-50">{t.title}</span>
                <span className="mt-1.5 block text-[0.79rem] leading-relaxed text-ink-400">{t.body}</span>
              </button>
            </Card>
          ))}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New automation task"
        description="Tasks address a group and run a real fleet action, on a schedule or on demand."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={create}
              loading={busy}
              disabled={form.name.trim().length < 2 || (form.action === 'command' && !form.command.trim())}
            >
              Create task
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Warm-up scroll · TikTok US"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Action">
              <Select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                {actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </Select>
            </Field>
            <Field label="Trigger">
              <Select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
                {triggers.map((t) => (
                  <option key={t} value={t}>{t === 'manual' ? 'Manual only' : `Every ${t.replace('ly', '')}`}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Target group"
            hint={`${scopeSize} device${scopeSize === 1 ? '' : 's'} in scope right now.`}
          >
            <Select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
              <option value="">Whole fleet</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          {form.action === 'command' && (
            <Field label="ADB command" hint="One command. It runs within the 10-second ADB limit on each device.">
              <Input
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                className="font-mono"
                placeholder="input swipe 540 1600 540 400"
              />
            </Field>
          )}
          {scopeSize === 0 && (
            <p className="text-[0.8rem] text-warn">
              Nothing is in that group, so the task would never do anything.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        description="The task and its run history are removed. Devices are untouched."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Delete task</Button>
          </>
        }
      >
        <p className="text-[0.82rem] leading-relaxed text-ink-400">This cannot be undone.</p>
      </Modal>
    </>
  )
}
