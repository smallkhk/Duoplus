/**
 * The MADOVA assistant.
 *
 * Claude runs the conversation and calls the tools in assistant-tools.ts, which
 * act on the customer's real account. The loop is written by hand rather than
 * using the SDK tool runner so each tool call can be streamed to the browser as
 * it happens — customers see "Restarted 3 devices" while it is working, not
 * only at the end.
 *
 * With no model credentials configured the assistant falls back to a
 * deterministic intent router (see `runFallback`). It runs the same tools, so
 * device control and purchases still work; it just cannot converse. The UI
 * labels that mode so nobody mistakes it for the model.
 */
import Anthropic from '@anthropic-ai/sdk'
import { REGIONS } from './fleet.js'
import { searchArticles } from './knowledge.js'
import { runTool, TOOL_DEFINITIONS, type ToolContext } from './assistant-tools.js'
import { accountSummary, DURATIONS } from './billing.js'
import type { Order, SupportThread, User } from './store.js'

export const MODEL = process.env.MADOVA_ASSISTANT_MODEL ?? 'claude-opus-5'

/**
 * The SDK resolves credentials from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or
 * a stored CLI profile, so we only construct the client when one of those is
 * present and let it fail loudly if the credential is bad.
 */
const hasCredential = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
export const assistantConfigured = () => hasCredential

const client = hasCredential ? new Anthropic() : null

const MAX_TOOL_ROUNDS = 6

const STABLE_SYSTEM = `You are the MADOVA assistant — the support and operations assistant on madova.io.

MADOVA resells antidetect cloud phones: real ARM Android devices hosted in data centres, each with its own environment, storage and hardware identity. Customers use them to run many isolated accounts — social media, e-commerce, airdrop farming, app QA, ad operations — and partners resell capacity under their own brand.

WHAT YOU DO
You are connected to the customer's actual account through tools. You can read their fleet, power devices on and off, restart them, change a device's name, remark, GPS, timezone or language, run an ADB command, prepare purchases and renewals, read their orders, search the knowledge base, and hand the thread to a human.

HOW TO WORK
- Product questions: call search_knowledge first and answer from what it returns. If it returns nothing relevant, say you don't know and offer to pass it to a human. Never invent a price, a limit or a feature.
- Account questions: call get_account_summary or list_phones. Never guess what the customer owns.
- Actions: just do them. Powering, restarting and setting changes are free and reversible, so act rather than asking permission — but if the customer's instruction is ambiguous about WHICH devices, list the candidates and ask before acting on a large set.
- Find device IDs with list_phones before acting when you were given a name rather than an ID.
- Report what actually happened, including partial failures. If three of five devices restarted, say so and say why the other two didn't.

MONEY
prepare_device_purchase and prepare_renewal only prepare an order. They never charge. The customer gets an Approve button in the chat and only they can complete it. After calling one, state the total in dollars and say it is waiting for their approval. Never claim a purchase is complete.

WHEN THEY ARE NOT SIGNED IN
Answer from the knowledge base and offer to take a message. Account tools will refuse; when that happens, ask them to sign in rather than apologising at length.

STYLE
Short, plain and concrete. No preamble, no restating the question, no bullet lists unless you are genuinely enumerating. Prices in dollars, device names as the customer wrote them. If you cannot do something, say what you can do instead. Never claim to have done something a tool did not confirm.`

function contextBlock(user: User | null): string {
  if (!user) {
    return `SESSION: the visitor is not signed in. Account tools will refuse. Regions available: ${REGIONS.map((r) => `${r.area} (${r.region})`).join(', ')}. Subscription terms: ${DURATIONS.join(', ')} days.`
  }
  const s = accountSummary(user.id)
  return `SESSION: signed in as ${user.name} <${user.email}>${user.company ? ` at ${user.company}` : ''}.
Plan: ${s.plan}. Devices: ${s.phones_total} (${s.phones_powered_on} powered on, ${s.phones_powered_off} powered off, ${s.phones_expired} expired). Prepaid minutes: ${s.minutes_balance}. Pending orders: ${s.orders_pending}.
Regions available: ${REGIONS.map((r) => `${r.area} (${r.region})`).join(', ')}. Subscription terms: ${DURATIONS.join(', ')} days.
Today is ${new Date().toISOString().slice(0, 10)}.`
}

