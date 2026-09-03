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

export const apiPatch = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })

export const apiDelete = <T,>(path: string) => request<T>(path, { method: 'DELETE' })

/** Upload raw bytes. The filename rides in a header so no multipart parser is needed. */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-MADOVA-Filename': encodeURIComponent(file.name),
      },
      body: file,
    })
  } catch {
    throw new ApiError(0, 'Could not reach the MADOVA API. Is the server running?')
  }
  let payload: Envelope<T>
  try {
    payload = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError(res.status, res.status === 413
      ? 'That file is larger than the upload limit.'
      : `The server returned an unexpected response (${res.status}).`)
  }
  if (payload.code !== 200) throw new ApiError(payload.code, payload.message || 'Upload failed')
  return payload.data
}

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
  prefs?: UserPrefs
}

export interface UserPrefs {
  timezone?: string
  language?: string
  notifications?: Record<string, boolean>
  security?: Record<string, boolean>
  brand?: {
    display_name?: string
    console_domain?: string
    support_email?: string
    accent?: string
  }
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

export interface PaymentIntent {
  chain: 'bsc' | 'tron'
  network: string
  token: string
  address: string
  amount: string
  amount_units: string
  contract: string
  created_at: string
  expires_at: string
  status: 'awaiting' | 'confirming' | 'confirmed' | 'expired'
  tx_hash?: string
  confirmations?: number
  explorer_url?: string
  payment_uri: string
  qr_svg: string
  note?: string
}

export interface PaymentChain {
  id: 'bsc' | 'tron'
  label: string
  network: string
  token: string
  confirmations?: number
  settle_after_seconds?: number
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
  updated_at?: string
  paid_at?: string
  created_by: 'user' | 'assistant'
  note?: string
  payment?: PaymentIntent
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
  mail: { configured: boolean }
  demo_account: { email: string; available: boolean }
  oauth: { providers: string[] }
  durations: number[]
  payments: {
    enabled: ('bsc' | 'tron')[]
    window_minutes: number
    chains: PaymentChain[]
  }
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

/* --------------------------- resource records ---------------------------- */

export interface ApiKeyRecord {
  id: string
  name: string
  prefix: string
  scopes: string[]
  created_at: string
  last_used_at?: string
  revoked_at?: string
  status: 'active' | 'revoked'
}

export interface ApiScope { id: string; label: string }

export interface ProxyRecord {
  id: string
  name: string
  host: string
  port: string
  user: string
  area: string
  group_ids: string[]
  group_name: string[]
  protocol: 'socks5' | 'http' | 'https'
  latency_ms: number
  checked_at: string
  healthy: boolean
}

export interface GroupRecord { id: string; name: string; sort: number; remark: string }

export interface FileRecord {
  id: string
  name: string
  kind: 'apk' | 'image' | 'video' | 'archive' | 'other'
  size: string
  uploaded_at: string
  pushed_to: number
}

export interface NumberRecord {
  id: string
  msisdn: string
  country: string
  operator: string
  bound_image_id: string | null
  bound_index?: number | null
  expired_at: string
  status: number
}

export interface SmsRecord { message: string; code: string; received_at: string }

export interface TaskRecord {
  id: string
  name: string
  trigger: string
  action: string
  group_id: string
  targets: number
  last_run: string
  success_rate: number
  status: 'running' | 'scheduled' | 'paused' | 'failed'
}

export interface MemberRecord {
  id: string
  name: string
  email: string
  role: 'Owner' | 'Admin' | 'Operator' | 'Viewer'
  phones: number
  last_active: string
  status: 'active' | 'invited' | 'suspended'
}

export interface AppRecord {
  package_name: string
  name: string
  version: string
  size: string
  installed_at: string
  devices: number
}

export interface OverviewData {
  phones: number
  groups: number
  proxies: number
  apps: number
  files: { bytes: number; count: number }
  numbers: number
  tasks: TaskRecord[]
  team: number
  regions: { region: string; area: string; flag: string; count: number }[]
  usage_30d: { date: string; minutes: number; boots: number }[]
  boots_98d: { date: string; boots: number }[]
  minutes_30d: number
}

export interface SettingField {
  key: string
  label: string
  kind: 'text' | 'secret' | 'number' | 'select'
  env: string
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  fallback?: string
  /** Masked for a secret; the real value for everything else. */
  value: string
  set: boolean
  source: 'admin' | 'env' | 'default' | 'unset'
}

export interface SettingGroup {
  id: string
  label: string
  lead: string
  icon: string
  fields: SettingField[]
}

export interface HealthCheck {
  id: string
  label: string
  state: 'ok' | 'warn' | 'off' | 'error'
  detail: string
}

export interface AdminSettings {
  groups: SettingGroup[]
  updated_at: string | null
  health: HealthCheck[]
  changed?: string[]
}

export interface BatchOutcome {
  success: string[]
  fail: string[]
  fail_reason: Record<string, string>
}

/* -------------------------------- calls --------------------------------- */

export const api = {
  meta: () => apiGet<ServerMeta>('/api/meta'),

  me: () => apiGet<{
    user: SessionUser | null
    account?: AccountSummary
    role?: 'owner' | 'admin' | 'operator' | 'viewer'
    account_owner?: { name: string; company: string } | null
    is_admin?: boolean
  }>('/api/auth/me'),
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
  createPayment: (id: string, chain: 'bsc' | 'tron') =>
    apiPost<{ payment: PaymentIntent }>(`/api/orders/${id}/payment`, { chain }),
  checkPayment: (id: string) =>
    apiGet<{ payment: PaymentIntent; order: Order; provisioned: string[]; check: string }>(
      `/api/orders/${id}/payment`),
  cancelOrder: (id: string) => apiPost<{ ok: true }>(`/api/orders/${id}/cancel`),

  knowledge: (q?: string) =>
    apiGet<{ categories: string[]; articles: KnowledgeArticle[] }>(
      `/api/knowledge${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  thread: (guestKey: string) =>
    apiPost<{ thread: SupportThread; assistant: { configured: boolean } }>('/api/support/thread', { guest_key: guestKey }),
  resolveThread: (guestKey: string) => apiPost<{ ok: true }>('/api/support/resolve', { guest_key: guestKey }),

  /* ------------------------------- groups ------------------------------- */
  groups: () => apiGet<{ groups: GroupRecord[] }>('/api/groups'),
  createGroup: (input: { name: string; sort?: number; remark?: string }) =>
    apiPost<{ group: GroupRecord }>('/api/groups', input),
  updateGroup: (id: string, input: { name?: string; sort?: number; remark?: string }) =>
    apiPatch<{ group: GroupRecord }>(`/api/groups/${id}`, input),
  deleteGroup: (id: string) => apiDelete<{ moved: number; moved_to: string }>(`/api/groups/${id}`),
  assignGroup: (id: string, phoneIds: string[]) =>
    apiPost<{ result: BatchOutcome }>(`/api/groups/${id}/assign`, { phone_ids: phoneIds }),

  /* ------------------------------- proxies ------------------------------ */
  proxies: () => apiGet<{ proxies: ProxyRecord[]; managed: boolean }>('/api/proxies'),
  createProxy: (input: {
    name?: string; host: string; port: string | number; user?: string
    password?: string; protocol?: string; area?: string; group_ids?: string[]
  }) => apiPost<{ proxy: ProxyRecord }>('/api/proxies', input),
  importProxies: (text: string, groupIds?: string[]) =>
    apiPost<{ added: ProxyRecord[]; skipped: { line: string; reason: string }[] }>(
      '/api/proxies/import', { text, group_ids: groupIds ?? [] }),
  checkProxy: (id: string) => apiPost<{ proxy: ProxyRecord }>(`/api/proxies/${id}/check`),
  deleteProxy: (id: string) => apiDelete<{ detached: number }>(`/api/proxies/${id}`),
  bindProxy: (id: string, phoneIds: string[], dns = true) =>
    apiPost<{ result: BatchOutcome }>(`/api/proxies/${id}/bind`, { phone_ids: phoneIds, dns }),
  /** Configure devices with an endpoint the customer types in themselves. */
  attachOwnProxy: (phoneIds: string[], input: {
    host: string; port: string; user?: string; password?: string; protocol?: string; dns?: boolean
  }) => apiPost<{ result: BatchOutcome }>('/api/proxies/direct', { phone_ids: phoneIds, ...input }),
  unbindProxy: (phoneIds: string[]) =>
    apiPost<{ result: BatchOutcome }>('/api/proxies/unbind', { phone_ids: phoneIds }),

  /* ------------------------------- screen ------------------------------- */
  screenLink: (phoneId: string, view?: {
    width?: number; height?: number; clarity?: string; fps?: number; bitrate?: number
  }) => apiPost<{ url: string; code: string }>(`/api/phones/${phoneId}/screen`, view ?? {}),
  stopSharing: (phoneId: string) =>
    apiDelete<{ stopped: true }>(`/api/phones/${phoneId}/screen`),

  /* -------------------------------- apps -------------------------------- */
  apps: () => apiGet<{ apps: AppRecord[] }>('/api/apps'),
  uninstallApp: (packageName: string, phoneIds?: string[]) =>
    apiPost<{ result: BatchOutcome }>('/api/apps/uninstall', {
      package_name: packageName, phone_ids: phoneIds ?? [],
    }),

  /* ----------------------------- cloud drive ---------------------------- */
  files: () => apiGet<{ files: FileRecord[]; usage: { bytes: number; count: number } }>('/api/files'),
  uploadFile: (file: File) => apiUpload<{ file: FileRecord }>('/api/files', file),
  deleteFile: (id: string) => apiDelete<{ id: string }>(`/api/files/${id}`),
  pushFile: (id: string, phoneIds: string[]) =>
    apiPost<{ file: FileRecord; pushed: number }>(`/api/files/${id}/push`, { phone_ids: phoneIds }),

  /* ---------------------------- cloud numbers --------------------------- */
  numbers: () => apiGet<{ numbers: NumberRecord[]; sms: SmsRecord[] }>('/api/numbers'),
  rentNumber: (input: { country: string; months?: number }) =>
    apiPost<{ number: NumberRecord; charged_cents: number }>('/api/numbers', input),
  bindNumber: (id: string, phoneId: string | null) =>
    apiPost<{ number: NumberRecord }>(`/api/numbers/${id}/bind`, { phone_id: phoneId }),
  releaseNumber: (id: string) => apiDelete<{ id: string }>(`/api/numbers/${id}`),

  /* ------------------------------ automation ---------------------------- */
  tasks: () => apiGet<{
    tasks: TaskRecord[]
    actions: { id: string; label: string }[]
    triggers: string[]
  }>('/api/tasks'),
  createTask: (input: { name: string; action: string; trigger: string; group_id?: string; command?: string }) =>
    apiPost<{ task: TaskRecord }>('/api/tasks', input),
  setTaskStatus: (id: string, status: TaskRecord['status']) =>
    apiPatch<{ task: TaskRecord }>(`/api/tasks/${id}`, { status }),
  deleteTask: (id: string) => apiDelete<{ id: string }>(`/api/tasks/${id}`),
  runTask: (id: string) => apiPost<{ task: TaskRecord; ok: number; failed: number }>(`/api/tasks/${id}/run`),

  /* --------------------------------- team ------------------------------- */
  team: () => apiGet<{ team: MemberRecord[]; roles: MemberRecord['role'][] }>('/api/team'),
  inviteMember: (input: { name: string; email: string; role: string }) =>
    apiPost<{ member: MemberRecord; invite_token: string }>('/api/team', input),
  updateMember: (id: string, input: { name?: string; role?: string; status?: string }) =>
    apiPatch<{ member: MemberRecord }>(`/api/team/${id}`, input),
  removeMember: (id: string) => apiDelete<{ id: string }>(`/api/team/${id}`),

  overview: () => apiGet<OverviewData>('/api/overview'),

  /* -------------------------- site administration ----------------------- */
  adminSettings: () => apiGet<AdminSettings>('/api/admin/settings'),
  saveAdminSettings: (patch: Record<string, string>) =>
    request<AdminSettings>('/api/admin/settings', {
      method: 'PUT', body: JSON.stringify(patch),
    }),
  testConfig: (what: 'cloud' | 'assistant' | 'bsc' | 'tron') =>
    apiPost<{ ok: boolean; message: string }>(`/api/admin/test/${what}`),
  checkIntegration: () =>
    apiPost<{
      ok: boolean
      summary: string
      steps: { label: string; ok: boolean; detail: string }[]
    }>('/api/admin/check-integration'),
  removeDemo: () =>
    apiPost<{ removed: boolean; phones: number; message: string; health: HealthCheck[] }>(
      '/api/admin/remove-demo'),
  adminKeys: () => apiGet<{ keys: ApiKeyRecord[]; scopes: ApiScope[] }>('/api/admin/keys'),
  createAdminKey: (input: { name: string; scopes: string[] }) =>
    apiPost<{ key: ApiKeyRecord; secret: string }>('/api/admin/keys', input),
  revokeAdminKey: (id: string) => apiDelete<{ key: ApiKeyRecord }>(`/api/admin/keys/${id}`),

  /* ------------------------------- account ------------------------------ */
  updateProfile: (input: { name?: string; company?: string; use_case?: string; prefs?: UserPrefs }) =>
    apiPatch<{ user: SessionUser }>('/api/profile', input),
  changePassword: (current: string, next: string) =>
    apiPost<{ ok: true }>('/api/password', { current, next }),
  closeAccount: (confirm: string) => apiPost<{ ok: true }>('/api/close-account', { confirm }),

  forgotPassword: (email: string) =>
    apiPost<{ ok: true; message: string; delivery: string }>('/api/auth/forgot', { email }),
  resetPassword: (token: string, password: string) =>
    apiPost<{ user: SessionUser }>('/api/auth/reset', { token, password }),

  invite: (token: string) =>
    apiGet<{ invite: { name: string; email: string; role: string; company: string } }>(
      `/api/auth/invite?token=${encodeURIComponent(token)}`),
  acceptInvite: (token: string, password: string) =>
    apiPost<{ user: SessionUser }>('/api/auth/join', { token, password }),
}
