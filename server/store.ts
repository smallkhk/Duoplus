/**
 * Durable store for the MADOVA backend.
 *
 * A single JSON document on disk, written atomically. That is deliberately
 * modest: it keeps the app dependency-free and easy to run, and every access
 * goes through the helpers below, so swapping in Postgres later means
 * rewriting this file and nothing else.
 */
import fs from 'node:fs'
import path from 'node:path'
import type {
  AutomationTask, CloudDriveFile, CloudNumber, CloudPhone, InstalledApp, PhoneGroup,
  Proxy, SmsMessage, SubAccount, TeamMember,
} from '../src/lib/duoplus/types'
import type { PaymentIntent } from './crypto.js'

/**
 * Paths resolve from the working directory rather than the module's own
 * location, so the server behaves the same whether it runs from source in
 * development or as a single bundled file in production.
 */
const DATA_DIR = process.env.MADOVA_DATA_DIR ?? path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'madova.json')
/** Uploaded bytes live beside the database rather than inside it. */
export const FILE_DIR = path.join(DATA_DIR, 'files')

export function fileDir(): string {
  fs.mkdirSync(FILE_DIR, { recursive: true })
  return FILE_DIR
}

export type UserRole = 'owner' | 'admin' | 'operator' | 'viewer'
export type PlanId = 'trial' | 'starter' | 'growth' | 'scale'

export interface User {
  id: string
  email: string
  name: string
  company: string
  role: UserRole
  plan: PlanId
  password_hash: string
  password_salt: string
  created_at: string
  /** Prepaid startup minutes remaining. */
  minutes_balance: number
  /** Account credit in USD cents. Settles orders and rents cloud numbers. */
  credit_cents: number
  use_case: string
  /**
   * Set on a team member's login: the owner whose account they work inside.
   * Absent on an account owner. Every resource is scoped to the owner, so a
   * member sees the owner's fleet, not an empty one of their own.
   */
  parent_id?: string
  /** Console preferences. Absent on accounts created before they existed. */
  prefs?: UserPrefs
}