export interface AssistantEvents {
  onText?: (delta: string) => void
  onTool?: (t: { name: string; summary: string; ok: boolean }) => void
  onOrder?: (order: Order) => void
}

export interface AssistantReply {
  text: string
  actions: { name: string; summary: string; ok: boolean }[]
  pendingOrder?: Order
  escalated: boolean
  mode: 'model' | 'fallback'
}

/** Convert stored thread history into API messages. */
function toMessages(thread: SupportThread): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = []
  for (const m of thread.messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text })
    else if (m.role === 'assistant' || m.role === 'agent') out.push({ role: 'assistant', content: m.text })
    /* System notes are context for humans, not for the model. */
  }
  /* The API requires the first message to be from the user. */
  while (out.length > 0 && out[0].role !== 'user') out.shift()
  return out
}

export async function runAssistant(opts: {
  user: User | null
  thread: SupportThread
  events?: AssistantEvents
}): Promise<AssistantReply> {
  if (!client) return runFallback(opts)

  const ctx: ToolContext = { user: opts.user, threadId: opts.thread.id }
  const actions: AssistantReply['actions'] = []
  const messages = toMessages(opts.thread)
  let text = ''

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: [
          { type: 'text', text: STABLE_SYSTEM, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contextBlock(opts.user) },
        ],
        tools: TOOL_DEFINITIONS,
        messages,
      })

      stream.on('text', (delta) => {
        text += delta
        opts.events?.onText?.(delta)
      })

      const response = await stream.finalMessage()

      if (response.stop_reason === 'refusal') {
        const explanation = response.stop_details?.explanation ?? 'The request was declined.'
        return { text: explanation, actions, escalated: false, mode: 'model' }
      }

      messages.push({ role: 'assistant', content: response.content })

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )
      if (toolUses.length === 0) break

      /* All tool_result blocks must go back in a single user message. */
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const call of toolUses) {
        let outcome
        try {
          outcome = await runTool(call.name, call.input, ctx)
        } catch (err) {
          outcome = {
            ok: false,
            summary: `${call.name} failed`,
            result: { error: err instanceof Error ? err.message : String(err) },
          }
        }
        actions.push({ name: call.name, summary: outcome.summary, ok: outcome.ok })
        opts.events?.onTool?.({ name: call.name, summary: outcome.summary, ok: outcome.ok })
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(outcome.result),
          is_error: !outcome.ok,
        })
      }
      messages.push({ role: 'user', content: results })

      if (ctx.pendingOrder) opts.events?.onOrder?.(ctx.pendingOrder)
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return {
        text: 'My model credentials are not valid, so I am running in basic mode. I can still control devices and look things up — try "restart <device name>" or "how does billing work".',
        actions, escalated: false, mode: 'fallback',
      }
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { text: 'I am rate limited right now — give me a few seconds and ask again.', actions, escalated: false, mode: 'model' }
    }
    if (err instanceof Anthropic.APIError) {
      return { text: `The model returned an error (${err.status}). Falling back: ${(await runFallback(opts)).text}`, actions, escalated: false, mode: 'fallback' }
    }
    throw err
  }

  return {
    text: text.trim() || 'Done.',
    actions,
    pendingOrder: ctx.pendingOrder,
    escalated: Boolean(ctx.escalated),
    mode: 'model',
  }
}

/* ------------------------------------------------------------------ *
 * Fallback: a deterministic intent router.
 *
 * It runs the same tools as the model path, so every action it takes is real.
 * It exists so the product works without model credentials, not to imitate the
 * model — the UI says which mode produced a reply.
 * ------------------------------------------------------------------ */

