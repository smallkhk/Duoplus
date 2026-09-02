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
import {
  db, findUser, findUserByEmail, mutate, nowIso, prefixedId, type User, type UserRole,
} from './store.js'

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

/** Constant-time check of a secret against a stored hash and salt. */
export function verifyHash(secret: string, storedHash: string, salt: string): boolean {
  const candidate = Buffer.from(hash(secret, salt), 'hex')
  const expected = Buffer.from(storedHash, 'hex')
  if (candidate.length !== expected.length) return false
  return crypto.timingSafeEqual(candidate, expected)
}

export function verifyPassword(password: string, user: User): boolean {
  return verifyHash(password, user.password_hash, user.password_salt)
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
      /**
       * The account the request operates on. For a team member this is the
       * owner, so every resource lookup finds the fleet they were invited to.
       */
      user?: User
      /** Who is actually signed in. Differs from `user` only for team members. */
      actor?: User
    }
  }
}

/**
 * Attaches req.actor (who signed in) and req.user (whose account they act on).
 * Never rejects — routes decide what needs a session.
 */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const actor = readSession(req)
  if (actor) {
    req.actor = actor
    req.user = actor.parent_id ? findUser(actor.parent_id) ?? actor : actor
  }
  next()
}

/** The role the signed-in person holds on the account they are acting inside. */
export function actorRole(req: Request): UserRole {
  return req.actor?.parent_id ? req.actor.role : 'owner'
}

const RANK: Record<UserRole, number> = { viewer: 0, operator: 1, admin: 2, owner: 3 }

/** Gate a route on a minimum role. Owners always pass. */
export function requireRole(min: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ code: 401, data: null, message: 'Sign in to continue' })
      return
    }
    if (RANK[actorRole(req)] < RANK[min]) {
      res.status(403).json({
        code: 403,
        data: null,
        message: `This needs the ${min} role. You are signed in as ${actorRole(req)}.`,
      })
      return
    }
    next()
  }
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
