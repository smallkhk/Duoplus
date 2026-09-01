/**
 * The tools the assistant can actually run.
 *
 * Each tool is defined once here: the JSON schema the model sees, and the handler
 * that executes it. Handlers go through the same fleet and billing modules the
 * console uses, so there is no second code path that could drift.
 *
 * Two rules hold for every tool:
 *   - Nothing touches a device that is not on the caller's account.
 *   - Nothing spends money. Purchases and renewals are prepared as pending
 *     orders that only the customer can approve.
 */
import type OpenAI from 'openai'
import { cloudCall, REGIONS, REGION_INDEX } from './fleet.js'
import { accountSummary, createOrder, createRenewalOrder, DURATIONS, ordersOf } from './billing.js'
import { searchArticles } from './knowledge.js'
import { mutate, nowIso, prefixedId, type Order, type User } from './store.js'
import { PHONE_STATUS_LABEL, type CloudPhone, type Paged } from '../src/lib/duoplus/types.js'

export interface ToolContext {
  user: User | null
  threadId: string
  /** Set by a tool when it raises an order the customer must approve. */
  pendingOrder?: Order
  /** Set when the assistant hands off to a human. */
  escalated?: boolean
}

export interface ToolOutcome {
  /** What the model sees. */
  result: unknown
  /** One line for the transcript UI. */
  summary: string
  ok: boolean
}

const REGION_NAMES = REGIONS.map((r) => r.region)