const REGION_ALIASES: Record<string, string> = {
  us: 'us-west', usa: 'us-west', america: 'us-west', 'united states': 'us-west',
  germany: 'eu-central', german: 'eu-central', de: 'eu-central', europe: 'eu-central', eu: 'eu-central',
  uk: 'uk-south', britain: 'uk-south', england: 'uk-south', 'united kingdom': 'uk-south',
  singapore: 'sg-central', sg: 'sg-central',
  japan: 'jp-east', jp: 'jp-east',
  brazil: 'br-south', br: 'br-south',
  india: 'in-west', in: 'in-west',
  uae: 'ae-north', dubai: 'ae-north', emirates: 'ae-north',
  indonesia: 'id-west', id: 'id-west',
  nigeria: 'ng-lagos', ng: 'ng-lagos', lagos: 'ng-lagos',
}

function detectRegion(text: string): string | null {
  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(text)) return region
  }
  return REGIONS.find((r) => text.toLowerCase().includes(r.area.toLowerCase()))?.region ?? null
}

/** Pull the device selector out of a phrase like "restart TikTok-US-014". */
function detectTarget(text: string): { phone_ids?: string[]; name_contains?: string; group_name?: string } | null {
  const idish = text.match(/\b([A-Za-z0-9]{5})\b(?!.*\b(?:group|all)\b)/)
  const named = text.match(/(?:restart|reboot|power\s*(?:on|off)|start|stop|shut\s*down|turn\s*(?:on|off))\s+(?:the\s+)?(?:device\s+|phone\s+)?["']?([A-Za-z0-9][\w.-]{2,})["']?/i)
  const group = text.match(/group\s+["']?([\w .-]{2,})["']?/i)

  if (group) return { group_name: group[1].trim() }
  if (named && !/^(all|every|everything)$/i.test(named[1])) return { name_contains: named[1].trim() }
  if (/\b(all|every|everything)\b/i.test(text)) return {}
  if (idish) return { phone_ids: [idish[1]] }
  return null
}

export async function runFallback(opts: {
  user: User | null
  thread: SupportThread
  events?: AssistantEvents
}): Promise<AssistantReply> {
  const ctx: ToolContext = { user: opts.user, threadId: opts.thread.id }
  const actions: AssistantReply['actions'] = []
  const lastUser = [...opts.thread.messages].reverse().find((m) => m.role === 'user')
  const text = lastUser?.text ?? ''
  const lower = text.toLowerCase()

  const emit = (t: string): AssistantReply => {
    opts.events?.onText?.(t)
    return { text: t, actions, pendingOrder: ctx.pendingOrder, escalated: Boolean(ctx.escalated), mode: 'fallback' }
  }

  const call = async (name: string, input: unknown) => {
    const outcome = await runTool(name, input, ctx)
    actions.push({ name, summary: outcome.summary, ok: outcome.ok })
    opts.events?.onTool?.({ name, summary: outcome.summary, ok: outcome.ok })
    return outcome
  }

  if (/\b(human|agent|person|representative|speak to someone|talk to someone)\b/.test(lower)) {
    await call('escalate_to_human', { reason: text.slice(0, 200) })
    return emit('Passed to the support team — someone will reply within one business day.')
  }

  if (!opts.user && /\b(my|account|device|phone|restart|buy|order|balance)\b/.test(lower)) {
    const hits = searchArticles(text, 1)
    return emit(
      `You will need to sign in before I can touch your account.${hits[0] ? ` In the meantime: ${hits[0].summary}` : ''}`,
    )
  }

  /* Device control */
  const action = /\b(restart|reboot)\b/.test(lower) ? 'restart'
    : /\b(power\s*off|turn\s*off|shut\s*down|stop)\b/.test(lower) ? 'power_off'
    : /\b(power\s*on|turn\s*on|start|boot|switch\s*on)\b/.test(lower) ? 'power_on'
    : null

  if (action && opts.user) {
    const target = detectTarget(text)
    if (!target) {
      return emit('Which device? Give me its name or ID — or say "all" to act on the whole fleet.')
    }
    const outcome = await call('control_phones', { action, ...target })
    const r = outcome.result as { succeeded?: string[]; failed?: { device: string; reason: string }[]; error?: string }
    if (r.error) return emit(r.error)
    const done = r.succeeded ?? []
    const failed = r.failed ?? []
    let reply = done.length
      ? `${outcome.summary}: ${done.slice(0, 8).join(', ')}${done.length > 8 ? ` and ${done.length - 8} more` : ''}.`
      : 'Nothing changed.'
    if (failed.length) reply += ` ${failed.length} failed — ${failed[0].reason}`
    if (action !== 'power_off' && done.length) reply += ' They reach Powered on within a few seconds.'
    return emit(reply)
  }

  /* Purchase */
  if (/\b(buy|purchase|order|add|get)\b/.test(lower) && /\b(phone|device|instance)/.test(lower) && opts.user) {
    const qty = Number(text.match(/\b(\d{1,3})\b/)?.[1] ?? 1)
    const region = detectRegion(text) ?? 'us-west'
    const days = DURATIONS.find((d) => new RegExp(`\\b${d}\\b`).test(text)) ?? 30
    const outcome = await call('prepare_device_purchase', { quantity: qty, region, duration_days: days })
    const r = outcome.result as { total_usd?: string; error?: string }
    if (r.error) return emit(r.error)
    if (ctx.pendingOrder) opts.events?.onOrder?.(ctx.pendingOrder)
    return emit(`Prepared an order for ${qty} device${qty === 1 ? '' : 's'} in ${region} for ${days} days — $${r.total_usd}. Approve it below and I will provision them.`)
  }

  /* Renewal */
  if (/\brenew\b/.test(lower) && opts.user) {
    const target = detectTarget(text) ?? {}
    const days = DURATIONS.find((d) => new RegExp(`\\b${d}\\b`).test(text)) ?? 30
    const outcome = await call('prepare_renewal', { ...target, duration_days: days })
    const r = outcome.result as { total_usd?: string; devices?: string[]; error?: string }
    if (r.error) return emit(r.error)
    if (ctx.pendingOrder) opts.events?.onOrder?.(ctx.pendingOrder)
    return emit(`Prepared a ${days}-day renewal for ${r.devices?.length ?? 0} device(s) — $${r.total_usd}. Approve it below to apply it.`)
  }

  /* Fleet questions */
  if (opts.user && /\b(how many|list|show|status|fleet|devices|phones|my account|balance|plan|spend)\b/.test(lower)) {
    const summary = await call('get_account_summary', {})
    const s = summary.result as ReturnType<typeof accountSummary>
    if (/\b(list|show|which|name)\b/.test(lower)) {
      const listed = await call('list_phones', { limit: 10 })
      const l = listed.result as { phones?: { name: string; status: string }[]; total?: number }
      const rows = (l.phones ?? []).map((p) => `${p.name} — ${p.status}`).join('\n')
      return emit(`You have ${s.phones_total} device${s.phones_total === 1 ? '' : 's'}. First ${l.phones?.length ?? 0}:\n${rows}`)
    }
    return emit(
      `Plan ${s.plan}. ${s.phones_total} device${s.phones_total === 1 ? '' : 's'} — ${s.phones_powered_on} powered on, ${s.phones_powered_off} off${s.phones_expired ? `, ${s.phones_expired} expired` : ''}. ${s.minutes_balance.toLocaleString('en-US')} prepaid minutes. ${s.orders_pending} order(s) awaiting approval.`,
    )
  }

  /* Knowledge */
  const outcome = await call('search_knowledge', { query: text })
  const r = outcome.result as { articles?: { title: string; body: string }[] }
  const top = r.articles?.[0]
  if (!top) {
    await call('escalate_to_human', { reason: text.slice(0, 200) })
    return emit('I could not find an answer to that, so I have passed it to the support team — they reply within one business day.')
  }
  const excerpt = top.body.split('\n\n').slice(0, 2).join('\n\n')
  return emit(`${top.title}\n\n${excerpt}`)
}
