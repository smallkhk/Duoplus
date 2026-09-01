/**
 * Password auth with signed, httpOnly session cookies.
 *
 * Passwords are hashed with scrypt and a per-user salt; sessions are a signed
 * `userId.expiry` token verified with an HMAC, so no session table is needed.
 * Set MADOVA_SESSION_SECRET in any real deployment — the fallback below is
 * generated per process, which logs everyone out on restart.
 */
import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { db, findUser, findUserByEmail, mutate, nowIso, prefixedId, type User } from './store.js'

const SECRET = process.env.MADOVA_SESSION_SECRET ?? crypto.randomBytes(32).toString('hex')
const COOKIE = 'madova_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

function hash(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT).toString('hex')
}

export function hashPassword(password: string): { password_hash: string; password_salt: string } {
  const password_salt = crypto.randomBytes(16).toString('hex')
  return { password_salt, password_hash: hash(password, password_salt) }
}

export function verifyPassword(password: string, user: User): boolean {
  const candidate = Buffer.from(hash(password, user.password_salt), 'hex')
  const expected = Buffer.from(user.password_hash, 'hex')
  if (candidate.length !== expected.length) return false
  return crypto.timingSafeEqual(candidate, expected)
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function issueSession(res: Response, userId: string) {
  const expires = Date.now() + SESSION_TTL_MS
  const payload = `${userId}.${expires}`
  const token = `${payload}.${sign(payload)}`
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  })
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: '/' })
}

function readSession(req: Request): User | null {
  const raw = req.cookies?.[COOKIE]
  if (typeof raw !== 'string') return null
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [userId, expires, mac] = parts
  const expected = sign(`${userId}.${expires}`)
  if (mac.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
  if (Number(expires) < Date.now()) return null
  return findUser(userId) ?? null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const user = readSession(req)
  if (user) req.user = user
  next()
}

/** Rejects the request when there is no session. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ code: 401, data: null, message: 'Sign in to continue' })
    return
  }
  next()
}

export interface RegisterInput {
  email: string
  password: string
  name: string
  company?: string
  use_case?: string
}

export function validateRegistration(input: Partial<RegisterInput>): string | null {
  const email = (input.email ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Enter a valid email address.'
  if (!input.name || input.name.trim().length < 2) return 'Enter your name.'
  if (!input.password || input.password.length < 10) return 'Use a password of at least 10 characters.'
  if (!/\d/.test(input.password)) return 'Include at least one number in your password.'
  if (findUserByEmail(email)) return 'An account already exists for that email.'
  return null
}

export function createUser(input: RegisterInput): User {
  const { password_hash, password_salt } = hashPassword(input.password)
  const user: User = {
    id: prefixedId('usr'),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    company: (input.company ?? '').trim(),
    role: 'owner',
    plan: 'trial',
    password_hash,
    password_salt,
    created_at: nowIso(),
    minutes_balance: 30,
    credit_cents: 0,
    use_case: (input.use_case ?? '').trim(),
  }
  mutate((d) => d.users.push(user))
  return user
}

export function userCount(): number {
  return db().users.length
}
