/**
 * Routes for the reseller-layer resources. Kept apart from index.ts so the
 * entry point stays readable: everything here is CRUD over resources.ts,
 * scoped to the signed-in account by requireAuth.
 */
import express from 'express'
import { requireAuth, requireRole } from './auth.js'
import {
  appsOf, assignGroup, bindProxy, checkProxy, cloudCall, createGroup, createProxy,
  deleteGroup, deleteProxy, groupsOf, importProxies, initProxyDirect, installApp,
  listProxies, screenLink, stopSharing, uninstallApp, updateGroup, upstreamConfigured,
} from './fleet.js'
import {
  InputError, MAX_FILE_BYTES, TASK_ACTIONS, TASK_TRIGGERS, TEAM_ROLES,
  bindNumber, changePassword, closeAccount, createTask, deleteFile, deleteTask,
  driveUsage, filesOf, inviteMember, markPushed, numbersOf, overview, publicNumber,
  publicTask, readFile, recordRun, releaseNumber, removeMember, rentNumber, saveFile,
  setTaskStatus, smsOf, taskById, tasksOf, teamOf, updateMember, updateProfile,
} from './resources.js'
import { publicUser } from './store.js'

export const resourceRoutes = express.Router()

/**
 * Role gates. Reads are open to everyone on the account; anything that changes
 * a device needs Operator, anything structural needs Admin, and anything that
 * spends money or hands out access stays with the Owner.
 */
const operator = requireRole('operator')
const admin = requireRole('admin')
const owner = requireRole('owner')

const envelope = (data: unknown) => ({ code: 200, data, message: 'Success' })

/**
 * One error shape for every route here. An InputError carries a message the
 * customer can act on; anything else is a bug and is not echoed back.
 */
function handle(res: express.Response, fn: () => unknown) {
  try {
    return res.json(envelope(fn()))
  } catch (err) {
    if (err instanceof InputError) return res.status(err.status).json({ code: err.status, data: null, message: err.message })
    if (err instanceof Error) return res.status(400).json({ code: 400, data: null, message: err.message })
    return res.status(500).json({ code: 500, data: null, message: 'Something went wrong' })
  }
}

async function handleAsync(res: express.Response, fn: () => Promise<unknown>) {
  try {
    return res.json(envelope(await fn()))
  } catch (err) {
    if (err instanceof InputError) return res.status(err.status).json({ code: err.status, data: null, message: err.message })
    if (err instanceof Error) return res.status(400).json({ code: 400, data: null, message: err.message })
    return res.status(500).json({ code: 500, data: null, message: 'Something went wrong' })
  }
}

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : []

/** `owner_id` is bookkeeping for the store, not part of the API contract. */
const strip = <T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> => {
  const { owner_id: _o, ...rest } = row
  return rest
}

/* -------------------------------- groups --------------------------------- */

resourceRoutes.get('/groups', requireAuth, (req, res) =>
  handle(res, () => ({ groups: groupsOf(req.user!.id).map(strip) })))

resourceRoutes.post('/groups', admin, (req, res) =>
  handle(res, () => ({
    group: strip(createGroup(req.user!.id, {
      name: String(req.body?.name ?? ''),
      sort: req.body?.sort === undefined ? undefined : Number(req.body.sort),
      remark: req.body?.remark === undefined ? undefined : String(req.body.remark),
    })),
  })))

resourceRoutes.patch('/groups/:id', admin, (req, res) =>
  handle(res, () => ({
    group: strip(updateGroup(req.user!.id, req.params.id, {
      name: req.body?.name === undefined ? undefined : String(req.body.name),
      sort: req.body?.sort === undefined ? undefined : Number(req.body.sort),
      remark: req.body?.remark === undefined ? undefined : String(req.body.remark),
    })),
  })))

resourceRoutes.delete('/groups/:id', admin, (req, res) =>
  handle(res, () => deleteGroup(req.user!.id, req.params.id)))

resourceRoutes.post('/groups/:id/assign', operator, (req, res) =>
  handle(res, () => ({ result: assignGroup(req.user!.id, ids(req.body?.phone_ids), req.params.id) })))

/* -------------------------------- proxies -------------------------------- */

