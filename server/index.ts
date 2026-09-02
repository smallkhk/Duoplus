/**
 * MADOVA API server.
 *
 * Owns everything the browser must not: the cloud phone API key, password
 * hashes, session signing, order settlement and the model credentials. The SPA
 * talks only to this server.
 */
/* Must come first: it populates process.env before any module reads config. */
import { envFile } from './env.js'

import path from 'node:path'
import express from 'express'
import cookieParser from 'cookie-parser'

import {
  actorRole, attachUser, clearSession, createUser, issueSession, requireAuth, requireRole,
  validateRegistration, verifyPassword,
} from './auth.js'
import { cloudCall, upstreamConfigured } from './fleet.js'
import {
  accountSummary, cancelOrder, createOrder, DURATIONS, orderById, ordersOf, payOrder, quote,
} from './billing.js'
import { ARTICLES, CATEGORIES, articleById, searchArticles } from './knowledge.js'
import {
  applyCheck, checkIntent, createIntent, enabledChains, paymentConfig, paymentWarnings,
  type ChainId,
} from './crypto.js'
import { assistantConfigured, MODEL, PROVIDER_ID, PROVIDER_LABEL, runAssistant } from './assistant.js'
import { resourceRoutes } from './routes-resources.js'
import {
  InputError, acceptInvite, consumeResetToken, findInvite, issueResetToken, userForApiKey,
} from './resources.js'
import { DEMO_EMAIL, grantTrialPhone, seed } from './seed.js'
import {
  db, findUserByEmail, mutate, nowIso, prefixedId, publicUser, type SupportThread,
} from './store.js'

const app = express()
const PORT = Number(process.env.PORT ?? 8787)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(attachUser)

const envelope = (data: unknown) => ({ code: 200, data, message: 'Success' })
const errorOut = (res: express.Response, code: number, message: string) =>
  res.status(code).json({ code, data: null, message })

/* --------------------------------- meta --------------------------------- */

app.get('/api/meta', (_req, res) => {
  res.json(envelope({
    assistant: {
      configured: assistantConfigured(),
      model: MODEL,
      provider: PROVIDER_ID,
      provider_label: PROVIDER_LABEL,
    },
    cloud: { upstream: upstreamConfigured() },
    /* Whether a mail transport exists, so the console never promises an email
     * it cannot send. */
    mail: { configured: Boolean(process.env.MADOVA_SMTP_URL) },
    /* Whether the seeded demo account is still present, so the sign-in page can
     * offer it only when it exists. */
    demo_account: {
      email: DEMO_EMAIL,
      available: Boolean(findUserByEmail(DEMO_EMAIL)),
    },
    /* No OAuth backend yet — the sign-in page hides providers it cannot honour. */
    oauth: { providers: [] as string[] },
    durations: DURATIONS,
    payments: paymentConfig(),
  }))
})

/* --------------------------------- auth --------------------------------- */

app.post('/api/auth/register', (req, res) => {
  const problem = validateRegistration(req.body ?? {})
  if (problem) return errorOut(res, 400, problem)

  const user = createUser({
    email: String(req.body.email),
    password: String(req.body.password),
    name: String(req.body.name),
    company: req.body.company ? String(req.body.company) : '',
    use_case: req.body.use_case ? String(req.body.use_case) : '',
  })
  grantTrialPhone(user)
  issueSession(res, user.id)
  res.json(envelope({ user: publicUser(user) }))
})

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '')
  const password = String(req.body?.password ?? '')
  const user = findUserByEmail(email)
  /* One message for both failure modes so the endpoint can't enumerate accounts. */
  if (!user || !verifyPassword(password, user)) {
    return errorOut(res, 401, 'That email and password do not match an account.')
  }
  issueSession(res, user.id)
  res.json(envelope({ user: publicUser(user) }))
})

app.post('/api/auth/logout', (_req, res) => {
  clearSession(res)
  res.json(envelope({ ok: true }))
})

app.get('/api/auth/me', (req, res) => {
  if (!req.user || !req.actor) return res.json(envelope({ user: null }))
  res.json(envelope({
    /* The signed-in person, and the account they act inside — the same record
     * for an owner, different ones for a team member. */
    user: publicUser(req.actor),
    account: accountSummary(req.user.id),
    role: actorRole(req),
    account_owner: req.actor.parent_id
      ? { name: req.user.name, company: req.user.company }
      : null,
  }))
})

/* ------------------------------ invitations ----------------------------- */

/** What the join page needs to render before anyone types a password. */
app.get('/api/auth/invite', (req, res) => {
  const found = findInvite(String(req.query.token ?? ''))
  if (!found) return errorOut(res, 404, 'That invitation is not valid or has already been used.')
  res.json(envelope({
    invite: {
      name: found.member.name,
      email: found.member.email,
      role: found.member.role,
      company: found.owner.company || found.owner.name,
    },
  }))
})

