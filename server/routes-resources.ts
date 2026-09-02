/**
 * Routes for the reseller-layer resources. Kept apart from index.ts so the
 * entry point stays readable: everything here is CRUD over resources.ts,
 * scoped to the signed-in account by requireAuth.
 */
import express from 'express'
import { requireAuth, requireRole } from './auth.js'
import {
  appsOf, assignGroup, bindProxy, checkProxy, cloudCall, createGroup, createProxy,
  deleteGroup, deleteProxy, groupsOf, importProxies, installApp, proxiesOf,
  uninstallApp, updateGroup,
} from './fleet.js'
import {
  API_SCOPES, InputError, MAX_FILE_BYTES, SUB_PLANS, TASK_ACTIONS, TASK_TRIGGERS,
  TEAM_ROLES, bindNumber, changePassword, closeAccount, createApiKey, createSubAccount,
  createTask, deleteFile, deleteSubAccount, deleteTask, driveUsage, filesOf, inviteMember,
  keysOf, markPushed, numbersOf, overview, publicNumber, publicTask, readFile, recordRun, releaseNumber,
  removeMember, rentNumber, revokeApiKey, rotateApiKey, saveFile, setTaskStatus, smsOf,
  subAccountsCsv, subAccountsOf, taskById, tasksOf, teamOf, updateMember, updateProfile,
  updateSubAccount,
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
  handle(res, () => ({ proxies: proxiesOf(req.user!.id).map(strip) })))

resourceRoutes.post('/proxies', admin, (req, res) =>
  handle(res, () => ({
    proxy: strip(createProxy(req.user!.id, {
      name: req.body?.name, host: req.body?.host, port: req.body?.port,
      user: req.body?.user, password: req.body?.password,
      protocol: req.body?.protocol, area: req.body?.area,
      group_ids: ids(req.body?.group_ids),
    })),
  })))

resourceRoutes.post('/proxies/import', admin, (req, res) =>
  handle(res, () => {
    const result = importProxies(req.user!.id, String(req.body?.text ?? ''), ids(req.body?.group_ids))
    return { added: result.added.map(strip), skipped: result.skipped }
  }))

resourceRoutes.post('/proxies/:id/check', operator, (req, res) =>
  handleAsync(res, async () => ({ proxy: strip(await checkProxy(req.user!.id, req.params.id)) })))

resourceRoutes.delete('/proxies/:id', admin, (req, res) =>
  handle(res, () => deleteProxy(req.user!.id, req.params.id)))

resourceRoutes.post('/proxies/:id/bind', operator, (req, res) =>
  handle(res, () => ({ result: bindProxy(req.user!.id, ids(req.body?.phone_ids), req.params.id) })))

resourceRoutes.post('/proxies/unbind', operator, (req, res) =>
  handle(res, () => ({ result: bindProxy(req.user!.id, ids(req.body?.phone_ids), '') })))

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

/* ------------------------------- API keys -------------------------------- */

resourceRoutes.get('/keys', owner, (req, res) =>
  handle(res, () => ({ keys: keysOf(req.user!.id), scopes: API_SCOPES })))

resourceRoutes.post('/keys', owner, (req, res) =>
  handle(res, () => createApiKey(req.user!, {
    name: String(req.body?.name ?? ''),
    scopes: ids(req.body?.scopes),
  })))

resourceRoutes.post('/keys/:id/rotate', owner, (req, res) =>
  handle(res, () => rotateApiKey(req.user!, req.params.id)))

resourceRoutes.delete('/keys/:id', owner, (req, res) =>
  handle(res, () => ({ key: revokeApiKey(req.user!, req.params.id) })))

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

    const path = task.action === 'power_on' ? '/api/v1/cloudPhone/batchPowerOn'
      : task.action === 'power_off' ? '/api/v1/cloudPhone/batchPowerOff'
      : task.action === 'restart' ? '/api/v1/cloudPhone/batchRestart'
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

/* ------------------------------ sub-accounts ----------------------------- */

resourceRoutes.get('/sub-accounts', requireAuth, (req, res) =>
  handle(res, () => ({ sub_accounts: subAccountsOf(req.user!.id), plans: SUB_PLANS })))

resourceRoutes.post('/sub-accounts', owner, (req, res) =>
  handle(res, () => ({
    sub_account: createSubAccount(req.user!, {
      company: String(req.body?.company ?? ''),
      contact: String(req.body?.contact ?? ''),
      email: String(req.body?.email ?? ''),
      plan: req.body?.plan ? String(req.body.plan) : undefined,
      minutes_quota: req.body?.minutes_quota === undefined ? undefined : Number(req.body.minutes_quota),
      mrr: req.body?.mrr === undefined ? undefined : Number(req.body.mrr),
      margin: req.body?.margin === undefined ? undefined : Number(req.body.margin),
    }),
  })))

resourceRoutes.patch('/sub-accounts/:id', owner, (req, res) =>
  handle(res, () => ({ sub_account: updateSubAccount(req.user!.id, req.params.id, req.body ?? {}) })))

resourceRoutes.delete('/sub-accounts/:id', owner, (req, res) =>
  handle(res, () => deleteSubAccount(req.user!.id, req.params.id)))

resourceRoutes.get('/sub-accounts.csv', owner, (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="madova-sub-accounts.csv"')
  res.send(subAccountsCsv(req.user!.id))
})

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