resourceRoutes.get('/proxies', requireAuth, (req, res) =>
  handleAsync(res, async () => {
    const { proxies, managed } = await listProxies(req.user!)
    /* `managed` tells the console the list is the provider's, so it can offer
       binding rather than an add form the provider has no endpoint for. */
    return { proxies, managed }
  }))

/* The provider has no create endpoint, so these are refused rather than
   silently writing a record it will never accept. */
const localProxiesOnly = () => {
  if (upstreamConfigured()) {
    throw new InputError(
      'Proxies come from your cloud phone provider and are added in its dashboard. '
      + 'They appear here automatically, ready to bind to a device.',
    )
  }
}

resourceRoutes.post('/proxies', admin, (req, res) =>
  handle(res, () => {
    localProxiesOnly()
    return ({
    proxy: strip(createProxy(req.user!.id, {
      name: req.body?.name, host: req.body?.host, port: req.body?.port,
      user: req.body?.user, password: req.body?.password,
      protocol: req.body?.protocol, area: req.body?.area,
      group_ids: ids(req.body?.group_ids),
    })),
  })
  }))

resourceRoutes.post('/proxies/import', admin, (req, res) =>
  handle(res, () => {
    localProxiesOnly()
    const result = importProxies(req.user!.id, String(req.body?.text ?? ''), ids(req.body?.group_ids))
    return { added: result.added.map(strip), skipped: result.skipped }
  }))

resourceRoutes.post('/proxies/:id/check', operator, (req, res) =>
  handleAsync(res, async () => ({ proxy: strip(await checkProxy(req.user!.id, req.params.id)) })))

resourceRoutes.delete('/proxies/:id', admin, (req, res) =>
  handle(res, () => {
    localProxiesOnly()
    return deleteProxy(req.user!.id, req.params.id)
  }))

resourceRoutes.post('/proxies/:id/bind', operator, (req, res) =>
  handleAsync(res, async () => ({
    result: await bindProxy(
      req.user!, ids(req.body?.phone_ids), req.params.id, req.body?.dns !== false,
    ),
  })))

/** Configure a device with an endpoint the customer supplies themselves. */
resourceRoutes.post('/proxies/direct', operator, (req, res) =>
  handleAsync(res, async () => ({
    result: await initProxyDirect(req.user!, ids(req.body?.phone_ids), {
      host: String(req.body?.host ?? ''),
      port: String(req.body?.port ?? ''),
      user: req.body?.user ? String(req.body.user) : undefined,
      password: req.body?.password ? String(req.body.password) : undefined,
      protocol: req.body?.protocol ? String(req.body.protocol) : undefined,
      dns: req.body?.dns !== false,
    }),
  })))

resourceRoutes.post('/proxies/unbind', operator, (req, res) =>
  handleAsync(res, async () => ({
    result: await bindProxy(req.user!, ids(req.body?.phone_ids), ''),
  })))

/* -------------------------------- screen --------------------------------- */

/** The link that shows a device's live screen, and the password it needs. */
resourceRoutes.post('/phones/:id/screen', operator, (req, res) =>
  handleAsync(res, async () => await screenLink(req.user!, req.params.id, {
    width: req.body?.width === undefined ? undefined : Number(req.body.width),
    height: req.body?.height === undefined ? undefined : Number(req.body.height),
    clarity: req.body?.clarity ? String(req.body.clarity) : undefined,
    fps: req.body?.fps === undefined ? undefined : Number(req.body.fps),
    bitrate: req.body?.bitrate === undefined ? undefined : Number(req.body.bitrate),
  })))

resourceRoutes.delete('/phones/:id/screen', operator, (req, res) =>
  handleAsync(res, async () => {
    await stopSharing(req.user!, req.params.id)
    return { stopped: true }
  }))

/* --------------------------------- apps ---------------------------------- */

resourceRoutes.get('/apps', requireAuth, (req, res) =>
  handle(res, () => ({ apps: appsOf(req.user!.id) })))

resourceRoutes.post('/apps/install', operator, (req, res) =>
  handle(res, () => ({
    result: installApp(req.user!.id, ids(req.body?.phone_ids), {
      package_name: String(req.body?.package_name ?? ''),
      name: String(req.body?.name ?? req.body?.package_name ?? ''),
      version: String(req.body?.version ?? '1.0.0'),
      size: String(req.body?.size ?? '—'),
      installed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }),
  })))