app.post('/api/auth/join', (req, res) => {
  try {
    const { user } = acceptInvite(String(req.body?.token ?? ''), String(req.body?.password ?? ''))
    issueSession(res, user.id)
    res.json(envelope({ user: publicUser(user) }))
  } catch (err) {
    const status = err instanceof InputError ? err.status : 400
    errorOut(res, status, err instanceof Error ? err.message : 'Could not accept that invitation')
  }
})

/* --------------------------- password recovery -------------------------- */

/**
 * Always answers the same way, whether or not the address is on file: telling
 * an anonymous caller which emails exist is an account-enumeration hole.
 *
 * Where no mail transport is configured the link is written to the server log
 * instead of being sent, so a self-hosted install still has a way through.
 */
app.post('/api/auth/forgot', (req, res) => {
  const email = String(req.body?.email ?? '')
  const issued = issueResetToken(email)
  if (issued) {
    const base = process.env.MADOVA_PUBLIC_URL ?? ''
    const link = `${base}/reset?token=${encodeURIComponent(issued.token)}`
    console.log(`[reset] ${issued.user.email} → ${link}`)
  }
  res.json(envelope({
    ok: true,
    message: 'If that address has an account, a reset link is on its way.',
    /* Without mail configured the operator reads the link from the log. */
    delivery: process.env.MADOVA_SMTP_URL ? 'email' : 'server-log',
  }))
})

app.post('/api/auth/reset', (req, res) => {
  try {
    const { user } = consumeResetToken(String(req.body?.token ?? ''), String(req.body?.password ?? ''))
    issueSession(res, user.id)
    res.json(envelope({ user: publicUser(user) }))
  } catch (err) {
    const status = err instanceof InputError ? err.status : 400
    errorOut(res, status, err instanceof Error ? err.message : 'Could not reset that password')
  }
})

/* ------------------------------ public API ------------------------------ */

/**
 * The surface an API key buys. Same engine as the console — a key calls the
 * exact functions the UI calls — but authenticated by bearer token and gated
 * on the scopes the key was minted with.
 */
const SCOPE_FOR_PATH: Record<string, string> = {
  '/api/v1/cloudPhone/list': 'phones:read',
  '/api/v1/cloudPhone/groupList': 'phones:read',
  '/api/v1/proxy/list': 'phones:read',
  '/api/v1/app/list': 'phones:read',
  '/api/v1/cloudNumber/smsList': 'phones:read',
  '/api/v1/cloudPhone/batchPowerOn': 'phones:write',
  '/api/v1/cloudPhone/batchPowerOff': 'phones:write',
  '/api/v1/cloudPhone/batchRestart': 'phones:write',
  '/api/v1/cloudPhone/batchRoot': 'phones:write',
  '/api/v1/cloudPhone/update': 'phones:write',
  '/api/v1/cloudPhone/command': 'phones:write',
  '/api/v1/cloudPhone/renewal': 'orders:write',
  '/api/v1/app/batchInstall': 'apps:write',
  '/api/v1/cloudDrive/push': 'apps:write',
}

app.post(/^\/v1\/.+/, async (req, res) => {
  const header = req.get('authorization') ?? ''
  const key = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : (req.get('x-madova-key') ?? '').trim()
  if (!key) return errorOut(res, 401, 'Send your API key as `Authorization: Bearer mdv_live_…`')

  const holder = userForApiKey(key)
  if (!holder) return errorOut(res, 401, 'That API key is not valid or has been revoked.')

  const path = `/api${req.path}`
  const needed = SCOPE_FOR_PATH[path]
  if (!needed) return errorOut(res, 404, `Unknown endpoint: ${req.path}`)
  if (!holder.key.scopes.includes(needed)) {
    return errorOut(res, 403, `This key does not carry the "${needed}" scope.`)
  }

  const reply = await cloudCall(holder.user, path, req.body ?? {}, String(req.get('lang') ?? 'en'))
  res.status(reply.code === 200 ? 200 : reply.code).json(reply)
})

/* ---------------------------- device control ---------------------------- */

/**
 * The single door to the cloud phone API. The browser posts a path and a body;
 * the server decides whether that resolves against the local engine or the real
 * upstream, and the key never leaves this process.
 */
app.use('/api', resourceRoutes)

/* Read paths are open to the whole team; anything that moves a device is not. */
const READ_ONLY_PATHS = new Set([
  '/api/v1/cloudPhone/list',
  '/api/v1/cloudPhone/groupList',
  '/api/v1/proxy/list',
  '/api/v1/app/list',
  '/api/v1/cloudNumber/smsList',
])

