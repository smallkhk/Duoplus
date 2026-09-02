/**
 * Reseller-layer resources: everything MADOVA owns itself rather than
 * forwarding to the cloud phone API — API keys, the cloud drive, rented
 * numbers, automation, team members and sub-accounts.
 *
 * Device control lives in fleet.ts. These records only ever reference devices;
 * they never mutate them except through the fleet's own functions.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { hashPassword, verifyHash, verifyPassword } from './auth.js'
import {
  appsOf, groupById, groupsOf, phonesOf, REGION_INDEX, REGIONS, usageSeries,
} from './fleet.js'
import {
  db, fileDir, findUserByEmail, mutate, nowIso, prefixedId,
  type ApiKey, type Owned, type StoredFile, type StoredMember, type StoredNumber,
  type StoredTask, type User, type UserPrefs,
} from './store.js'
import type {
  AutomationTask, CloudDriveFile, CloudNumber, SmsMessage, SubAccount, TeamMember,
} from '../src/lib/duoplus/types.js'

/** Thrown for anything the caller can fix by changing their input. */
export class InputError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)

/* ------------------------------- API keys -------------------------------- */

export const API_SCOPES = [
  { id: 'phones:read', label: 'Read devices, groups and proxies' },
  { id: 'phones:write', label: 'Power, restart, rename and configure devices' },
  { id: 'apps:write', label: 'Install and remove applications' },
  { id: 'orders:read', label: 'Read orders and billing history' },
  { id: 'orders:write', label: 'Create orders and renewals' },
]
const SCOPE_IDS = new Set(API_SCOPES.map((s) => s.id))

/** What the console may see: never the secret, only enough to identify a key. */
export function publicKey(k: ApiKey) {
  const { secret_hash: _h, secret_salt: _s, owner_id: _o, ...rest } = k
  return { ...rest, status: k.revoked_at ? ('revoked' as const) : ('active' as const) }
}

export function keysOf(userId: string) {
  return db().api_keys.filter((k) => k.owner_id === userId).map(publicKey)
}

/** Mint a key. The secret is returned once here and never recoverable after. */
export function createApiKey(user: User, input: { name: string; scopes?: string[] }) {
  const name = clean(input.name, 60)
  if (name.length < 2) throw new InputError('Give the key a name of at least two characters.')

  const live = db().api_keys.filter((k) => k.owner_id === user.id && !k.revoked_at)
  if (live.length >= 25) throw new InputError('An account can hold 25 active keys. Revoke one first.')

  const scopes = (input.scopes ?? ['phones:read']).filter((s) => SCOPE_IDS.has(s))
  if (scopes.length === 0) throw new InputError('Choose at least one scope.')

  const secret = `mdv_live_${crypto.randomBytes(24).toString('base64url')}`
  const { password_hash, password_salt } = hashPassword(secret)
  const key: ApiKey = {
    id: prefixedId('key'),
    owner_id: user.id,
    name,
    prefix: secret.slice(0, 16),
    secret_hash: password_hash,
    secret_salt: password_salt,
    scopes,
    created_at: nowIso(),
  }
  mutate((d) => d.api_keys.push(key))
  return { key: publicKey(key), secret }
}

/** Revoke a key and issue a replacement carrying the same name and scopes. */
export function rotateApiKey(user: User, id: string) {
  const existing = db().api_keys.find((k) => k.id === id && k.owner_id === user.id)
  if (!existing) throw new InputError('Key not found.', 404)
  if (existing.revoked_at) throw new InputError('That key is already revoked.')
  mutate((d) => {
    const k = d.api_keys.find((x) => x.id === id)!
    k.revoked_at = nowIso()
  })
  return createApiKey(user, { name: existing.name, scopes: existing.scopes })
}

export function revokeApiKey(user: User, id: string) {
  return mutate((d) => {
    const key = d.api_keys.find((k) => k.id === id && k.owner_id === user.id)
    if (!key) throw new InputError('Key not found.', 404)
    key.revoked_at = key.revoked_at ?? nowIso()
    return publicKey(key)
  })
}

