/**
 * The device engine — the single source of truth for cloud phone state.
 *
 * Everything that controls a device goes through here: the console, the AI
 * assistant and the public API all call the same functions, so an action taken
 * in chat is the same action taken from the fleet table.
 *
 * When MADOVA_UPSTREAM_KEY is set, calls are forwarded to the real cloud phone
 * OpenAPI instead of the local engine. The key stays on the server; the browser
 * never sees it.
 */
import net from 'node:net'
import {
  db, mutate, nowIso, prefixedId, shortId,
  type Database, type Owned, type StoredPhone, type User,
} from './store.js'
import {
  PhoneStatus,
  type AdbCommandResult, type ApiEnvelope, type BatchResult, type CloudPhone,
  type CloudPhoneListRequest, type InstalledApp, type Paged, type PhoneGroup, type Proxy,
  type SmsMessage,
} from '../src/lib/duoplus/types.js'

export const UPSTREAM_BASE = process.env.MADOVA_UPSTREAM_BASE ?? 'https://openapi.duoplus.net'
export const UPSTREAM_KEY = process.env.MADOVA_UPSTREAM_KEY ?? ''
export const upstreamConfigured = () => UPSTREAM_KEY.trim().length > 0

export const REGIONS = [
  { region: 'us-west', area: 'United States', cc: 'US', flag: '🇺🇸', tz: 'America/Los_Angeles', lang: 'en-US', operator: 'T-Mobile' },
  { region: 'eu-central', area: 'Germany', cc: 'DE', flag: '🇩🇪', tz: 'Europe/Berlin', lang: 'de-DE', operator: 'Vodafone' },
  { region: 'uk-south', area: 'United Kingdom', cc: 'GB', flag: '🇬🇧', tz: 'Europe/London', lang: 'en-GB', operator: 'EE' },
  { region: 'sg-central', area: 'Singapore', cc: 'SG', flag: '🇸🇬', tz: 'Asia/Singapore', lang: 'en-SG', operator: 'Singtel' },
  { region: 'jp-east', area: 'Japan', cc: 'JP', flag: '🇯🇵', tz: 'Asia/Tokyo', lang: 'ja-JP', operator: 'NTT Docomo' },
  { region: 'br-south', area: 'Brazil', cc: 'BR', flag: '🇧🇷', tz: 'America/Sao_Paulo', lang: 'pt-BR', operator: 'Vivo' },
  { region: 'in-west', area: 'India', cc: 'IN', flag: '🇮🇳', tz: 'Asia/Kolkata', lang: 'en-IN', operator: 'Jio' },
  { region: 'ae-north', area: 'United Arab Emirates', cc: 'AE', flag: '🇦🇪', tz: 'Asia/Dubai', lang: 'ar-AE', operator: 'Etisalat' },
  { region: 'id-west', area: 'Indonesia', cc: 'ID', flag: '🇮🇩', tz: 'Asia/Jakarta', lang: 'id-ID', operator: 'Telkomsel' },
  { region: 'ng-lagos', area: 'Nigeria', cc: 'NG', flag: '🇳🇬', tz: 'Africa/Lagos', lang: 'en-NG', operator: 'MTN' },
]

export const REGION_INDEX = Object.fromEntries(REGIONS.map((r) => [r.region, r]))

export const OS_VERSIONS = ['Android 11', 'Android 12', 'Android 13', 'Android 14']

const MODELS = [
  'Pixel 7 Pro', 'Galaxy S23 Ultra', 'Galaxy A54', 'Redmi Note 12',
  'Pixel 6a', 'OnePlus 11', 'Galaxy S22', 'Xiaomi 13T',
]

export const DEFAULT_GROUPS: PhoneGroup[] = [
  { id: '9JKzb', name: 'TikTok US', sort: 1000, remark: 'Creator accounts, west coast GPS' },
  { id: 'Qm4tR', name: 'TikTok Shop EU', sort: 990, remark: 'Affiliate storefronts' },
  { id: 'Lz7Yc', name: 'Instagram Growth', sort: 980, remark: '' },
  { id: 'Vd2Np', name: 'Airdrop Farm', sort: 970, remark: 'Wallets + testnet tasks' },
  { id: 'Hb8Kw', name: 'App QA — Release', sort: 960, remark: 'Regression matrix' },
  { id: 'Yp6Mv', name: 'Unassigned', sort: 0, remark: '' },
]

/**
 * Groups, proxies and installed apps are per-account records. The defaults
 * above are seeded once, the first time an account looks at its groups, so an
 * account created before these were persisted still opens onto a sane fleet.
 */