app.post('/api/cloud', requireAuth, async (req, res) => {
  const callPath = String(req.body?.path ?? '')
  if (!READ_ONLY_PATHS.has(callPath) && actorRole(req) === 'viewer') {
    return errorOut(res, 403, 'Viewers can look at the fleet but not change it.')
  }
  const body = (req.body?.body ?? {}) as Record<string, unknown>
  const lang = typeof req.body?.lang === 'string' ? req.body.lang : 'en'
  try {
    const result = await cloudCall(req.user!, callPath, body, lang)
    res.status(result.code === 200 ? 200 : result.code === 404 ? 404 : 200).json(result)
  } catch (err) {
    errorOut(res, 502, err instanceof Error ? err.message : 'Upstream call failed')
  }
})

/* -------------------------------- billing ------------------------------- */

/* `quantity` is optional and 0 is meaningful (a minutes-only top-up), so a
   plain `|| 1` fallback would silently turn a top-up into a device purchase. */
function readQuantity(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 1
  const n = Number(raw)
  return Number.isFinite(n) ? n : 1
}

app.post('/api/quote', requireRole('owner'), (req, res) => {
  res.json(envelope(quote({
    quantity: readQuantity(req.body?.quantity),
    duration_days: Number(req.body?.duration_days) || 30,
    region: String(req.body?.region ?? 'us-west'),
    minutes: req.body?.minutes ? Number(req.body.minutes) : undefined,
    group_name: req.body?.group_name ? String(req.body.group_name) : undefined,
  })))
})

app.get('/api/orders', requireAuth, (req, res) => {
  res.json(envelope({ orders: ordersOf(req.user!.id) }))
})

app.post('/api/orders', requireRole('owner'), (req, res) => {
  const input = {
    quantity: readQuantity(req.body?.quantity),
    duration_days: Number(req.body?.duration_days) || 30,
    region: String(req.body?.region ?? 'us-west'),
    os: req.body?.os ? String(req.body.os) : undefined,
    minutes: req.body?.minutes ? Number(req.body.minutes) : undefined,
    group_name: req.body?.group_name ? String(req.body.group_name) : undefined,
  }
  /* Neither devices nor minutes means there is nothing to charge for. */
  if (Math.floor(input.quantity) < 1 && !input.minutes) {
    return errorOut(res, 400, 'Choose at least one device or a minute package.')
  }
  res.json(envelope({ order: createOrder(req.user!, input, 'user') }))
})

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = orderById(req.user!.id, req.params.id)
  if (!order) return errorOut(res, 404, 'Order not found')
  res.json(envelope({ order }))
})

/** Settle from account credit. On-chain orders settle through /payment instead. */
app.post('/api/orders/:id/pay', requireRole('owner'), (req, res) => {
  const result = payOrder(req.user!, req.params.id)
  if ('error' in result) return errorOut(res, 400, result.error)
  res.json(envelope({ order: result.order, provisioned: result.provisioned }))
})

/* ----------------------------- crypto checkout ---------------------------- */

/** Create the on-chain invoice: address, exact amount, QR and deadline. */
app.post('/api/orders/:id/payment', requireRole('owner'), async (req, res) => {
  const chain = String(req.body?.chain ?? '') as ChainId
  if (!enabledChains().includes(chain)) {
    return errorOut(res, 400, 'That payment network is not available on this server')
  }
  const order = orderById(req.user!.id, req.params.id)
  if (!order) return errorOut(res, 404, 'Order not found')
  if (order.status !== 'pending') return errorOut(res, 400, `This order is already ${order.status}`)

  try {
    const intent = await createIntent(order, chain)
    mutate((d) => {
      const stored = d.orders.find((o) => o.id === order.id)!
      stored.payment = intent
      stored.updated_at = nowIso()
    })
    res.json(envelope({ payment: intent }))
  } catch (err) {
    errorOut(res, 400, err instanceof Error ? err.message : 'Could not create the invoice')
  }
})

/**
 * Poll the chain for this invoice.
 *
 * Provisioning happens here, the moment a payment settles, so a customer who
 * closes the tab still gets what they paid for on their next visit.
 */
app.get('/api/orders/:id/payment', requireAuth, async (req, res) => {
  const order = orderById(req.user!.id, req.params.id)
  if (!order) return errorOut(res, 404, 'Order not found')
  if (!order.payment) return errorOut(res, 404, 'This order has no payment intent')

  if (order.status === 'paid') {
    return res.json(envelope({ payment: order.payment, order, provisioned: [] }))
  }

  const result = await checkIntent(order)
  applyCheck(order.id, result)

  let provisioned: string[] = []
  if (result.state === 'confirmed') {
    const settled = payOrder(req.user!, order.id)
    if (!('error' in settled)) provisioned = settled.provisioned
  }

  const fresh = orderById(req.user!.id, order.id)!
  res.json(envelope({ payment: fresh.payment, order: fresh, provisioned, check: result.state }))
})