/** Account-level settings the console writes and reads back. */
export interface UserPrefs {
  timezone?: string
  language?: string
  /** Which events raise an email. Only delivered when a mail transport is set. */
  notifications?: Record<string, boolean>
  security?: Record<string, boolean>
  brand?: {
    display_name?: string
    console_domain?: string
    support_email?: string
    accent?: string
  }
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'failed'

export interface OrderLine {
  kind: 'device' | 'minutes'
  description: string
  quantity: number
  unit_cents: number
  total_cents: number
}

export interface Order {
  id: string
  user_id: string
  status: OrderStatus
  lines: OrderLine[]
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  /** Provisioning intent, applied when the order is paid. */
  provision?: { quantity: number; region: string; os: string; duration_days: number; group_name?: string }
  minutes?: number
  /** Devices this order extends, when it is a renewal rather than a purchase. */
  renew_phone_ids?: string[]
  renew_days?: number
  created_at: string
  updated_at?: string
  paid_at?: string
  /** Set when an order was raised by the assistant and awaits the customer's approval. */
  created_by: 'user' | 'assistant'
  note?: string
  /** On-chain invoice, once the customer picks a payment method. */
  payment?: PaymentIntent
}

export interface SupportMessage {
  id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  text: string
  at: string
  /** Tool activity attached to an assistant turn, for the transcript UI. */
  actions?: { name: string; summary: string; ok: boolean }[]
  /** An order the assistant raised that the customer still has to approve. */
  pending_order_id?: string
}

export interface SupportThread {
  id: string
  user_id: string | null
  /** Anonymous visitors get a thread keyed by a browser-held id. */
  guest_key: string | null
  subject: string
  status: 'open' | 'awaiting_human' | 'resolved'
  messages: SupportMessage[]
  created_at: string
  updated_at: string
}

/** Every record below is scoped to the account that owns it. */
export type Owned<T> = T & { owner_id: string }

/** A device, plus the app changes and metering state carried on it. */
export type StoredPhone = Owned<CloudPhone> & {
  installed_apps?: InstalledApp[]
  removed_apps?: string[]
  /**
   * When the current powered-on stretch started, as an epoch millisecond.
   * Metering accrues from here to now and then moves the marker forward, so a
   * device that stays up for weeks is still billed day by day.
   */
  metered_from?: number
}

/** One day of consumption for one account. The unit customers buy is a minute. */
export interface UsageDay {
  owner_id: string
  /** YYYY-MM-DD, in UTC. */
  date: string
  minutes: number
  boots: number
}

export interface ApiKey {
  id: string
  owner_id: string
  name: string
  /** First characters of the secret, shown in the console to identify a key. */
  prefix: string
  /** scrypt hash of the secret. The secret itself is shown once and never stored. */
  secret_hash: string
  secret_salt: string
  scopes: string[]
  created_at: string
  last_used_at?: string
  revoked_at?: string
}

/** A file in the account's cloud drive. Bytes live beside the database. */
export type StoredFile = Owned<CloudDriveFile> & {
  /** Filename under the data directory's `files/` folder. */
  blob: string
  mime: string
  bytes: number
}

export type StoredNumber = Owned<CloudNumber> & { messages: SmsMessage[] }

export type StoredTask = Owned<AutomationTask> & {
  action: string
  /** Only set for ADB tasks. */
  command?: string
  group_id: string
  phone_ids: string[]
  runs: { at: string; ok: number; failed: number }[]
  created_at: string
}

/** A team member is a user in their own right once they accept the invite. */
export type StoredMember = Owned<TeamMember> & {
  invite_token?: string
  user_id?: string
  created_at: string
}

export interface Database {
  version: number
  users: User[]
  phones: StoredPhone[]
  orders: Order[]
  threads: SupportThread[]
  groups: Owned<PhoneGroup>[]
  proxies: Owned<Proxy>[]
  api_keys: ApiKey[]
  files: StoredFile[]
  numbers: StoredNumber[]
  tasks: StoredTask[]
  members: StoredMember[]
  sub_accounts: Owned<SubAccount>[]
  usage: UsageDay[]
  /**
   * Runtime configuration set from the admin page. Takes precedence over the
   * process environment, so a deployment with no shell can still be configured.
   */
  settings?: Record<string, string>
  settings_updated_at?: string
}

const EMPTY: Database = {
  version: 2,
  users: [], phones: [], orders: [], threads: [],
  groups: [], proxies: [], api_keys: [], files: [],
  numbers: [], tasks: [], members: [], sub_accounts: [], usage: [],
}

let cache: Database | null = null
/** Modification time of the file the cache was built from. */
let cacheMtimeMs = 0

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function diskMtimeMs(): number {
  try {
    return fs.statSync(DB_PATH).mtimeMs
  } catch {
    return 0
  }
}

function load(): Database {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8')
    cacheMtimeMs = diskMtimeMs()
    return { ...EMPTY, ...(JSON.parse(raw) as Database) }
  } catch {
    cacheMtimeMs = 0
    return structuredClone(EMPTY)
  }
}

/**
 * Read the database, refreshing from disk when another process has written to
 * it since we last looked.
 *
 * Passenger and most process managers run several worker processes against one
 * application directory. Without this check each worker would keep its own
 * stale copy and silently overwrite the others' writes on the next save.
 */
export function db(): Database {
  ensureDir()
  if (!cache) {
    cache = load()
    return cache
  }
  if (diskMtimeMs() !== cacheMtimeMs) cache = load()
  return cache
}

/** Write the whole document atomically — rename is atomic on the same filesystem. */
export function persist() {
  if (!cache) return
  ensureDir()
  const tmp = `${DB_PATH}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2))
  fs.renameSync(tmp, DB_PATH)
  cacheMtimeMs = diskMtimeMs()
}

/** Run a mutation and persist it. */
export function mutate<T>(fn: (d: Database) => T): T {
  const result = fn(db())
  persist()
  return result
}

const ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789'

export function shortId(length = 5): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  return out
}

export function prefixedId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${shortId(4)}`
}

export function nowIso(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function findUserByEmail(email: string): User | undefined {
  return db().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
}

export function findUser(id: string): User | undefined {
  return db().users.find((u) => u.id === id)
}

/** Public shape of a user — never leaks the password material. */
export function publicUser(u: User) {
  const { password_hash: _h, password_salt: _s, ...rest } = u
  return rest
}