export function groupsOf(userId: string): Owned<PhoneGroup>[] {
  const mine = db().groups.filter((g) => g.owner_id === userId)
  if (mine.length > 0) return mine.sort((a, b) => b.sort - a.sort)
  const seeded = DEFAULT_GROUPS.map((g) => ({ ...g, id: shortId(), owner_id: userId }))
  mutate((d) => d.groups.push(...seeded))
  return seeded.sort((a, b) => b.sort - a.sort)
}

export function groupById(userId: string, id: string): Owned<PhoneGroup> | undefined {
  return db().groups.find((g) => g.id === id && g.owner_id === userId)
}

export function createGroup(userId: string, input: { name: string; sort?: number; remark?: string }) {
  const name = input.name.trim()
  if (name.length < 2) throw new Error('Give the group a name of at least two characters.')
  if (groupsOf(userId).some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A group with that name already exists.')
  }
  const group: Owned<PhoneGroup> = {
    id: shortId(),
    owner_id: userId,
    name,
    sort: Number.isFinite(input.sort) ? Number(input.sort) : 1000,
    remark: (input.remark ?? '').trim(),
  }
  mutate((d) => d.groups.push(group))
  return group
}

export function updateGroup(userId: string, id: string, patch: { name?: string; sort?: number; remark?: string }) {
  const name = patch.name?.trim()
  if (name !== undefined && name.length < 2) throw new Error('Give the group a name of at least two characters.')
  if (name && groupsOf(userId).some((g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A group with that name already exists.')
  }
  return mutate((d) => {
    const group = d.groups.find((g) => g.id === id && g.owner_id === userId)
    if (!group) throw new Error('Group not found.')
    if (name) group.name = name
    if (patch.sort !== undefined && Number.isFinite(Number(patch.sort))) group.sort = Number(patch.sort)
    if (patch.remark !== undefined) group.remark = String(patch.remark).trim()
    /* Devices carry a denormalised copy of the name for the fleet table. */
    for (const phone of d.phones) {
      if (phone.owner_id !== userId) continue
      for (const ref of phone.group) if (ref.id === id) ref.name = group.name
    }
    return group
  })
}

/** Delete a group, moving anything inside it to the account's fallback group. */
export function deleteGroup(userId: string, id: string) {
  const groups = groupsOf(userId)
  if (groups.length <= 1) throw new Error('An account needs at least one group.')
  const fallback = groups.find((g) => g.id !== id && g.sort === 0) ?? groups.find((g) => g.id !== id)!
  return mutate((d) => {
    const at = d.groups.findIndex((g) => g.id === id && g.owner_id === userId)
    if (at < 0) throw new Error('Group not found.')
    d.groups.splice(at, 1)
    let moved = 0
    for (const phone of d.phones) {
      if (phone.owner_id !== userId) continue
      if (!phone.group.some((g) => g.id === id)) continue
      phone.group = [{ id: fallback.id, name: fallback.name }]
      moved++
    }
    for (const proxy of d.proxies) {
      if (proxy.owner_id !== userId) continue
      const at = proxy.group_ids.indexOf(id)
      if (at >= 0) { proxy.group_ids.splice(at, 1); proxy.group_name.splice(at, 1) }
    }
    return { moved, moved_to: fallback.name }
  })
}

/** Put a set of devices into a group. */
export function assignGroup(userId: string, phoneIds: string[], groupId: string): BatchResult {
  const group = groupById(userId, groupId)
  if (!group) throw new Error('Group not found.')
  const result: BatchResult = { success: [], fail: [], fail_reason: {} }
  mutate((d) => {
    for (const id of phoneIds) {
      const phone = d.phones.find((p) => p.id === id && p.owner_id === userId)
      if (!phone) {
        result.fail.push(id)
        result.fail_reason[id] = 'Cloud phone not found on this account'
        continue
      }
      phone.group = [{ id: group.id, name: group.name }]
      result.success.push(id)
    }
  })
  return result
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
const hex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[rand(0, 15)]).join('')

function fmt(d: Date) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/** Build one device with a coherent identity: region drives SIM, locale and GPS. */
export function buildPhone(opts: {
  ownerId: string
  index: number
  region?: string
  os?: string
  groupName?: string
  durationDays?: number
  namePrefix?: string
}): CloudPhone & { owner_id: string } {
  const r = REGION_INDEX[opts.region ?? ''] ?? pick(REGIONS)
  const group = DEFAULT_GROUPS.find((g) => g.name === opts.groupName) ?? DEFAULT_GROUPS[DEFAULT_GROUPS.length - 1]
  const created = new Date()
  const expires = new Date(created.getTime() + (opts.durationDays ?? 30) * 864e5)
  const model = pick(MODELS)
  const prefix = opts.namePrefix ?? 'Phone'

  return {
    owner_id: opts.ownerId,
    id: shortId(),
    name: `${prefix}-${r.cc}-${String(opts.index).padStart(3, '0')}`,
    status: PhoneStatus.PoweredOff,
    os: opts.os ?? pick(OS_VERSIONS),
    size: `${(20 + Math.random() * 40).toFixed(2)}G`,
    created_at: fmt(created),
    expired_at: fmt(expires),
    ip: `${rand(23, 199)}.${rand(2, 250)}.${rand(2, 250)}.${rand(2, 250)}`,
    area: r.area,
    remark: '',
    adb: `adb.madova.net:${rand(20100, 20999)}`,
    adb_password: '',
    group: [{ id: group.id, name: group.name }],
    http_status: 0,
    region: r.region,
    start_phone_type: 1,
    share_status: 2,
    renewal_status: 0,
    proxy_id: '',
    tag_ids: [],
    device: {
      model,
      imei: String(rand(35, 39)) + String(rand(100000000000, 999999999999)),
      serialno: shortId().toUpperCase() + rand(10000, 99999),
      android_id: hex(16),
      gaid: `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`,
      dpi_name: pick(['1080x1920 / 480dpi', '1440x3120 / 560dpi', '720x1600 / 320dpi']),
      timezone: r.tz,
      language: r.lang,
      longitude: (Math.random() * 360 - 180).toFixed(4),
      latitude: (Math.random() * 140 - 70).toFixed(4),
      sim_country: r.cc,
      sim_operator: r.operator,
      wifi_name: pick(['HOME-5G', 'Xfinity-2244', 'TP-LINK_9C21', 'FRITZ!Box 7590']),
      bluetooth_name: model,
    },
  }
}

export function phonesOf(userId: string): StoredPhone[] {
  return db().phones.filter((p) => p.owner_id === userId)
}

export function nextIndex(userId: string): number {
  return phonesOf(userId).length + 1
}

/** Provision devices onto an account. Used by checkout and by the assistant. */
export function provision(user: User, opts: {
  quantity: number
  region?: string
  os?: string
  groupName?: string
  durationDays?: number
  namePrefix?: string
}): CloudPhone[] {
  const quantity = Math.max(1, Math.min(500, Math.floor(opts.quantity)))
  const start = nextIndex(user.id)
  const created: (CloudPhone & { owner_id: string })[] = []
  for (let i = 0; i < quantity; i++) {
    created.push(buildPhone({ ...opts, ownerId: user.id, index: start + i }))
  }
  mutate((d) => d.phones.push(...created))
  return created
}

/* ------------------------------ local engine ----------------------------- */

const ok = <T,>(data: T): ApiEnvelope<T> => ({ code: 200, data, message: 'Success' })
const fail = (code: number, message: string): ApiEnvelope<null> => ({ code, data: null, message })

function paginate<T>(rows: T[], page = 1, pagesize = 10): Paged<T> {
  const total = rows.length
  const total_page = Math.max(1, Math.ceil(total / pagesize))
  const p = Math.min(Math.max(1, page), total_page)
  return { list: rows.slice((p - 1) * pagesize, p * pagesize), page: p, pagesize, total, total_page }
}

function filterPhones(userId: string, req: CloudPhoneListRequest): CloudPhone[] {
  /* Drop the store's own bookkeeping — callers get the device, not the row. */
  let rows: CloudPhone[] = phonesOf(userId).map(({ owner_id: _o, installed_apps: _i, removed_apps: _r, ...p }) => p)
  const has = (a?: string[]) => Array.isArray(a) && a.length > 0

  if (req.name) rows = rows.filter((p) => p.name.toLowerCase().includes(req.name!.toLowerCase()))
  if (req.remark) rows = rows.filter((p) => p.remark.toLowerCase().includes(req.remark!.toLowerCase()))
  if (req.group_id) rows = rows.filter((p) => p.group.some((g) => g.id === req.group_id))
  if (req.proxy_id) rows = rows.filter((p) => p.proxy_id === req.proxy_id)
  if (has(req.image_id)) rows = rows.filter((p) => req.image_id!.includes(p.id))
  if (has(req.ips)) rows = rows.filter((p) => req.ips!.includes(p.ip))
  if (has(req.link_status)) rows = rows.filter((p) => req.link_status!.includes(String(p.status)))
  if (has(req.share_status)) rows = rows.filter((p) => req.share_status!.includes(String(p.share_status)))
  if (has(req.start_phone_type)) rows = rows.filter((p) => req.start_phone_type!.includes(String(p.start_phone_type)))
  if (has(req.renewal_status)) rows = rows.filter((p) => req.renewal_status!.includes(String(p.renewal_status)))
  if (has(req.adb_status)) rows = rows.filter((p) => req.adb_status!.includes(p.adb_password ? '1' : '0'))
  if (has(req.region_id)) rows = rows.filter((p) => req.region_id!.includes(p.region))
  if (has(req.tag_ids)) rows = rows.filter((p) => p.tag_ids.some((t) => req.tag_ids!.includes(t)))

  const key = req.sort_by
  if (key) {
    const dir = req.order === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) =>
      String(a[key]) > String(b[key]) ? dir : String(a[key]) < String(b[key]) ? -dir : 0)
  }
  return rows
}

