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
import { db, mutate, nowIso, shortId, type User } from './store.js'
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

export function phonesOf(userId: string): (CloudPhone & { owner_id: string })[] {
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
  let rows: CloudPhone[] = phonesOf(userId)
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

/** Apply a power transition, honouring the 20-per-call batch limit. */
function applyStatus(userId: string, ids: string[], status: PhoneStatus): BatchResult {
  const result: BatchResult = { success: [], fail: [], fail_reason: {} }
  mutate((d) => {
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

const DEMO_APPS: InstalledApp[] = [
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

function proxiesOf(userId: string): Proxy[] {
  /* Derived from the account's regions so the list always matches the fleet. */
  const regions = [...new Set(phonesOf(userId).map((p) => p.region))]
  return regions.map((region, i) => {
    const r = REGION_INDEX[region]
    const sample = phonesOf(userId).find((p) => p.region === region)
    return {
      id: `px_${region}`,
      name: `${r?.cc ?? '??'}-Residential-${String(i + 1).padStart(2, '0')}`,
      host: sample?.ip ?? '0.0.0.0',
      port: '3001',
      user: `madova_${(r?.cc ?? 'xx').toLowerCase()}${i + 1}`,
      area: r?.cc ?? '??',
      group_ids: [],
      group_name: [],
      protocol: 'socks5' as const,
      latency_ms: 40 + ((i * 37) % 260),
      checked_at: nowIso(),
      healthy: i % 7 !== 3,
    }
  })
}

function runCommand(command: string): AdbCommandResult {
  if (!command.trim()) return { success: false, content: '', message: 'command is required' }
  if (command.startsWith('ls')) return { success: true, content: 'data\ntests\ntmp\ntraces\n', message: '' }
  if (command.includes('getprop ro.product.model')) return { success: true, content: 'Pixel 7 Pro\n', message: '' }
  if (command.includes('pm list packages')) {
    return { success: true, content: DEMO_APPS.map((a) => `package:${a.package_name}`).join('\n') + '\n', message: '' }
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
      return ok(paginate(filterPhones(user.id, body as CloudPhoneListRequest), page, Math.min(Number(body.pagesize) || 10, 100)))

    case '/api/v1/cloudPhone/groupList':
      return ok(paginate(DEFAULT_GROUPS, page, 200))

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
      return ok(paginate(DEMO_APPS, page, Number(body.pagesize) || 10))

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