/**
 * Resolve a bearer secret to its account. Compared against the stored hash, so
 * a leaked database still does not yield working keys.
 */
export function userForApiKey(secret: string): { user: User; key: ApiKey } | null {
  const prefix = secret.slice(0, 16)
  for (const key of db().api_keys) {
    if (key.revoked_at || key.prefix !== prefix) continue
    if (!verifyHash(secret, key.secret_hash, key.secret_salt)) continue
    const user = db().users.find((u) => u.id === key.owner_id)
    if (!user) return null
    mutate((d) => {
      const row = d.api_keys.find((k) => k.id === key.id)
      if (row) row.last_used_at = nowIso()
    })
    return { user, key }
  }
  return null
}

/* ------------------------------ cloud drive ------------------------------ */

const KIND_BY_EXT: Record<string, CloudDriveFile['kind']> = {
  apk: 'apk', xapk: 'apk',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  mp4: 'video', mov: 'video', webm: 'video', mkv: 'video',
  zip: 'archive', tar: 'archive', gz: 'archive', '7z': 'archive',
}

export const MAX_FILE_BYTES = 512 * 1024 * 1024

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  const units = ['K', 'M', 'G']
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)}${units[i]}`
}

export function publicFile(f: StoredFile): CloudDriveFile {
  const { owner_id: _o, blob: _b, mime: _m, bytes: _by, ...rest } = f
  return rest
}

export function filesOf(userId: string): CloudDriveFile[] {
  return db().files
    .filter((f) => f.owner_id === userId)
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
    .map(publicFile)
}

export function driveUsage(userId: string): { bytes: number; count: number } {
  const mine = db().files.filter((f) => f.owner_id === userId)
  return { bytes: mine.reduce((s, f) => s + f.bytes, 0), count: mine.length }
}

/** Store an uploaded file's bytes beside the database and record the metadata. */
export function saveFile(user: User, input: {
  name: string
  mime: string
  data: Buffer
}): CloudDriveFile {
  const name = clean(input.name, 160).replace(/[/\\]/g, '_')
  if (!name) throw new InputError('The file needs a name.')
  if (input.data.length === 0) throw new InputError('That file is empty.')
  if (input.data.length > MAX_FILE_BYTES) {
    throw new InputError(`Files are limited to ${humanSize(MAX_FILE_BYTES)}.`)
  }

  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const blob = `${prefixedId('blob')}${ext ? `.${ext}` : ''}`
  fs.writeFileSync(path.join(fileDir(), blob), input.data)

  const file: StoredFile = {
    id: prefixedId('file'),
    owner_id: user.id,
    name,
    kind: KIND_BY_EXT[ext] ?? 'other',
    size: humanSize(input.data.length),
    uploaded_at: nowIso(),
    pushed_to: 0,
    blob,
    mime: clean(input.mime, 120) || 'application/octet-stream',
    bytes: input.data.length,
  }
  mutate((d) => d.files.push(file))
  return publicFile(file)
}

export function readFile(userId: string, id: string): { file: StoredFile; body: Buffer } {
  const file = db().files.find((f) => f.id === id && f.owner_id === userId)
  if (!file) throw new InputError('File not found.', 404)
  try {
    return { file, body: fs.readFileSync(path.join(fileDir(), file.blob)) }
  } catch {
    throw new InputError('That file is no longer on disk.', 410)
  }
}

export function deleteFile(userId: string, id: string) {
  const file = db().files.find((f) => f.id === id && f.owner_id === userId)
  if (!file) throw new InputError('File not found.', 404)
  /* Remove the record first: a stale record is worse than an orphaned blob. */
  mutate((d) => { d.files = d.files.filter((f) => f.id !== id) })
  try { fs.unlinkSync(path.join(fileDir(), file.blob)) } catch { /* already gone */ }
  return { id }
}

/** Record that a file was pushed to a set of devices. */
export function markPushed(userId: string, id: string, count: number) {
  return mutate((d) => {
    const file = d.files.find((f) => f.id === id && f.owner_id === userId)
    if (!file) throw new InputError('File not found.', 404)
    file.pushed_to += count
    return publicFile(file)
  })
}

/* ----------------------------- cloud numbers ----------------------------- */

const NUMBER_MONTHLY_CENTS = 250

export function numbersOf(userId: string): (CloudNumber & { bound_index: number | null })[] {
  const phones = phonesOf(userId)
  return db().numbers
    .filter((n) => n.owner_id === userId)
    .map(({ owner_id: _o, messages: _m, ...n }) => ({
      ...n,
      bound_index: n.bound_image_id
        ? phones.findIndex((p) => p.id === n.bound_image_id) + 1 || null
        : null,
    }))
}

/** A number as the console sees it — no owner bookkeeping, no message log. */
export function publicNumber(n: StoredNumber): CloudNumber {
  const { owner_id: _o, messages: _m, ...rest } = n
  return rest
}

export function smsOf(userId: string, numberId?: string): SmsMessage[] {
  return db().numbers
    .filter((n) => n.owner_id === userId && (!numberId || n.id === numberId))
    .flatMap((n) => n.messages)
    .sort((a, b) => b.received_at.localeCompare(a.received_at))
}

/**
 * Rent a number. Charged against the account's credit up front, so a rental
 * cannot be created without being paid for.
 */
export function rentNumber(user: User, input: { country: string; months?: number }) {
  const cc = clean(input.country, 2).toUpperCase()
  const region = REGIONS.find((r) => r.cc === cc)
  if (!region) throw new InputError(`MADOVA does not carry numbers in "${input.country}".`)

  const months = Math.max(1, Math.min(12, Math.floor(Number(input.months ?? 1))))
  const cost = NUMBER_MONTHLY_CENTS * months
  if (user.credit_cents < cost) {
    throw new InputError(
      `Renting a ${region.area} number for ${months} month${months === 1 ? '' : 's'} costs `
      + `$${(cost / 100).toFixed(2)}. Your credit is $${(user.credit_cents / 100).toFixed(2)} — top up first.`,
    )
  }

  const number: StoredNumber = {
    id: prefixedId('num'),
    owner_id: user.id,
    msisdn: mintMsisdn(cc),
    country: region.area,
    operator: region.operator,
    bound_image_id: null,
    expired_at: addDays(months * 30),
    status: 1,
    messages: [],
  }
  mutate((d) => {
    d.numbers.push(number)
    const u = d.users.find((x) => x.id === user.id)!
    u.credit_cents -= cost
  })
  return { number, charged_cents: cost }
}

function addDays(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace('T', ' ')
}

/** Country dialling prefixes for the regions MADOVA sells into. */
const DIAL_CODE: Record<string, string> = {
  US: '1', DE: '49', GB: '44', SG: '65', JP: '81',
  BR: '55', IN: '91', AE: '971', ID: '62', NG: '234',
}

function mintMsisdn(cc: string): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  return `+${DIAL_CODE[cc] ?? '1'}${digits}`
}

export function bindNumber(userId: string, numberId: string, phoneId: string | null) {
  if (phoneId && !phonesOf(userId).some((p) => p.id === phoneId)) {
    throw new InputError('Cloud phone not found on this account.', 404)
  }
  return mutate((d) => {
    const number = d.numbers.find((n) => n.id === numberId && n.owner_id === userId)
    if (!number) throw new InputError('Number not found.', 404)
    if (phoneId) {
      const taken = d.numbers.find((n) => n.id !== numberId && n.bound_image_id === phoneId)
      if (taken) throw new InputError(`${taken.msisdn} is already bound to that device.`)
    }
    number.bound_image_id = phoneId
    return number
  })
}

export function releaseNumber(userId: string, numberId: string) {
  return mutate((d) => {
    const at = d.numbers.findIndex((n) => n.id === numberId && n.owner_id === userId)
    if (at < 0) throw new InputError('Number not found.', 404)
    d.numbers.splice(at, 1)
    return { id: numberId }
  })
}

/* ------------------------------ automation ------------------------------- */

export const TASK_ACTIONS = [
  { id: 'power_on', label: 'Power on' },
  { id: 'power_off', label: 'Power off' },
  { id: 'restart', label: 'Restart' },
  { id: 'command', label: 'Run an ADB command' },
] as const

export type TaskAction = (typeof TASK_ACTIONS)[number]['id']
const ACTION_IDS = new Set(TASK_ACTIONS.map((a) => a.id))

export const TASK_TRIGGERS = ['manual', 'hourly', 'daily', 'weekly'] as const
export type TaskTrigger = (typeof TASK_TRIGGERS)[number]

export function publicTask(t: StoredTask): AutomationTask & { action: string; group_id: string } {
  const { owner_id: _o, phone_ids: _p, runs: _r, created_at: _c, ...rest } = t
  return rest
}

export function tasksOf(userId: string) {
  return db().tasks
    .filter((t) => t.owner_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(publicTask)
}

export function createTask(user: User, input: {
  name: string
  action: string
  trigger: string
  group_id?: string
  command?: string
}): StoredTask {
  const name = clean(input.name, 80)
  if (name.length < 2) throw new InputError('Give the task a name of at least two characters.')
  if (!ACTION_IDS.has(input.action as TaskAction)) throw new InputError('Choose an action for the task.')

  const trigger = (TASK_TRIGGERS as readonly string[]).includes(input.trigger)
    ? (input.trigger as TaskTrigger)
    : 'manual'

  const groupId = clean(input.group_id, 40)
  if (groupId && !groupById(user.id, groupId)) throw new InputError('Group not found.', 404)

  const targets = groupId
    ? phonesOf(user.id).filter((p) => p.group.some((g) => g.id === groupId))
    : phonesOf(user.id)
  if (targets.length === 0) {
    throw new InputError('That group has no devices in it, so the task would never do anything.')
  }

  const task: StoredTask = {
    id: prefixedId('task'),
    owner_id: user.id,
    name,
    trigger,
    action: input.action,
    group_id: groupId,
    phone_ids: targets.map((p) => p.id),
    targets: targets.length,
    last_run: '—',
    success_rate: 0,
    status: trigger === 'manual' ? 'paused' : 'scheduled',
    runs: [],
    created_at: nowIso(),
  }
  if (input.action === 'command') {
    const command = clean(input.command, 400)
    if (!command) throw new InputError('An ADB task needs a command to run.')
    task.command = command
  }
  mutate((d) => d.tasks.push(task))
  return task
}

export function setTaskStatus(userId: string, id: string, status: AutomationTask['status']) {
  return mutate((d) => {
    const task = d.tasks.find((t) => t.id === id && t.owner_id === userId)
    if (!task) throw new InputError('Task not found.', 404)
    task.status = status
    return publicTask(task)
  })
}

export function deleteTask(userId: string, id: string) {
  return mutate((d) => {
    const at = d.tasks.findIndex((t) => t.id === id && t.owner_id === userId)
    if (at < 0) throw new InputError('Task not found.', 404)
    d.tasks.splice(at, 1)
    return { id }
  })
}

/** Record the outcome of a run and roll the success rate forward. */
export function recordRun(userId: string, id: string, ok: number, failed: number) {
  return mutate((d) => {
    const task = d.tasks.find((t) => t.id === id && t.owner_id === userId)
    if (!task) throw new InputError('Task not found.', 404)
    task.runs.push({ at: nowIso(), ok, failed })
    if (task.runs.length > 50) task.runs.shift()
    const totals = task.runs.reduce((s, r) => ({ ok: s.ok + r.ok, all: s.all + r.ok + r.failed }), { ok: 0, all: 0 })
    task.success_rate = totals.all === 0 ? 0 : Math.round((totals.ok / totals.all) * 1000) / 10
    task.last_run = nowIso()
    task.status = failed > 0 && ok === 0 ? 'failed' : task.trigger === 'manual' ? 'paused' : 'scheduled'
    return publicTask(task)
  })
}

export function taskById(userId: string, id: string): StoredTask | undefined {
  return db().tasks.find((t) => t.id === id && t.owner_id === userId)
}

/* --------------------------------- team ---------------------------------- */

export const TEAM_ROLES: TeamMember['role'][] = ['Admin', 'Operator', 'Viewer']

export function publicMember(m: StoredMember): TeamMember {
  const { owner_id: _o, invite_token: _t, user_id: _u, created_at: _c, ...rest } = m
  return rest
}

/** The owner is always shown first, derived from the account rather than stored. */
export function teamOf(user: User): TeamMember[] {
  const owner: TeamMember = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: 'Owner',
    phones: phonesOf(user.id).length,
    last_active: nowIso(),
    status: 'active',
  }
  const rest = db().members
    .filter((m) => m.owner_id === user.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(publicMember)
  return [owner, ...rest]
}

export function inviteMember(user: User, input: { name: string; email: string; role: string }) {
  const name = clean(input.name, 60)
  const email = clean(input.email, 160).toLowerCase()
  if (name.length < 2) throw new InputError('Enter the person’s name.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new InputError('Enter a valid email address.')
  if (email === user.email.toLowerCase()) throw new InputError('You are already on this team as the owner.')
  if (db().members.some((m) => m.owner_id === user.id && m.email === email)) {
    throw new InputError('That address is already on the team.')
  }
  const role = (TEAM_ROLES as string[]).includes(input.role) ? (input.role as TeamMember['role']) : 'Viewer'

  const member: StoredMember = {
    id: prefixedId('mbr'),
    owner_id: user.id,
    name,
    email,
    role,
    phones: 0,
    last_active: '—',
    status: 'invited',
    invite_token: crypto.randomBytes(24).toString('base64url'),
    created_at: nowIso(),
  }
  mutate((d) => d.members.push(member))
  return { member: publicMember(member), invite_token: member.invite_token! }
}

export function updateMember(user: User, id: string, patch: { role?: string; status?: string; name?: string }) {
  return mutate((d) => {
    const member = d.members.find((m) => m.id === id && m.owner_id === user.id)
    if (!member) throw new InputError('Member not found.', 404)
    if (patch.name) member.name = clean(patch.name, 60)
    if (patch.role && (TEAM_ROLES as string[]).includes(patch.role)) member.role = patch.role as TeamMember['role']
    if (patch.status === 'active' || patch.status === 'suspended') member.status = patch.status
    return publicMember(member)
  })
}

/** Look up a pending invitation by its token, without consuming it. */
export function findInvite(token: string): { member: StoredMember; owner: User } | null {
  const clean = String(token ?? '')
  if (clean.length < 10) return null
  const member = db().members.find((m) => m.invite_token === clean && m.status === 'invited')
  if (!member) return null
  const owner = db().users.find((u) => u.id === member.owner_id)
  return owner ? { member, owner } : null
}

/**
 * Turn an invitation into a login. The new user carries `parent_id`, so every
 * resource lookup resolves to the owner's account rather than an empty one.
 */
export function acceptInvite(token: string, password: string): { user: User; owner: User } {
  const found = findInvite(token)
  if (!found) throw new InputError('That invitation is not valid or has already been used.')
  if (findUserByEmail(found.member.email)) {
    throw new InputError('An account already exists for that email. Sign in instead.')
  }
  if (password.length < 10) throw new InputError('Use a password of at least 10 characters.')
  if (!/\d/.test(password)) throw new InputError('Include at least one number in your password.')

  const { password_hash, password_salt } = hashPassword(password)
  const user: User = {
    id: prefixedId('usr'),
    email: found.member.email,
    name: found.member.name,
    company: found.owner.company,
    role: found.member.role.toLowerCase() as User['role'],
    plan: found.owner.plan,
    password_hash,
    password_salt,
    created_at: nowIso(),
    minutes_balance: 0,
    credit_cents: 0,
    use_case: '',
    parent_id: found.owner.id,
  }
  mutate((d) => {
    d.users.push(user)
    const member = d.members.find((m) => m.id === found.member.id)!
    member.status = 'active'
    member.user_id = user.id
    member.last_active = nowIso()
    delete member.invite_token
  })
  return { user, owner: found.owner }
}

export function removeMember(user: User, id: string) {
  if (id === user.id) throw new InputError('You cannot remove the account owner.')
  return mutate((d) => {
    const at = d.members.findIndex((m) => m.id === id && m.owner_id === user.id)
    if (at < 0) throw new InputError('Member not found.', 404)
    const [member] = d.members.splice(at, 1)
    /* Their login goes with the membership — it only ever existed for this account. */
    if (member.user_id) d.users = d.users.filter((u) => u.id !== member.user_id)
    return { id }
  })
}

/* ------------------------------ sub-accounts ----------------------------- */

export const SUB_PLANS = ['Starter', 'Growth', 'Scale', 'Enterprise']

export function subAccountsOf(userId: string): SubAccount[] {
  return db().sub_accounts
    .filter((s) => s.owner_id === userId)
    .sort((a, b) => b.since.localeCompare(a.since))
    .map(({ owner_id: _o, ...rest }) => rest)
}

export function createSubAccount(user: User, input: {
  company: string
  contact: string
  email: string
  plan?: string
  minutes_quota?: number
  mrr?: number
  margin?: number
}): SubAccount {
  const company = clean(input.company, 80)
  const contact = clean(input.contact, 60)
  const email = clean(input.email, 160).toLowerCase()
  if (company.length < 2) throw new InputError('Enter the client’s company name.')
  if (contact.length < 2) throw new InputError('Enter a contact name.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new InputError('Enter a valid email address.')
  if (db().sub_accounts.some((s) => s.owner_id === user.id && s.email === email)) {
    throw new InputError('You already have a sub-account with that email.')
  }

  const margin = Math.max(0, Math.min(100, Math.round(Number(input.margin ?? 35))))
  const row: Owned<SubAccount> = {
    id: prefixedId('sub'),
    owner_id: user.id,
    company,
    contact,
    email,
    plan: SUB_PLANS.includes(String(input.plan)) ? String(input.plan) : 'Starter',
    phones: 0,
    minutes_used: 0,
    minutes_quota: Math.max(0, Math.floor(Number(input.minutes_quota ?? 50_000))),
    mrr: Math.max(0, Math.round(Number(input.mrr ?? 0))),
    margin,
    status: 'trial',
    since: nowIso().slice(0, 10),
  }
  mutate((d) => d.sub_accounts.push(row))
  const { owner_id: _o, ...rest } = row
  return rest
}

export function updateSubAccount(userId: string, id: string, patch: Partial<SubAccount>) {
  return mutate((d) => {
    const row = d.sub_accounts.find((s) => s.id === id && s.owner_id === userId)
    if (!row) throw new InputError('Sub-account not found.', 404)
    if (patch.company) row.company = clean(patch.company, 80)
    if (patch.contact) row.contact = clean(patch.contact, 60)
    if (patch.plan && SUB_PLANS.includes(patch.plan)) row.plan = patch.plan
    if (patch.status && ['active', 'trial', 'past_due', 'churned'].includes(patch.status)) row.status = patch.status
    if (patch.minutes_quota !== undefined) row.minutes_quota = Math.max(0, Math.floor(Number(patch.minutes_quota)))
    if (patch.mrr !== undefined) row.mrr = Math.max(0, Math.round(Number(patch.mrr)))
    if (patch.margin !== undefined) row.margin = Math.max(0, Math.min(100, Math.round(Number(patch.margin))))
    const { owner_id: _o, ...rest } = row
    return rest
  })
}

export function deleteSubAccount(userId: string, id: string) {
  return mutate((d) => {
    const at = d.sub_accounts.findIndex((s) => s.id === id && s.owner_id === userId)
    if (at < 0) throw new InputError('Sub-account not found.', 404)
    d.sub_accounts.splice(at, 1)
    return { id }
  })
}

/** RFC 4180 CSV — quotes doubled, fields containing a comma or quote wrapped. */
export function subAccountsCsv(userId: string): string {
  const cols: (keyof SubAccount)[] = [
    'id', 'company', 'contact', 'email', 'plan', 'phones',
    'minutes_used', 'minutes_quota', 'mrr', 'margin', 'status', 'since',
  ]
  const cell = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = subAccountsOf(userId).map((s) => cols.map((c) => cell(s[c])).join(','))
  return [cols.join(','), ...rows].join('\r\n') + '\r\n'
}

/* -------------------------------- profile -------------------------------- */

export function updateProfile(user: User, patch: {
  name?: string
  company?: string
  use_case?: string
  prefs?: UserPrefs
}) {
  const name = patch.name === undefined ? undefined : clean(patch.name, 60)
  if (name !== undefined && name.length < 2) throw new InputError('Enter a name of at least two characters.')
  return mutate((d) => {
    const row = d.users.find((u) => u.id === user.id)!
    if (name !== undefined) row.name = name
    if (patch.company !== undefined) row.company = clean(patch.company, 80)
    if (patch.use_case !== undefined) row.use_case = clean(patch.use_case, 400)
    if (patch.prefs) row.prefs = mergePrefs(row.prefs, patch.prefs)
    return row
  })
}

/** Merge a partial preferences patch, so one tab's save never clears another's. */
function mergePrefs(current: UserPrefs | undefined, patch: UserPrefs): UserPrefs {
  const bools = (v: unknown): Record<string, boolean> =>
    Object.fromEntries(Object.entries(v ?? {}).slice(0, 40).map(([k, x]) => [k.slice(0, 60), Boolean(x)]))

  return {
    timezone: patch.timezone === undefined ? current?.timezone : clean(patch.timezone, 60),
    language: patch.language === undefined ? current?.language : clean(patch.language, 10),
    notifications: patch.notifications
      ? { ...current?.notifications, ...bools(patch.notifications) }
      : current?.notifications,
    security: patch.security
      ? { ...current?.security, ...bools(patch.security) }
      : current?.security,
    brand: patch.brand
      ? {
        ...current?.brand,
        display_name: patch.brand.display_name === undefined
          ? current?.brand?.display_name : clean(patch.brand.display_name, 60),
        console_domain: patch.brand.console_domain === undefined
          ? current?.brand?.console_domain : clean(patch.brand.console_domain, 120),
        support_email: patch.brand.support_email === undefined
          ? current?.brand?.support_email : clean(patch.brand.support_email, 160),
        accent: patch.brand.accent === undefined
          ? current?.brand?.accent : clean(patch.brand.accent, 9),
      }
      : current?.brand,
  }
}

export function changePassword(user: User, input: { current: string; next: string }) {
  if (!verifyPassword(input.current ?? '', user)) {
    throw new InputError('That is not your current password.', 401)
  }
  const next = String(input.next ?? '')
  if (next.length < 10) throw new InputError('Use a password of at least 10 characters.')
  if (!/\d/.test(next)) throw new InputError('Include at least one number in your password.')
  if (next === input.current) throw new InputError('Choose a password you have not used here before.')

  const { password_hash, password_salt } = hashPassword(next)
  mutate((d) => {
    const row = d.users.find((u) => u.id === user.id)!
    row.password_hash = password_hash
    row.password_salt = password_salt
  })
  return { ok: true }
}

/**
 * Close an account: erase the devices, records and uploaded bytes it owns.
 * Orders are kept — they are financial records — but detached from the login.
 */
export function closeAccount(user: User) {
  const blobs = db().files.filter((f) => f.owner_id === user.id).map((f) => f.blob)
  mutate((d) => {
    d.phones = d.phones.filter((p) => p.owner_id !== user.id)
    d.groups = d.groups.filter((g) => g.owner_id !== user.id)
    d.proxies = d.proxies.filter((p) => p.owner_id !== user.id)
    d.api_keys = d.api_keys.filter((k) => k.owner_id !== user.id)
    d.files = d.files.filter((f) => f.owner_id !== user.id)
    d.numbers = d.numbers.filter((n) => n.owner_id !== user.id)
    d.tasks = d.tasks.filter((t) => t.owner_id !== user.id)
    d.members = d.members.filter((m) => m.owner_id !== user.id)
    d.sub_accounts = d.sub_accounts.filter((s) => s.owner_id !== user.id)
    d.threads = d.threads.filter((t) => t.user_id !== user.id)
    d.users = d.users.filter((u) => u.id !== user.id)
    for (const order of d.orders) if (order.user_id === user.id) order.note = 'Account closed'
  })
  for (const blob of blobs) {
    try { fs.unlinkSync(path.join(fileDir(), blob)) } catch { /* already gone */ }
  }
  return { ok: true }
}

/* ------------------------------ password reset --------------------------- */

/**
 * Reset tokens are HMACs over the user's current password hash, so a token
 * stops working the moment the password changes and nothing has to be stored.
 */
const RESET_TTL_MS = 60 * 60 * 1000

function resetSecret(): string {
  return process.env.MADOVA_SESSION_SECRET ?? 'madova-dev-secret'
}

export function issueResetToken(email: string): { token: string; user: User } | null {
  const user = findUserByEmail(email)
  if (!user) return null
  const expiry = Date.now() + RESET_TTL_MS
  const mac = crypto.createHmac('sha256', resetSecret())
    .update(`${user.id}.${expiry}.${user.password_hash}`)
    .digest('base64url')
  return { token: `${user.id}.${expiry}.${mac}`, user }
}

export function consumeResetToken(token: string, nextPassword: string) {
  const [userId, expiryRaw, mac] = String(token).split('.')
  const expiry = Number(expiryRaw)
  if (!userId || !Number.isFinite(expiry) || !mac) throw new InputError('That reset link is not valid.')
  if (Date.now() > expiry) throw new InputError('That reset link has expired. Request a new one.')

  const user = db().users.find((u) => u.id === userId)
  if (!user) throw new InputError('That reset link is not valid.')

  const expected = crypto.createHmac('sha256', resetSecret())
    .update(`${user.id}.${expiry}.${user.password_hash}`)
    .digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new InputError('That reset link is not valid or has already been used.')
  }

  if (nextPassword.length < 10) throw new InputError('Use a password of at least 10 characters.')
  if (!/\d/.test(nextPassword)) throw new InputError('Include at least one number in your password.')

  const { password_hash, password_salt } = hashPassword(nextPassword)
  mutate((d) => {
    const row = d.users.find((u) => u.id === userId)!
    row.password_hash = password_hash
    row.password_salt = password_salt
  })
  return { user }
}

/* -------------------------------- overview ------------------------------- */

/** Everything the console dashboard needs, computed from real records. */
export function overview(user: User) {
  const phones = phonesOf(user.id)
  const byRegion = new Map<string, number>()
  for (const p of phones) byRegion.set(p.region, (byRegion.get(p.region) ?? 0) + 1)

  const usage = usageSeries(user.id, 98)

  return {
    phones: phones.length,
    groups: groupsOf(user.id).length,
    proxies: db().proxies.filter((p) => p.owner_id === user.id).length,
    apps: appsOf(user.id).length,
    files: driveUsage(user.id),
    numbers: db().numbers.filter((n) => n.owner_id === user.id).length,
    tasks: tasksOf(user.id),
    team: teamOf(user).length,
    regions: [...byRegion.entries()]
      .map(([region, count]) => ({
        region,
        area: REGION_INDEX[region]?.area ?? region,
        flag: REGION_INDEX[region]?.flag ?? '🏳️',
        count,
      }))
      .sort((a, b) => b.count - a.count),
    /* 30 days for the minutes chart, 98 (14 weeks) for the boot heatmap. */
    usage_30d: usage.slice(-30),
    boots_98d: usage.map((u) => ({ date: u.date, boots: u.boots })),
    minutes_30d: usage.slice(-30).reduce((s, u) => s + u.minutes, 0),
  }
}