/* ------------------------------- metering -------------------------------- */

/**
 * Startup minutes are the unit customers buy, so they have to be measured
 * rather than assumed. A device accrues from the moment it is powered on; the
 * ledger is settled lazily — on power-off, and on every fleet read — so a
 * device that stays up for a month still shows day-by-day consumption.
 */
const MS_PER_MINUTE = 60_000

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function addUsage(d: Database, ownerId: string, at: number, minutes: number, boots: number) {
  if (minutes <= 0 && boots <= 0) return
  const date = dayKey(at)
  const row = d.usage.find((u) => u.owner_id === ownerId && u.date === date)
  if (row) {
    row.minutes += minutes
    row.boots += boots
  } else {
    d.usage.push({ owner_id: ownerId, date, minutes, boots })
  }
}

/**
 * Bring one device's meter up to `now`, spreading the elapsed time across the
 * days it covers so a long uptime does not land entirely on the day it ended.
 * Returns the minutes charged.
 */
function settlePhone(d: Database, phone: StoredPhone, now: number): number {
  if (!phone.metered_from) return 0
  let cursor = phone.metered_from
  let charged = 0

  while (cursor < now) {
    /* Midnight UTC after the cursor, or now — whichever comes first. */
    const midnight = Date.UTC(
      new Date(cursor).getUTCFullYear(),
      new Date(cursor).getUTCMonth(),
      new Date(cursor).getUTCDate() + 1,
    )
    const until = Math.min(midnight, now)
    const minutes = Math.floor((until - cursor) / MS_PER_MINUTE)
    if (minutes > 0) {
      addUsage(d, phone.owner_id, cursor, minutes, 0)
      charged += minutes
    }
    /* Keep the sub-minute remainder so nothing is lost to rounding. */
    cursor = minutes > 0 ? cursor + minutes * MS_PER_MINUTE : until
    if (until === now) break
  }

  phone.metered_from = cursor
  if (charged > 0) {
    const owner = d.users.find((u) => u.id === phone.owner_id)
    if (owner) owner.minutes_balance = Math.max(0, owner.minutes_balance - charged)
  }
  return charged
}