resourceRoutes.post('/apps/uninstall', operator, (req, res) =>
  handle(res, () => {
    const pkg = String(req.body?.package_name ?? '')
    if (!pkg) throw new InputError('Which package should be removed?')
    return { result: uninstallApp(req.user!.id, pkg, ids(req.body?.phone_ids)) }
  }))

/* ------------------------------ cloud drive ------------------------------ */

/**
 * Uploads arrive as raw bytes with the filename in a header rather than as
 * multipart: it keeps the server dependency-free and streams just as well.
 */
resourceRoutes.post(
  '/files',
  operator,
  express.raw({ type: '*/*', limit: MAX_FILE_BYTES }),
  (req, res) => handle(res, () => {
    const name = decodeURIComponent(String(req.get('x-madova-filename') ?? ''))
    if (!name) throw new InputError('The upload is missing its filename.')
    const body = req.body
    if (!Buffer.isBuffer(body)) throw new InputError('The upload had no body.')
    return { file: saveFile(req.user!, { name, mime: req.get('content-type') ?? '', data: body }) }
  }),
)

resourceRoutes.get('/files', requireAuth, (req, res) =>
  handle(res, () => ({ files: filesOf(req.user!.id), usage: driveUsage(req.user!.id) })))

resourceRoutes.get('/files/:id/download', requireAuth, (req, res) => {
  try {
    const { file, body } = readFile(req.user!.id, req.params.id)
    res.setHeader('Content-Type', file.mime)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    res.send(body)
  } catch (err) {
    const status = err instanceof InputError ? err.status : 500
    res.status(status).json({ code: status, data: null, message: err instanceof Error ? err.message : 'Failed' })
  }
})

resourceRoutes.delete('/files/:id', operator, (req, res) =>
  handle(res, () => deleteFile(req.user!.id, req.params.id)))

/** Push a file to devices through the fleet, then record where it landed. */
resourceRoutes.post('/files/:id/push', operator, async (req, res) => {
  await handleAsync(res, async () => {
    const phoneIds = ids(req.body?.phone_ids)
    if (phoneIds.length === 0) throw new InputError('Choose at least one device.')
    const { file } = readFile(req.user!.id, req.params.id)
    const reply = await cloudCall(req.user!, '/api/v1/cloudDrive/push', {
      image_ids: phoneIds,
      file_id: file.id,
      file_name: file.name,
    })
    if (reply.code !== 200) throw new InputError(reply.message, reply.code)
    const pushed = (reply.data as { success?: string[] })?.success?.length ?? 0
    return { file: markPushed(req.user!.id, file.id, pushed), pushed }
  })
})

/* ----------------------------- cloud numbers ----------------------------- */

resourceRoutes.get('/numbers', requireAuth, (req, res) =>
  handle(res, () => ({ numbers: numbersOf(req.user!.id), sms: smsOf(req.user!.id) })))

resourceRoutes.post('/numbers', owner, (req, res) =>
  handle(res, () => {
    const { number, charged_cents } = rentNumber(req.user!, {
      country: String(req.body?.country ?? ''),
      months: req.body?.months === undefined ? 1 : Number(req.body.months),
    })
    return { number: publicNumber(number), charged_cents }
  }))

resourceRoutes.post('/numbers/:id/bind', operator, (req, res) =>
  handle(res, () => ({
    number: publicNumber(bindNumber(req.user!.id, req.params.id, req.body?.phone_id ? String(req.body.phone_id) : null)),
  })))

resourceRoutes.delete('/numbers/:id', owner, (req, res) =>
  handle(res, () => releaseNumber(req.user!.id, req.params.id)))

/* ------------------------------- automation ------------------------------ */

resourceRoutes.get('/tasks', requireAuth, (req, res) =>
  handle(res, () => ({ tasks: tasksOf(req.user!.id), actions: TASK_ACTIONS, triggers: TASK_TRIGGERS })))

resourceRoutes.post('/tasks', admin, (req, res) =>
  handle(res, () => ({
    task: publicTask(createTask(req.user!, {
      name: String(req.body?.name ?? ''),
      action: String(req.body?.action ?? ''),
      trigger: String(req.body?.trigger ?? 'manual'),
      group_id: req.body?.group_id ? String(req.body.group_id) : undefined,
      command: req.body?.command ? String(req.body.command) : undefined,
    })),
  })))

