/**
 * Thin client for the MADOVA API server.
 *
 * The browser talks only to our own origin. The cloud phone API key, password
 * hashes, session signing and model credentials all live server-side.
 */

export interface Envelope<T> {
  code: number
  data: T
  message: string
}

export class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError(0, 'Could not reach the MADOVA API. Is the server running?')
  }

  let payload: Envelope<T>
  try {
    payload = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError(res.status, `The server returned an unexpected response (${res.status}).`)
  }

  if (payload.code !== 200) throw new ApiError(payload.code, payload.message || 'Request failed')
  return payload.data
}

export const apiGet = <T,>(path: string) => request<T>(path)

export const apiPost = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

/* --------------------------------- types -------------------------------- */

export interface SessionUser {
  id: string
  email: string
  name: string
  company: string
  role: 'owner' | 'admin' | 'operator' | 'viewer'
  plan: 'trial' | 'starter' | 'growth' | 'scale'
  created_at: string
  minutes_balance: number
  credit_cents: number
  use_case: string
}

export interface AccountSummary {
  plan: string
  minutes_balance: number
  credit_cents: number
  phones_total: number
  phones_powered_on: number
  phones_powered_off: number
  phones_expired: number
  regions: string[]
  orders_total: number
  orders_pending: number
  spend_cents: number
}

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
  status: 'pending' | 'paid' | 'cancelled' | 'failed'
  lines: OrderLine[]
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  provision?: { quantity: number; region: string; os: string; duration_days: number; group_name?: string }
  minutes?: number
  renew_phone_ids?: string[]
  renew_days?: number
  created_at: string
  paid_at?: string
  created_by: 'user' | 'assistant'
  note?: string
}

export interface Quote {
  lines: OrderLine[]
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  tier_off: number
}

export interface KnowledgeArticle {
  id: string
  category: string
  title: string
  summary: string
  tags: string[]
  body: string
}

export interface ServerMeta {
  assistant: {
    configured: boolean
    model: string | null
    provider: string | null
    provider_label: string | null
  }
  cloud: { upstream: boolean }
  demo_account: { email: string; hint: string }
  durations: number[]
}

export interface ThreadMessage {
  id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  text: string
  at: string
  actions?: { name: string; summary: string; ok: boolean }[]
  pending_order_id?: string
}

export interface SupportThread {
  id: string
  user_id: string | null
  guest_key: string | null
  subject: string
  status: 'open' | 'awaiting_human' | 'resolved'
  messages: ThreadMessage[]
  created_at: string
  updated_at: string
}

/* -------------------------------- calls --------------------------------- */

export const api = {
  meta: () => apiGet<ServerMeta>('/api/meta'),

  me: () => apiGet<{ user: SessionUser | null; account?: AccountSummary }>('/api/auth/me'),
  login: (email: string, password: string) =>
    apiPost<{ user: SessionUser }>('/api/auth/login', { email, password }),
  register: (input: { email: string; password: string; name: string; company?: string; use_case?: string }) =>
    apiPost<{ user: SessionUser }>('/api/auth/register', input),
  logout: () => apiPost<{ ok: true }>('/api/auth/logout'),

  quote: (input: { quantity: number; duration_days: number; region: string; minutes?: number }) =>
    apiPost<Quote>('/api/quote', input),
  orders: () => apiGet<{ orders: Order[] }>('/api/orders'),
  createOrder: (input: { quantity: number; duration_days: number; region: string; minutes?: number; group_name?: string }) =>
    apiPost<{ order: Order }>('/api/orders', input),
  payOrder: (id: string) => apiPost<{ order: Order; provisioned: string[] }>(`/api/orders/${id}/pay`),
  cancelOrder: (id: string) => apiPost<{ ok: true }>(`/api/orders/${id}/cancel`),

  knowledge: (q?: string) =>
    apiGet<{ categories: string[]; articles: KnowledgeArticle[] }>(
      `/api/knowledge${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  thread: (guestKey: string) =>
    apiPost<{ thread: SupportThread; assistant: { configured: boolean } }>('/api/support/thread', { guest_key: guestKey }),
  resolveThread: (guestKey: string) => apiPost<{ ok: true }>('/api/support/resolve', { guest_key: guestKey }),
}