/**
 * Settle every running device on an account, and stop any that has run the
 * balance to zero — minutes are prepaid, so the fleet cannot run into debt.
 */
export function settleUsage(userId: string): { charged: number; stopped: string[] } {
  const now = Date.now()
  const running = db().phones.filter(
    (p) => p.owner_id === userId && p.metered_from !== undefined,
  )
  if (running.length === 0) return { charged: 0, stopped: [] }

  return mutate((d) => {
    let charged = 0
    const stopped: string[] = []
    for (const id of running.map((p) => p.id)) {
      const phone = d.phones.find((p) => p.id === id)
      if (!phone) continue
      charged += settlePhone(d, phone, now)
    }
    const owner = d.users.find((u) => u.id === userId)
    if (owner && owner.minutes_balance <= 0) {
      for (const phone of d.phones) {
        if (phone.owner_id !== userId || phone.metered_from === undefined) continue
        phone.metered_from = undefined
        phone.status = PhoneStatus.PoweredOff
        stopped.push(phone.id)
      }
    }
    return { charged, stopped }
  })
}

/** The account's daily consumption, oldest first, padded to `days` entries. */
export function usageSeries(userId: string, days: number): { date: string; minutes: number; boots: number }[] {
  settleUsage(userId)
  const rows = new Map(
    db().usage.filter((u) => u.owner_id === userId).map((u) => [u.date, u]),
  )
  const out: { date: string; minutes: number; boots: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(Date.now() - i * 864e5)
    const row = rows.get(date)
    out.push({ date, minutes: row?.minutes ?? 0, boots: row?.boots ?? 0 })
  }
  return out
}