const TOOL_SPECS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: 'search_knowledge',
    description:
      'Search the MADOVA knowledge base for how the product works — pricing, device states, fingerprints, proxies, the API, reselling, troubleshooting. Use this before answering any factual question about the product; do not answer product questions from memory.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look up, in the customer\'s own words.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_account_summary',
    description:
      "Read the signed-in customer's account: plan, prepaid minute balance, how many devices they have and in what state, which regions, order count and total spend. Use this whenever the answer depends on their actual account.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_phones',
    description:
      "List the customer's cloud phones, optionally filtered. Use it to find device IDs before acting on them, and to answer questions about what they have.",
    parameters: {
      type: 'object',
      properties: {
        name_contains: { type: 'string', description: 'Match device names containing this text.' },
        status: {
          type: 'string',
          enum: ['powered_on', 'powered_off', 'expired', 'booting', 'any'],
          description: 'Filter by device state. Defaults to any.',
        },
        region: { type: 'string', enum: REGION_NAMES, description: 'Filter by region id.' },
        limit: { type: 'integer', description: 'Maximum devices to return, 1-50. Defaults to 20.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'control_phones',
    description:
      'Power devices on, power them off, or restart them. Select devices either by explicit phone_ids, or by name_contains / group_name to act on a set. This performs the action immediately — it is free, so it does not need approval. Never use it on devices you have not confirmed belong to the customer.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['power_on', 'power_off', 'restart'] },
        phone_ids: { type: 'array', items: { type: 'string' }, description: 'Exact device IDs.' },
        name_contains: { type: 'string', description: 'Act on every device whose name contains this text.' },
        group_name: { type: 'string', description: 'Act on every device in this group.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_phone',
    description:
      "Change a single device's settings: its name, remark, GPS coordinates, timezone or language. Omitted fields are left untouched. Free and immediate.",
    parameters: {
      type: 'object',
      properties: {
        phone_id: { type: 'string', description: 'The device ID to change.' },
        name: { type: 'string' },
        remark: { type: 'string' },
        timezone: { type: 'string', description: 'IANA timezone, e.g. America/Los_Angeles.' },
        language: { type: 'string', description: 'Locale tag, e.g. en-US.' },
        latitude: { type: 'string' },
        longitude: { type: 'string' },
      },
      required: ['phone_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'run_adb_command',
    description:
      'Run one ADB shell command on a device and return its output. The "adb shell" prefix is not needed and the command must finish within ten seconds. Use it for diagnostics such as getprop, pm list packages or wm size.',
    parameters: {
      type: 'object',
      properties: {
        phone_id: { type: 'string' },
        command: { type: 'string', description: 'e.g. getprop ro.product.model' },
      },
      required: ['phone_id', 'command'],
      additionalProperties: false,
    },
  },
  {
    name: 'prepare_device_purchase',
    description:
      'Prepare an order for new cloud phones and show the customer the total. This does NOT buy anything — it returns a pending order the customer must approve in the chat. Always state the total and the term back to them after calling it.',
    parameters: {
      type: 'object',
      properties: {
        quantity: { type: 'integer', description: 'Number of devices, 1-500.' },
        region: { type: 'string', enum: REGION_NAMES, description: 'Where to provision them.' },
        duration_days: { type: 'integer', enum: DURATIONS, description: 'Subscription term in days.' },
        minutes: { type: 'integer', description: 'Optional prepaid startup minutes to add.' },
        group_name: { type: 'string', description: 'Optional group to place them in.' },
      },
      required: ['quantity', 'region', 'duration_days'],
      additionalProperties: false,
    },
  },
  {
    name: 'prepare_renewal',
    description:
      'Prepare an order that extends the subscription on existing devices. Like a purchase, this only prepares it — the customer approves it in the chat. Select devices by phone_ids or name_contains.',
    parameters: {
      type: 'object',
      properties: {
        phone_ids: { type: 'array', items: { type: 'string' } },
        name_contains: { type: 'string' },
        duration_days: { type: 'integer', enum: DURATIONS },
      },
      required: ['duration_days'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_orders',
    description: "List the customer's recent orders with their status and totals.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'escalate_to_human',
    description:
      'Hand the conversation to the human support team. Use it when the customer asks for a person, when something needs an account change you cannot make, or when you have failed to resolve the issue.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'A one-line summary for the human picking it up.' },
      },
      required: ['reason'],
      additionalProperties: false,
    },
  },
]

/** The same tools in the OpenAI function-calling shape every provider accepts. */
export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = TOOL_SPECS.map(
  (t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }),
)

export const TOOL_NAMES = TOOL_SPECS.map((t) => t.name)

const STATUS_FILTER: Record<string, string[] | undefined> = {
  powered_on: ['1'],
  powered_off: ['2'],
  expired: ['3', '4'],
  booting: ['10', '11'],
  any: undefined,
}

function brief(p: CloudPhone) {
  return {
    id: p.id,
    name: p.name,
    status: PHONE_STATUS_LABEL[p.status] ?? 'Unknown',
    os: p.os,
    region: REGION_INDEX[p.region]?.area ?? p.region,
    group: p.group.map((g) => g.name).join(', '),
    expires: p.expired_at.slice(0, 10),
    model: p.device.model,
  }
}

async function resolveTargets(
  user: User,
  args: { phone_ids?: string[]; name_contains?: string; group_name?: string },
): Promise<{ phones: CloudPhone[]; error?: string }> {
  if (args.phone_ids?.length) {
    const env = await cloudCall(user, '/api/v1/cloudPhone/list', { image_id: args.phone_ids, pagesize: 100 })
    const list = (env.data as Paged<CloudPhone> | null)?.list ?? []
    if (list.length === 0) return { phones: [], error: 'No device on your account matches those IDs.' }
    return { phones: list }
  }

  const body: Record<string, unknown> = { pagesize: 100 }
  if (args.name_contains) body.name = args.name_contains
  const env = await cloudCall(user, '/api/v1/cloudPhone/list', body)
  let list = (env.data as Paged<CloudPhone> | null)?.list ?? []

  if (args.group_name) {
    const needle = args.group_name.toLowerCase()
    list = list.filter((p) => p.group.some((g) => g.name.toLowerCase().includes(needle)))
  }
  if (list.length === 0) return { phones: [], error: 'No device on your account matches that selection.' }
  return { phones: list }
}

const ACTION_PATH = {
  power_on: '/api/v1/cloudPhone/batchPowerOn',
  power_off: '/api/v1/cloudPhone/batchPowerOff',
  restart: '/api/v1/cloudPhone/batchRestart',
} as const

const ACTION_VERB = { power_on: 'Powered on', power_off: 'Powered off', restart: 'Restarted' } as const

const needsAuth = (name: string) => name !== 'search_knowledge' && name !== 'escalate_to_human'

export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const args = (rawInput ?? {}) as Record<string, any>

  if (needsAuth(name) && !ctx.user) {
    return {
      ok: false,
      summary: 'Sign-in required',
      result: { error: 'The customer is not signed in. Ask them to sign in, then retry.' },
    }
  }
  const user = ctx.user as User

  switch (name) {
    case 'search_knowledge': {
      const hits = searchArticles(String(args.query ?? ''), 4)
      return {
        ok: true,
        summary: `Searched the knowledge base for "${String(args.query ?? '').slice(0, 40)}"`,
        result: hits.length === 0
          ? { articles: [], note: 'Nothing matched. Say so rather than inventing an answer.' }
          : { articles: hits.map((a) => ({ id: a.id, title: a.title, category: a.category, body: a.body })) },
      }
    }

    case 'get_account_summary':
      return { ok: true, summary: 'Read the account summary', result: accountSummary(user.id) }

    case 'list_phones': {
      const limit = Math.max(1, Math.min(50, Number(args.limit) || 20))
      const body: Record<string, unknown> = { pagesize: limit, page: 1 }
      if (args.name_contains) body.name = args.name_contains
      if (args.region) body.region_id = [args.region]
      const statusFilter = STATUS_FILTER[String(args.status ?? 'any')]
      if (statusFilter) body.link_status = statusFilter

      const env = await cloudCall(user, '/api/v1/cloudPhone/list', body)
      if (env.code !== 200) return { ok: false, summary: 'Could not list devices', result: { error: env.message } }
      const data = env.data as Paged<CloudPhone>
      return {
        ok: true,
        summary: `Listed ${data.list.length} of ${data.total} devices`,
        result: { total: data.total, showing: data.list.length, phones: data.list.map(brief) },
      }
    }

    case 'control_phones': {
      const action = String(args.action) as keyof typeof ACTION_PATH
      if (!ACTION_PATH[action]) {
        return { ok: false, summary: 'Unknown action', result: { error: 'action must be power_on, power_off or restart' } }
      }
      const { phones, error } = await resolveTargets(user, args)
      if (error) return { ok: false, summary: error, result: { error } }

      /* Batch endpoints take 20 IDs per call. */
      const ids = phones.map((p) => p.id)
      const succeeded: string[] = []
      const failures: Record<string, string> = {}
      for (let i = 0; i < ids.length; i += 20) {
        const env = await cloudCall(user, ACTION_PATH[action], { image_ids: ids.slice(i, i + 20) })
        if (env.code !== 200) {
          return { ok: false, summary: `${action} failed`, result: { error: env.message } }
        }
        const r = env.data as { success: string[]; fail: string[]; fail_reason: Record<string, string> }
        succeeded.push(...r.success)
        Object.assign(failures, r.fail_reason)
      }
      const nameOf = (id: string) => phones.find((p) => p.id === id)?.name ?? id
      return {
        ok: failures && Object.keys(failures).length === 0,
        summary: `${ACTION_VERB[action]} ${succeeded.length} device${succeeded.length === 1 ? '' : 's'}`,
        result: {
          action,
          succeeded: succeeded.map(nameOf),
          failed: Object.entries(failures).map(([id, reason]) => ({ device: nameOf(id), reason })),
          note: action === 'restart' || action === 'power_on'
            ? 'Devices move through "Powering on" and reach "Powered on" within a few seconds.'
            : undefined,
        },
      }
    }

    case 'update_phone': {
      const image: Record<string, unknown> = { image_id: String(args.phone_id) }
      if (args.name) image.name = String(args.name)
      if (args.remark !== undefined) image.remark = String(args.remark)
      if (args.timezone || args.language) {
        image.locale = { type: 2, timezone: args.timezone, language: args.language }
      }
      if (args.latitude || args.longitude) {
        image.gps = { type: 2, latitude: args.latitude, longitude: args.longitude }
      }
      const env = await cloudCall(user, '/api/v1/cloudPhone/update', { images: [image] })
      if (env.code !== 200) return { ok: false, summary: 'Update failed', result: { error: env.message } }
      const r = env.data as { success: string[]; fail: string[]; fail_reason: Record<string, string> }
      const ok = r.success.length > 0
      return {
        ok,
        summary: ok ? `Updated device ${args.phone_id}` : 'Device not updated',
        result: ok ? { updated: r.success } : { error: r.fail_reason[String(args.phone_id)] ?? 'Device not found' },
      }
    }

    case 'run_adb_command': {
      const env = await cloudCall(user, '/api/v1/cloudPhone/command', {
        image_id: String(args.phone_id),
        command: String(args.command ?? ''),
      })
      if (env.code !== 200) return { ok: false, summary: 'ADB call failed', result: { error: env.message } }
      return {
        ok: true,
        summary: `Ran "${String(args.command).slice(0, 40)}" on ${args.phone_id}`,
        result: env.data,
      }
    }

    case 'prepare_device_purchase': {
      const order = createOrder(
        user,
        {
          quantity: Number(args.quantity) || 1,
          region: String(args.region),
          duration_days: Number(args.duration_days) || 30,
          minutes: args.minutes ? Number(args.minutes) : undefined,
          group_name: args.group_name ? String(args.group_name) : undefined,
        },
        'assistant',
        'Raised from the support chat',
      )
      ctx.pendingOrder = order
      return {
        ok: true,
        summary: `Prepared an order for ${order.provision?.quantity} device(s) — $${(order.total_cents / 100).toFixed(2)}`,
        result: {
          order_id: order.id,
          total_usd: (order.total_cents / 100).toFixed(2),
          discount_usd: (order.discount_cents / 100).toFixed(2),
          lines: order.lines.map((l) => l.description),
          status: 'pending',
          note: 'The customer sees an Approve button in the chat. Nothing is charged until they press it. Tell them the total and that it is awaiting their approval.',
        },
      }
    }

    case 'prepare_renewal': {
      const { phones, error } = await resolveTargets(user, args)
      if (error) return { ok: false, summary: error, result: { error } }
      const order = createRenewalOrder(
        user,
        { phone_ids: phones.map((p) => p.id), duration_days: Number(args.duration_days) || 30 },
        'assistant',
        'Raised from the support chat',
      )
      ctx.pendingOrder = order
      return {
        ok: true,
        summary: `Prepared a renewal for ${phones.length} device(s) — $${(order.total_cents / 100).toFixed(2)}`,
        result: {
          order_id: order.id,
          devices: phones.map((p) => p.name),
          total_usd: (order.total_cents / 100).toFixed(2),
          status: 'pending',
          note: 'Awaiting the customer\'s approval in the chat. Nothing is charged yet.',
        },
      }
    }

    case 'list_orders': {
      const orders = ordersOf(user.id).slice(0, 10)
      return {
        ok: true,
        summary: `Listed ${orders.length} order(s)`,
        result: {
          orders: orders.map((o) => ({
            id: o.id,
            status: o.status,
            total_usd: (o.total_cents / 100).toFixed(2),
            created_at: o.created_at,
            lines: o.lines.map((l) => l.description),
          })),
        },
      }
    }

    case 'escalate_to_human': {
      ctx.escalated = true
      mutate((d) => {
        const thread = d.threads.find((t) => t.id === ctx.threadId)
        if (thread) {
          thread.status = 'awaiting_human'
          thread.updated_at = nowIso()
          thread.messages.push({
            id: prefixedId('msg'),
            role: 'system',
            text: `Escalated to the support team: ${String(args.reason ?? '').slice(0, 300)}`,
            at: nowIso(),
          })
        }
      })
      return {
        ok: true,
        summary: 'Handed the thread to the support team',
        result: {
          status: 'awaiting_human',
          note: 'A human will pick this up. Tell the customer it has been passed on and roughly when to expect a reply (one business day).',
        },
      }
    }

    default:
      return { ok: false, summary: `Unknown tool ${name}`, result: { error: `Unknown tool ${name}` } }
  }
}