app.post('/api/orders/:id/cancel', requireRole('owner'), (req, res) => {
  if (!cancelOrder(req.user!, req.params.id)) return errorOut(res, 400, 'That order cannot be cancelled')
  res.json(envelope({ ok: true }))
})

/* ------------------------------- knowledge ------------------------------ */

app.get('/api/knowledge', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  const articles = q ? searchArticles(q, 20) : ARTICLES
  res.json(envelope({ categories: CATEGORIES, articles }))
})

app.get('/api/knowledge/:id', (req, res) => {
  const article = articleById(req.params.id)
  if (!article) return errorOut(res, 404, 'Article not found')
  res.json(envelope({ article }))
})

/* -------------------------------- support ------------------------------- */

function threadFor(req: express.Request): SupportThread {
  const guestKey = typeof req.body?.guest_key === 'string' ? req.body.guest_key : null
  const existing = db().threads.find((t) =>
    req.user ? t.user_id === req.user.id && t.status !== 'resolved'
             : Boolean(guestKey) && t.guest_key === guestKey && t.status !== 'resolved')
  if (existing) {
    /* Adopt an anonymous thread once its visitor signs in. */
    if (req.user && !existing.user_id) {
      mutate(() => { existing.user_id = req.user!.id })
    }
    return existing
  }

  const thread: SupportThread = {
    id: prefixedId('thr'),
    user_id: req.user?.id ?? null,
    guest_key: req.user ? null : guestKey,
    subject: 'Support',
    status: 'open',
    messages: [],
    created_at: nowIso(),
    updated_at: nowIso(),
  }
  mutate((d) => d.threads.push(thread))
  return thread
}

app.post('/api/support/thread', (req, res) => {
  const thread = threadFor(req)
  res.json(envelope({ thread, assistant: { configured: assistantConfigured() } }))
})

app.post('/api/support/resolve', (req, res) => {
  const thread = threadFor(req)
  mutate(() => { thread.status = 'resolved'; thread.updated_at = nowIso() })
  res.json(envelope({ ok: true }))
})

/**
 * Streams the assistant's reply as server-sent events so tool activity appears
 * while it happens rather than only at the end.
 */
app.post('/api/assistant/message', async (req, res) => {
  const text = String(req.body?.message ?? '').trim()
  if (!text) return errorOut(res, 400, 'Message is required')
  if (text.length > 4000) return errorOut(res, 400, 'Message is too long (4000 characters max)')

  const thread = threadFor(req)
  mutate(() => {
    thread.messages.push({ id: prefixedId('msg'), role: 'user', text, at: nowIso() })
    thread.updated_at = nowIso()
  })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  send('start', { thread_id: thread.id, mode: assistantConfigured() ? 'model' : 'fallback' })

  try {
    const reply = await runAssistant({
      user: req.user ?? null,
      thread,
      events: {
        onText: (delta) => send('text', { delta }),
        onTool: (tool) => send('tool', tool),
        onOrder: (order) => send('order', { order }),
      },
    })

    const message = {
      id: prefixedId('msg'),
      role: 'assistant' as const,
      text: reply.text,
      at: nowIso(),
      actions: reply.actions,
      pending_order_id: reply.pendingOrder?.id,
    }
    mutate(() => {
      thread.messages.push(message)
      thread.updated_at = nowIso()
    })

    send('done', {
      message,
      mode: reply.mode,
      escalated: reply.escalated,
      pending_order: reply.pendingOrder ?? null,
      account: req.user ? accountSummary(req.user.id) : null,
    })
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : 'The assistant failed to reply' })
  } finally {
    res.end()
  }
})

/* -------------------------------- static -------------------------------- */

const distDir = process.env.MADOVA_STATIC_DIR ?? path.join(process.cwd(), 'dist')
app.use(express.static(distDir, { index: false }))

/* The SPA owns client-side routing; anything not an API path falls through. */
app.get(/^(?!\/(api|v1)\/).*/, (_req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => err && next())
})

seed()

/* Passenger (cPanel) supplies the listening socket and ignores the port. */
app.listen(PORT, () => {
  console.log(`MADOVA API on http://localhost:${PORT}`)
  console.log(`  static files : ${distDir}`)
  console.log(`  env file     : ${envFile.loaded ? `${envFile.path} (${envFile.count} applied)` : 'none — using the process environment'}`)
  console.log(`  cloud phones : ${upstreamConfigured() ? 'live upstream' : 'local engine'}`)
  const enabled = enabledChains()
  console.log(`  payments     : ${enabled.length ? enabled.join(', ') : 'none configured'}`)
  for (const warning of paymentWarnings()) console.warn(`  ⚠  ${warning}`)
  console.log(`  assistant    : ${assistantConfigured()
    ? `${PROVIDER_LABEL} · ${MODEL}`
    : 'fallback router (no model provider configured)'}`)
})