resourceRoutes.patch('/tasks/:id', operator, (req, res) =>
  handle(res, () => {
    const status = String(req.body?.status ?? '')
    if (!['running', 'scheduled', 'paused', 'failed'].includes(status)) {
      throw new InputError('Unknown task status.')
    }
    return { task: setTaskStatus(req.user!.id, req.params.id, status as 'paused') }
  }))

resourceRoutes.delete('/tasks/:id', admin, (req, res) =>
  handle(res, () => deleteTask(req.user!.id, req.params.id)))

/** Run a task now: dispatch its action through the fleet and record the result. */
resourceRoutes.post('/tasks/:id/run', operator, async (req, res) => {
  await handleAsync(res, async () => {
    const task = taskById(req.user!.id, req.params.id)
    if (!task) throw new InputError('Task not found.', 404)

    const path = task.action === 'power_on' ? '/api/v1/cloudPhone/powerOn'
      : task.action === 'power_off' ? '/api/v1/cloudPhone/powerOff'
      : task.action === 'restart' ? '/api/v1/cloudPhone/restart'
      : '/api/v1/cloudPhone/command'

    /* Batch endpoints cap at 20 devices per call, so a large group runs in waves. */
    let ok = 0
    let failed = 0
    for (let i = 0; i < task.phone_ids.length; i += 20) {
      const batch = task.phone_ids.slice(i, i + 20)
      const body = task.action === 'command'
        ? { image_ids: batch, command: task.command ?? '' }
        : { image_ids: batch }
      const reply = await cloudCall(req.user!, path, body)
      if (reply.code !== 200) { failed += batch.length; continue }
      if (task.action === 'command') {
        for (const result of Object.values(reply.data as Record<string, { success: boolean }>)) {
          if (result?.success) ok++
          else failed++
        }
      } else {
        const r = reply.data as { success?: string[]; fail?: string[] }
        ok += r.success?.length ?? 0
        failed += r.fail?.length ?? 0
      }
    }
    return { task: recordRun(req.user!.id, task.id, ok, failed), ok, failed }
  })
})

/* --------------------------------- team ---------------------------------- */

resourceRoutes.get('/team', requireAuth, (req, res) =>
  handle(res, () => ({ team: teamOf(req.user!), roles: TEAM_ROLES })))

resourceRoutes.post('/team', owner, (req, res) =>
  handle(res, () => inviteMember(req.user!, {
    name: String(req.body?.name ?? ''),
    email: String(req.body?.email ?? ''),
    role: String(req.body?.role ?? 'Viewer'),
  })))

resourceRoutes.patch('/team/:id', owner, (req, res) =>
  handle(res, () => ({
    member: updateMember(req.user!, req.params.id, {
      name: req.body?.name === undefined ? undefined : String(req.body.name),
      role: req.body?.role === undefined ? undefined : String(req.body.role),
      status: req.body?.status === undefined ? undefined : String(req.body.status),
    }),
  })))

resourceRoutes.delete('/team/:id', owner, (req, res) =>
  handle(res, () => removeMember(req.user!, req.params.id)))

/* -------------------------------- account -------------------------------- */

resourceRoutes.patch('/profile', requireAuth, (req, res) =>
  handle(res, () => ({
    user: publicUser(updateProfile(req.actor!, {
      name: req.body?.name === undefined ? undefined : String(req.body.name),
      company: req.body?.company === undefined ? undefined : String(req.body.company),
      use_case: req.body?.use_case === undefined ? undefined : String(req.body.use_case),
      prefs: req.body?.prefs && typeof req.body.prefs === 'object' ? req.body.prefs : undefined,
    })),
  })))

resourceRoutes.post('/password', requireAuth, (req, res) =>
  handle(res, () => changePassword(req.actor!, {
    current: String(req.body?.current ?? ''),
    next: String(req.body?.next ?? ''),
  })))

resourceRoutes.post('/close-account', owner, (req, res) =>
  handle(res, () => {
    if (String(req.body?.confirm ?? '') !== req.actor!.email) {
      throw new InputError('Type your email address exactly to confirm.')
    }
    return closeAccount(req.user!)
  }))

resourceRoutes.get('/overview', requireAuth, (req, res) =>
  handle(res, () => overview(req.user!)))