/** Apply a power transition, honouring the 20-per-call batch limit. */
function applyStatus(userId: string, ids: string[], status: PhoneStatus): BatchResult {
  /* Charge for time already used before deciding whether there is balance left. */
  settleUsage(userId)

  const result: BatchResult = { success: [], fail: [], fail_reason: {} }
  const now = Date.now()
  const starting = status === PhoneStatus.PoweringOn

  mutate((d) => {
    const owner = d.users.find((u) => u.id === userId)
    for (const id of ids.slice(0, 20)) {
      const phone = d.phones.find((p) => p.id === id && p.owner_id === userId)
      if (!phone) {
        result.fail.push(id)
        result.fail_reason[id] = 'Cloud phone not found on this account'
        continue
      }
      if (phone.status === PhoneStatus.Expired || phone.status === PhoneStatus.RenewalOverdue) {
        result.fail.push(id)
        result.fail_reason[id] = 'Subscription expired — renew before starting'
        continue
      }
      if (starting && (owner?.minutes_balance ?? 0) <= 0) {
        result.fail.push(id)
        result.fail_reason[id] = 'No startup minutes left — top up on the billing page'
        continue
      }

      if (starting) {
        /* A restart closes the previous stretch and opens a new one. */
        settlePhone(d, phone, now)
        phone.metered_from = now
        addUsage(d, userId, now, 0, 1)
      } else {
        settlePhone(d, phone, now)
        phone.metered_from = undefined
      }

      phone.status = status
      result.success.push(id)
    }
  })

  /* Booting is asynchronous upstream; mirror that so the console shows the transition. */
  if (status === PhoneStatus.PoweringOn && result.success.length > 0) {
    const ids = [...result.success]
    setTimeout(() => {
      mutate((d) => {
        for (const id of ids) {
          const phone = d.phones.find((p) => p.id === id)
          if (phone && phone.status === PhoneStatus.PoweringOn) phone.status = PhoneStatus.PoweredOn
        }
      })
    }, 4000)
  }
  return result
}

/** Catalogue every phone starts with. Installs and removals are tracked per device. */
const BASE_APPS: InstalledApp[] = [
  { package_name: 'com.zhiliaoapp.musically', name: 'TikTok', version: '34.5.4', size: '412M', installed_at: '2026-08-14 11:02:19' },
  { package_name: 'com.instagram.android', name: 'Instagram', version: '351.1.0', size: '298M', installed_at: '2026-08-14 11:04:51' },
  { package_name: 'com.facebook.katana', name: 'Facebook', version: '491.0.0', size: '344M', installed_at: '2026-08-02 09:41:03' },
  { package_name: 'com.whatsapp', name: 'WhatsApp', version: '2.26.8.72', size: '186M', installed_at: '2026-07-30 16:22:40' },
  { package_name: 'org.telegram.messenger', name: 'Telegram', version: '11.4.2', size: '92M', installed_at: '2026-07-30 16:24:12' },
  { package_name: 'io.metamask', name: 'MetaMask', version: '7.44.0', size: '128M', installed_at: '2026-08-21 13:55:07' },
]

const DEMO_SMS: SmsMessage[] = [
  { message: '[TikTok] 419283 is your verification code. Do not share it.', code: '419283', received_at: '2026-09-01 10:10:00' },
  { message: 'Instagram: 772104 is your login code.', code: '772104', received_at: '2026-09-01 09:41:22' },
  { message: 'Your WhatsApp code: 205-118. Tap to verify.', code: '205118', received_at: '2026-08-31 22:03:07' },
]

/* ------------------------------- proxies --------------------------------- */

const PROTOCOLS = new Set(['socks5', 'http', 'https'])

export function proxiesOf(userId: string): Owned<Proxy>[] {
  return db().proxies.filter((p) => p.owner_id === userId)
}

export interface ProxyInput {
  name?: string
  host: string
  port: string | number
  user?: string
  password?: string
  protocol?: string
  area?: string
  group_ids?: string[]
}

/** Validate one proxy row, returning the record to store or the reason it failed. */
function buildProxy(userId: string, input: ProxyInput): Owned<Proxy> {
  const host = String(input.host ?? '').trim()
  const port = String(input.port ?? '').trim()
  if (!host) throw new Error('A proxy needs a host.')
  /* Hostname or IPv4 — anything else would fail silently at connect time. */
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)) throw new Error(`"${host}" is not a valid host.`)
  const portNum = Number(port)
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) throw new Error(`"${port}" is not a valid port.`)

  const protocol = String(input.protocol ?? 'socks5').toLowerCase()
  if (!PROTOCOLS.has(protocol)) throw new Error(`"${input.protocol}" is not a supported protocol.`)

  const groupIds = (input.group_ids ?? []).filter((id) => groupById(userId, id))
  return {
    id: prefixedId('px'),
    owner_id: userId,
    name: String(input.name ?? '').trim() || `${host}:${portNum}`,
    host,
    port: String(portNum),
    user: String(input.user ?? '').trim(),
    area: String(input.area ?? '').trim().toUpperCase().slice(0, 2) || '??',
    group_ids: groupIds,
    group_name: groupIds.map((id) => groupById(userId, id)!.name),
    protocol: protocol as Proxy['protocol'],
    latency_ms: 0,
    checked_at: nowIso(),
    healthy: false,
  }
}

