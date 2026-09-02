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
  attachUser, clearSession, createUser, issueSession, requireAuth, validateRegistration,
  verifyPassword,
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
    demo_account: { email: DEMO_EMAIL, hint: 'Seeded account with a populated fleet' },
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
  if (!req.user) return res.json(envelope({ user: null }))
  res.json(envelope({ user: publicUser(req.user), account: accountSummary(req.user.id) }))
})

/* ---------------------------- device control ---------------------------- */

/**
 * The single door to the cloud phone API. The browser posts a path and a body;
 * the server decides whether that resolves against the local engine or the real
 * upstream, and the key never leaves this process.
 */
app.post('/api/cloud', requireAuth, async (req, res) => {
  const callPath = String(req.body?.path ?? '')
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

app.post('/api/quote', requireAuth, (req, res) => {
  res.json(envelope(quote({
    quantity: Number(req.body?.quantity) || 1,
    duration_days: Number(req.body?.duration_days) || 30,
    region: String(req.body?.region ?? 'us-west'),
    minutes: req.body?.minutes ? Number(req.body.minutes) : undefined,
    group_name: req.body?.group_name ? String(req.body.group_name) : undefined,
  })))
})

app.get('/api/orders', requireAuth, (req, res) => {
  res.json(envelope({ orders: ordersOf(req.user!.id) }))
})

app.post('/api/orders', requireAuth, (req, res) => {
  const order = createOrder(req.user!, {
    quantity: Number(req.body?.quantity) || 1,
    duration_days: Number(req.body?.duration_days) || 30,
    region: String(req.body?.region ?? 'us-west'),
    os: req.body?.os ? String(req.body.os) : undefined,
    minutes: req.body?.minutes ? Number(req.body.minutes) : undefined,
    group_name: req.body?.group_name ? String(req.body.group_name) : undefined,
  }, 'user')
  res.json(envelope({ order }))
})

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = orderById(req.user!.id, req.params.id)
  if (!order) return errorOut(res, 404, 'Order not found')
  res.json(envelope({ order }))
})

/** Settle from account credit. On-chain orders settle through /payment instead. */
app.post('/api/orders/:id/pay', requireAuth, (req, res) => {
  const result = payOrder(req.user!, req.params.id)
  if ('error' in result) return errorOut(res, 400, result.error)
  res.json(envelope({ order: result.order, provisioned: result.provisioned }))
})

/* ----------------------------- crypto checkout ---------------------------- */

/** Create the on-chain invoice: address, exact amount, QR and deadline. */
app.post('/api/orders/:id/payment', requireAuth, async (req, res) => {
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

app.post('/api/orders/:id/cancel', requireAuth, (req, res) => {
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
app.get(/^(?!\/api\/).*/, (_req, res, next) => {
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
