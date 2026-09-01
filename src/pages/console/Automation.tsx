import { useState } from 'react'
import { PageHeader } from '@/components/ConsoleLayout'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, Card, Dot, Field, Input, Modal, Select, Textarea, cx, useToast,
} from '@/components/ui'
import { AUTOMATIONS, GROUPS } from '@/lib/duoplus/mock'
import type { AutomationTask } from '@/lib/duoplus/types'

const STATUS_TONE: Record<AutomationTask['status'], 'ok' | 'brand' | 'neutral' | 'danger'> = {
  running: 'ok', scheduled: 'brand', paused: 'neutral', failed: 'danger',
}

const TEMPLATES = [
  { icon: 'sync', title: 'Warm-up scroll', body: 'Open an app, scroll for a randomised interval, close it. Run daily before an account posts anything.' },
  { icon: 'fingerprint', title: 'Rotate fingerprint', body: 'Rewrite IMEI, GAID, Android ID and GPS across a group, then reboot into the new identity.' },
  { icon: 'drive', title: 'Deploy build', body: 'Trigger from a CI webhook: push the APK from the cloud drive, install it, launch it, screenshot.' },
  { icon: 'message', title: 'Harvest SMS codes', body: 'Poll bound cloud numbers and forward parsed verification codes to your own endpoint.' },
]

export function Automation() {
  const toast = useToast()
  const [tasks, setTasks] = useState(AUTOMATIONS)
  const [open, setOpen] = useState(false)

  const toggle = (id: string) => {
    setTasks((ts) => ts.map((t) => t.id === id
      ? { ...t, status: t.status === 'paused' ? 'scheduled' : 'paused' }
      : t))
  }

  return (
    <>
      <PageHeader
        title="Tasks & RPA"
        lead="Schedules, webhooks and recorded flows that fan out across the fleet. Failures are retried and reported per device rather than silently swallowed."
        actions={<Button size="sm" icon="plus" onClick={() => setOpen(true)}>New task</Button>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {[
          ['Running', tasks.filter((t) => t.status === 'running').length, 'ok'],
          ['Scheduled', tasks.filter((t) => t.status === 'scheduled').length, 'brand'],
          ['Paused', tasks.filter((t) => t.status === 'paused').length, 'neutral'],
          ['Failing', tasks.filter((t) => t.status === 'failed').length, 'danger'],
        ].map(([label, count, tone]) => (
          <Card key={label as string} className="flex items-center gap-3 p-5">
            <Dot tone={tone as 'ok' | 'brand' | 'neutral' | 'danger'} />
            <span>
              <span className="block text-[0.76rem] text-ink-400">{label as string}</span>
              <span className="mt-0.5 block font-mono text-xl font-semibold text-ink-50">{count as number}</span>
            </span>
          </Card>
        ))}
      </div>

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
              {tasks.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-ink-800/40">
                  <td className="px-5 py-3.5 font-medium text-ink-100">{t.name}</td>
                  <td className="px-5 py-3.5 text-ink-300">{t.trigger}</td>
                  <td className="px-5 py-3.5 font-mono text-ink-200">{t.targets}</td>
                  <td className="px-5 py-3.5 text-ink-400">{t.last_run}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-800">
                        <div
                          className={cx('h-full rounded-full', t.success_rate > 0.9 ? 'bg-ok' : t.success_rate > 0.7 ? 'bg-warn' : 'bg-danger')}
                          style={{ width: `${t.success_rate * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-[0.74rem] text-ink-300">{Math.round(t.success_rate * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge></td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => toggle(t.id)}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                        aria-label={t.status === 'paused' ? `Resume ${t.name}` : `Pause ${t.name}`}
                      >
                        <Icon name={t.status === 'paused' ? 'play' : 'pause'} className="size-3.5" />
                      </button>
                      <button
                        onClick={() => toast(`Run queued for ${t.name}.`, 'ok')}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                        aria-label={`Run ${t.name} now`}
                      >
                        <Icon name="bolt" className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-[0.9rem] font-semibold text-ink-50">Start from a template</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATES.map((t) => (
            <Card key={t.title} className="cursor-pointer p-5" hover>
              <button onClick={() => setOpen(true)} className="text-left">
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
        description="Tasks address a group and run on a schedule, a webhook, or on demand."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { setOpen(false); toast('Creating tasks is not wired up in this demo build.', 'info') }}>
              Create task
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Name"><Input placeholder="Warm-up scroll · TikTok US" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target group">
              <Select defaultValue={GROUPS[0].id}>
                {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
            <Field label="Trigger">
              <Select defaultValue="daily">
                <option value="daily">Every day</option>
                <option value="hourly">Every hour</option>
                <option value="webhook">Webhook</option>
                <option value="manual">Manual only</option>
              </Select>
            </Field>
          </div>
          <Field label="Steps" hint="One shell command per line. Each runs within the 10-second ADB limit.">
            <Textarea
              rows={5}
              className="font-mono"
              defaultValue={'am start -n com.zhiliaoapp.musically/.MainActivity\ninput swipe 540 1600 540 400\ninput keyevent 3'}
            />
          </Field>
          <Field label="Per-device jitter" hint="Randomises timing so the fleet does not move in lockstep.">
            <Select defaultValue="medium">
              <option value="none">None</option>
              <option value="low">Low — up to 5s</option>
              <option value="medium">Medium — up to 30s</option>
              <option value="high">High — up to 5 min</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  )
}