export function createProxy(userId: string, input: ProxyInput): Owned<Proxy> {
  const proxy = buildProxy(userId, input)
  if (proxiesOf(userId).some((p) => p.host === proxy.host && p.port === proxy.port && p.user === proxy.user)) {
    throw new Error('That proxy is already on the account.')
  }
  mutate((d) => d.proxies.push(proxy))
  return proxy
}

export interface ImportResult {
  added: Owned<Proxy>[]
  skipped: { line: string; reason: string }[]
}

/**
 * Bulk import from pasted text. One proxy per line, in the shape most vendors
 * hand out: `host:port`, `host:port:user:pass`, or a full `scheme://` URL.
 */
export function importProxies(userId: string, text: string, groupIds: string[] = []): ImportResult {
  const result: ImportResult = { added: [], skipped: [] }
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) throw new Error('Paste at least one proxy.')
  if (lines.length > 500) throw new Error('Import up to 500 proxies at a time.')

  for (const line of lines) {
    try {
      result.added.push(createProxy(userId, { ...parseProxyLine(line), group_ids: groupIds }))
    } catch (err) {
      result.skipped.push({ line, reason: err instanceof Error ? err.message : 'Could not parse' })
    }
  }
  return result
}

function parseProxyLine(line: string): ProxyInput {
  if (line.includes('://')) {
    const url = new URL(line)
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    }
  }
  const parts = line.split(':')
  if (parts.length === 2) return { host: parts[0], port: parts[1] }
  if (parts.length === 4) return { host: parts[0], port: parts[1], user: parts[2], password: parts[3] }
  throw new Error('Expected host:port, host:port:user:pass, or a scheme:// URL')
}

export function deleteProxy(userId: string, id: string) {
  return mutate((d) => {
    const at = d.proxies.findIndex((p) => p.id === id && p.owner_id === userId)
    if (at < 0) throw new Error('Proxy not found.')
    d.proxies.splice(at, 1)
    let detached = 0
    for (const phone of d.phones) {
      if (phone.owner_id === userId && phone.proxy_id === id) { phone.proxy_id = ''; detached++ }
    }
    return { detached }
  })
}

/**
 * Check a proxy by opening a TCP connection to it and timing the handshake.
 * That is the honest test available without routing traffic through it: it
 * proves the endpoint accepts connections, and nothing more.
 */
export async function checkProxy(userId: string, id: string): Promise<Owned<Proxy>> {
  const proxy = proxiesOf(userId).find((p) => p.id === id)
  if (!proxy) throw new Error('Proxy not found.')

  const started = Date.now()
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket()
    const done = (ok: boolean) => { socket.destroy(); resolve(ok) }
    socket.setTimeout(6000)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(Number(proxy.port), proxy.host)
  })

  return mutate((d) => {
    const row = d.proxies.find((p) => p.id === id && p.owner_id === userId)!
    row.healthy = reachable
    row.latency_ms = reachable ? Date.now() - started : 0
    row.checked_at = nowIso()
    return row
  })
}

/** Point devices at a proxy, or at none when proxyId is empty. */
export function bindProxy(userId: string, phoneIds: string[], proxyId: string): BatchResult {
  if (proxyId && !proxiesOf(userId).some((p) => p.id === proxyId)) throw new Error('Proxy not found.')
  const result: BatchResult = { success: [], fail: [], fail_reason: {} }
  mutate((d) => {
    for (const id of phoneIds) {
      const phone = d.phones.find((p) => p.id === id && p.owner_id === userId)
      if (!phone) {
        result.fail.push(id)
        result.fail_reason[id] = 'Cloud phone not found on this account'
        continue
      }
      phone.proxy_id = proxyId
      result.success.push(id)
    }
  })
  return result
}

/**
 * Apps are a property of a device, not of the account. A phone that has never
 * been touched reports the base image; anything installed or removed since is
 * recorded on the phone itself.
 */
function appsOfPhone(phone: StoredPhone): InstalledApp[] {
  const removed = new Set(phone.removed_apps ?? [])
  const extra = phone.installed_apps ?? []
  return [...BASE_APPS.filter((a) => !removed.has(a.package_name)), ...extra]
}

/** Apps present on at least one device, with the count of devices carrying each. */
export function appsOf(userId: string): (InstalledApp & { devices: number })[] {
  const tally = new Map<string, InstalledApp & { devices: number }>()
  for (const phone of phonesOf(userId)) {
    for (const app of appsOfPhone(phone)) {
      const seen = tally.get(app.package_name)
      if (seen) seen.devices++
      else tally.set(app.package_name, { ...app, devices: 1 })
    }
  }
  return [...tally.values()].sort((a, b) => b.devices - a.devices)
}

