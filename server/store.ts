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
import { fileURLToPath } from 'node:url'
import type { CloudPhone } from '../src/lib/duoplus/types'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.MADOVA_DATA_DIR ?? path.join(here, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'madova.json')

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
  /** Account credit in USD cents, used to settle orders in this demo build. */
  credit_cents: number
  use_case: string
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
  paid_at?: string
  /** Set when an order was raised by the assistant and awaits the customer's approval. */
  created_by: 'user' | 'assistant'
  note?: string
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

export interface Database {
  version: number
  users: User[]
  phones: (CloudPhone & { owner_id: string })[]
  orders: Order[]
  threads: SupportThread[]
}

const EMPTY: Database = { version: 1, users: [], phones: [], orders: [], threads: [] }

let cache: Database | null = null

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function db(): Database {
  if (cache) return cache
  ensureDir()
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8')
    cache = { ...EMPTY, ...(JSON.parse(raw) as Database) }
  } catch {
    cache = structuredClone(EMPTY)
  }
  return cache
}

/** Write the whole document atomically — rename is atomic on the same filesystem. */
export function persist() {
  if (!cache) return
  ensureDir()
  const tmp = `${DB_PATH}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2))
  fs.renameSync(tmp, DB_PATH)
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