export function installApp(userId: string, phoneIds: string[], app: InstalledApp): BatchResult {
  const result: BatchResult = { success: [], fail: [], fail_reason: {} }
  mutate((d) => {
    for (const id of phoneIds.slice(0, 20)) {
      const phone = d.phones.find((p) => p.id === id && p.owner_id === userId)
      if (!phone) {
        result.fail.push(id)
        result.fail_reason[id] = 'Cloud phone not found on this account'
        continue
      }
      phone.removed_apps = (phone.removed_apps ?? []).filter((pkg) => pkg !== app.package_name)
      phone.installed_apps = [
        ...(phone.installed_apps ?? []).filter((a) => a.package_name !== app.package_name),
      ]
      if (!BASE_APPS.some((a) => a.package_name === app.package_name)) phone.installed_apps.push(app)
      result.success.push(id)
    }
  })
  return result
}

export function uninstallApp(userId: string, packageName: string, phoneIds?: string[]): BatchResult {
  const targets = phoneIds?.length
    ? phoneIds
    : phonesOf(userId).filter((p) => appsOfPhone(p).some((a) => a.package_name === packageName)).map((p) => p.id)
  const result: BatchResult = { success: [], fail: [], fail_reason: {} }
  mutate((d) => {
    for (const id of targets) {
      const phone = d.phones.find((p) => p.id === id && p.owner_id === userId)
      if (!phone) {
        result.fail.push(id)
        result.fail_reason[id] = 'Cloud phone not found on this account'
        continue
      }
      phone.installed_apps = (phone.installed_apps ?? []).filter((a) => a.package_name !== packageName)
      if (BASE_APPS.some((a) => a.package_name === packageName)) {
        phone.removed_apps = [...new Set([...(phone.removed_apps ?? []), packageName])]
      }
      result.success.push(id)
    }
  })
  return result
}

function runCommand(command: string): AdbCommandResult {
  if (!command.trim()) return { success: false, content: '', message: 'command is required' }
  if (command.startsWith('ls')) return { success: true, content: 'data\ntests\ntmp\ntraces\n', message: '' }
  if (command.includes('getprop ro.product.model')) return { success: true, content: 'Pixel 7 Pro\n', message: '' }
  if (command.includes('pm list packages')) {
    return { success: true, content: BASE_APPS.map((a) => `package:${a.package_name}`).join('\n') + '\n', message: '' }
  }
  if (command.includes('wm size')) return { success: true, content: 'Physical size: 1080x1920\n', message: '' }
  if (command.startsWith('am ') || command.startsWith('input ')) return { success: true, content: '', message: '' }
  return { success: true, content: `${command}: executed\n`, message: '' }
}

/** Serve one API call from the local engine, scoped to a single account. */
export function localCall(user: User, path: string, body: Record<string, any>): ApiEnvelope<any> {
  const page = Number(body.page) || 1
  const ids: string[] = Array.isArray(body.image_ids) ? body.image_ids : []

  switch (path) {
    case '/api/v1/cloudPhone/list':
      /* Reading the fleet is the moment to bring the meter up to date. */
      settleUsage(user.id)
      return ok(paginate(filterPhones(user.id, body as CloudPhoneListRequest), page, Math.min(Number(body.pagesize) || 10, 100)))

    case '/api/v1/cloudPhone/groupList':
      return ok(paginate(groupsOf(user.id), page, 200))

    case '/api/v1/cloudPhone/batchPowerOn':
      return ok(applyStatus(user.id, ids, PhoneStatus.PoweringOn))

    case '/api/v1/cloudPhone/batchPowerOff':
      return ok(applyStatus(user.id, ids, PhoneStatus.PoweredOff))

    case '/api/v1/cloudPhone/batchRestart':
      return ok(applyStatus(user.id, ids, PhoneStatus.PoweringOn))

    case '/api/v1/cloudPhone/batchRoot':
      return ok({ success: ids.slice(0, 20), fail: [], fail_reason: {} } satisfies BatchResult)

    case '/api/v1/cloudPhone/update': {
      const images: any[] = body.images ?? []
      const result: BatchResult = { success: [], fail: [], fail_reason: {} }
      mutate((d) => {
        for (const img of images) {
          const phone = d.phones.find((p) => p.id === img.image_id && p.owner_id === user.id)
          if (!phone) {
            result.fail.push(img.image_id)
            result.fail_reason[img.image_id] = 'Cloud phone not found on this account'
            continue
          }
          if (img.name) phone.name = String(img.name)
          if (img.remark !== undefined) phone.remark = String(img.remark)
          if (img.dpi_name) phone.device.dpi_name = String(img.dpi_name)
          if (img.gps?.longitude) phone.device.longitude = String(img.gps.longitude)
          if (img.gps?.latitude) phone.device.latitude = String(img.gps.latitude)
          if (img.locale?.timezone) phone.device.timezone = String(img.locale.timezone)
          if (img.locale?.language) phone.device.language = String(img.locale.language)
          if (img.device?.imei) phone.device.imei = String(img.device.imei)
          if (img.sim?.operator) phone.device.sim_operator = String(img.sim.operator)
          result.success.push(img.image_id)
        }
      })
      return ok(result)
    }

    case '/api/v1/cloudPhone/command': {
      const command: string = body.command ?? ''
      const owned = (id: string) => phonesOf(user.id).some((p) => p.id === id)
      if (body.image_id) {
        if (!owned(body.image_id)) return fail(403, 'Cloud phone not found on this account')
        return ok(runCommand(command))
      }
      const targets = ids.slice(0, 20).filter(owned)
      return ok(Object.fromEntries(targets.map((id) => [id, runCommand(command)])))
    }

    case '/api/v1/cloudPhone/renewal': {
      const duration = Number(body.duration ?? 30)
      mutate((d) => {
        for (const id of ids) {
          const phone = d.phones.find((p) => p.id === id && p.owner_id === user.id)
          if (!phone) continue
          const base = new Date(phone.expired_at.replace(' ', 'T') + 'Z')
          const from = base.getTime() > Date.now() ? base : new Date()
          phone.expired_at = fmt(new Date(from.getTime() + duration * 864e5))
          if (phone.status === PhoneStatus.Expired || phone.status === PhoneStatus.RenewalOverdue) {
            phone.status = PhoneStatus.PoweredOff
          }
        }
      })
      return ok({ order_id: `MDV-${new Date().getFullYear()}-${String(rand(1000000, 9999999))}` })
    }

    case '/api/v1/proxy/list':
      return ok(paginate(proxiesOf(user.id), page, Math.min(Number(body.pagesize) || 10, 100)))

    case '/api/v1/app/list':
      return ok(paginate(appsOf(user.id), page, Number(body.pagesize) || 10))

    case '/api/v1/app/batchInstall':
    case '/api/v1/cloudDrive/push':
      return ok({ success: ids.slice(0, 20), fail: [], fail_reason: {} } satisfies BatchResult)

    case '/api/v1/cloudNumber/smsList':
      return ok(paginate(DEMO_SMS, page, Number(body.pagesize) || 10))

    default:
      return fail(404, `Unknown endpoint: ${path}`)
  }
}

/** Forward a call to the real upstream API with the server-held key. */
async function upstreamCall(path: string, body: Record<string, any>, lang: string): Promise<ApiEnvelope<any>> {
  const res = await fetch(`${UPSTREAM_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Lang: lang,
      'DuoPlus-API-Key': UPSTREAM_KEY,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as ApiEnvelope<any>
  } catch {
    return fail(res.status || 502, `Upstream returned a non-JSON response: ${text.slice(0, 180)}`)
  }
}

/**
 * Upstream rate-limits every endpoint to 1 QPS, so forwarded calls are
 * serialised through one chain with a minimum spacing.
 */
const MIN_SPACING_MS = 1100
let chain: Promise<unknown> = Promise.resolve()

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task)
  chain = next.then(
    () => new Promise((r) => setTimeout(r, MIN_SPACING_MS)),
    () => new Promise((r) => setTimeout(r, MIN_SPACING_MS)),
  )
  return next
}

export const ALLOWED_PATHS = new Set([
  '/api/v1/cloudPhone/list',
  '/api/v1/cloudPhone/groupList',
  '/api/v1/cloudPhone/batchPowerOn',
  '/api/v1/cloudPhone/batchPowerOff',
  '/api/v1/cloudPhone/batchRestart',
  '/api/v1/cloudPhone/batchRoot',
  '/api/v1/cloudPhone/update',
  '/api/v1/cloudPhone/command',
  '/api/v1/cloudPhone/renewal',
  '/api/v1/proxy/list',
  '/api/v1/app/list',
  '/api/v1/app/batchInstall',
  '/api/v1/cloudDrive/push',
  '/api/v1/cloudNumber/smsList',
])

/** The one entry point every caller uses. */
export async function cloudCall(
  user: User,
  path: string,
  body: Record<string, any>,
  lang = 'en',
): Promise<ApiEnvelope<any>> {
  if (!ALLOWED_PATHS.has(path)) return fail(404, `Unknown endpoint: ${path}`)
  if (upstreamConfigured()) return serialise(() => upstreamCall(path, body, lang))
  return localCall(user, path, body)
}
