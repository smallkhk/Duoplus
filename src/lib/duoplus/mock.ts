/**
 * Deterministic in-browser stand-in for the upstream cloud-phone OpenAPI.
 *
 * It answers the same paths with the same envelope as the real backend, so the
 * console can be demoed without credentials and switched to live traffic by
 * dropping an API key into Console → Automation → API.
 */
import type {
  AdbCommandResult, ApiEnvelope, AutomationTask, BatchResult, CloudDriveFile, CloudNumber,
  CloudPhone, CloudPhoneListRequest, InstalledApp, Paged, PhoneGroup, Proxy, SmsMessage,
  SubAccount, TeamMember, UsageBucket,
} from './types'
import { PhoneStatus } from './types'

/* Small seeded PRNG so every reload shows the same fleet. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260901)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min

const ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
const shortId = () => Array.from({ length: 5 }, () => ID_ALPHABET[Math.floor(rnd() * ID_ALPHABET.length)]).join('')

const REGIONS = [
  { region: 'us-west', area: 'United States', cc: 'US', flag: '🇺🇸' },
  { region: 'eu-central', area: 'Germany', cc: 'DE', flag: '🇩🇪' },
  { region: 'uk-south', area: 'United Kingdom', cc: 'GB', flag: '🇬🇧' },
  { region: 'sg-central', area: 'Singapore', cc: 'SG', flag: '🇸🇬' },
  { region: 'jp-east', area: 'Japan', cc: 'JP', flag: '🇯🇵' },
  { region: 'br-south', area: 'Brazil', cc: 'BR', flag: '🇧🇷' },
  { region: 'in-west', area: 'India', cc: 'IN', flag: '🇮🇳' },
  { region: 'ae-north', area: 'United Arab Emirates', cc: 'AE', flag: '🇦🇪' },
  { region: 'id-west', area: 'Indonesia', cc: 'ID', flag: '🇮🇩' },
  { region: 'ng-lagos', area: 'Nigeria', cc: 'NG', flag: '🇳🇬' },
]

export const REGION_INDEX = Object.fromEntries(REGIONS.map((r) => [r.region, r]))

const MODELS = [
  'Pixel 7 Pro', 'Galaxy S23 Ultra', 'Galaxy A54', 'Redmi Note 12',
  'Pixel 6a', 'OnePlus 11', 'Galaxy S22', 'Xiaomi 13T',
]
const OS_VERSIONS = ['Android 11', 'Android 12', 'Android 13', 'Android 14']
const OPERATORS = ['T-Mobile', 'Vodafone', 'Orange', 'Singtel', 'NTT Docomo', 'Vivo', 'Jio', 'Etisalat']
const TIMEZONES = ['America/Los_Angeles', 'Europe/Berlin', 'Europe/London', 'Asia/Singapore', 'Asia/Tokyo', 'America/Sao_Paulo']
const LANGS = ['en-US', 'de-DE', 'en-GB', 'en-SG', 'ja-JP', 'pt-BR']

export const GROUPS: PhoneGroup[] = [
  { id: '9JKzb', name: 'TikTok US', sort: 1000, remark: 'Creator accounts, west coast GPS' },
  { id: 'Qm4tR', name: 'TikTok Shop EU', sort: 990, remark: 'Affiliate storefronts' },
  { id: 'Lz7Yc', name: 'Instagram Growth', sort: 980, remark: '' },
  { id: 'Vd2Np', name: 'Airdrop Farm', sort: 970, remark: 'Wallets + testnet tasks' },
  { id: 'Hb8Kw', name: 'App QA — Release', sort: 960, remark: 'Regression matrix' },
  { id: 'Rt3Xs', name: 'Reseller · Northwind', sort: 950, remark: 'Sub-account fleet' },
  { id: 'Yp6Mv', name: 'Unassigned', sort: 0, remark: '' },
]

const TAGS = [
  { id: 'tg_warm', name: 'Warmed up' },
  { id: 'tg_new', name: 'New' },
  { id: 'tg_flag', name: 'Flagged' },
  { id: 'tg_prod', name: 'Production' },
  { id: 'tg_qa', name: 'QA' },
]
export const TAG_INDEX = Object.fromEntries(TAGS.map((t) => [t.id, t.name]))
export { TAGS }

export const PROXIES: Proxy[] = Array.from({ length: 14 }, (_, i) => {
  const r = REGIONS[i % REGIONS.length]
  const g = GROUPS[i % (GROUPS.length - 1)]
  return {
    id: `px_${8800 + i}`,
    name: `${r.cc}-Residential-${String(i + 1).padStart(2, '0')}`,
    host: `${int(23, 199)}.${int(2, 250)}.${int(2, 250)}.${int(2, 250)}`,
    port: String(int(3000, 9999)),
    user: `madova_${r.cc.toLowerCase()}${i + 1}`,
    area: r.cc,
    group_ids: [g.id],
    group_name: [g.name],
    protocol: pick(['socks5', 'http', 'https'] as const),
    latency_ms: int(28, 340),
    checked_at: '2026-09-01 08:12:44',
    healthy: rnd() > 0.15,
  }
})

const STATUS_POOL: PhoneStatus[] = [
  PhoneStatus.PoweredOn, PhoneStatus.PoweredOn, PhoneStatus.PoweredOn, PhoneStatus.PoweredOn,
  PhoneStatus.PoweredOff, PhoneStatus.PoweredOff, PhoneStatus.PoweredOff,
  PhoneStatus.PoweringOn, PhoneStatus.Configuring, PhoneStatus.NotConfigured,
  PhoneStatus.Expired, PhoneStatus.RenewalOverdue, PhoneStatus.ConfigurationFailed,
]

const NAME_PREFIX = ['TikTok', 'IG', 'FB', 'Shop', 'Farm', 'QA', 'Ads', 'Live']

/** Fixed "today" so the seeded fleet stays reproducible across reloads. */
const NOW = new Date('2026-09-01T09:00:00Z')

function makePhone(i: number): CloudPhone {
  const r = REGIONS[i % REGIONS.length]
  const group = GROUPS[i % (GROUPS.length - 1)]
  const status = STATUS_POOL[i % STATUS_POOL.length]
  const proxy = PROXIES[i % PROXIES.length]
  const created = new Date(Date.UTC(2026, 2 + (i % 5), 1 + (i % 27), 9 + (i % 12), (i * 7) % 60))
  /* Keep the expiry consistent with the status: lapsed phones expired in the past. */
  const lapsed = status === PhoneStatus.Expired || status === PhoneStatus.RenewalOverdue
  const expires = lapsed
    ? new Date(NOW.getTime() - (2 + (i % 21)) * 864e5)
    : new Date(NOW.getTime() + (9 + (i % 80)) * 864e5)
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
  return {
    id: shortId(),
    name: `${NAME_PREFIX[i % NAME_PREFIX.length]}-${r.cc}-${String(i + 1).padStart(3, '0')}`,
    status,
    os: OS_VERSIONS[i % OS_VERSIONS.length],
    size: `${(20 + rnd() * 40).toFixed(2)}G`,
    created_at: fmt(created),
    expired_at: fmt(expires),
    ip: proxy.host,
    area: r.area,
    remark: pick(['', '', 'creator account', 'do not reset', 'client: Northwind', 'warming']),
    adb: `adb.madova.net:${20100 + i}`,
    adb_password: rnd() > 0.6 ? shortId() + shortId() : '',
    group: [{ id: group.id, name: group.name }],
    http_status: rnd() > 0.7 ? 1 : 0,
    region: r.region,
    start_phone_type: int(1, 3),
    share_status: pick([0, 1, 2]),
    renewal_status: rnd() > 0.45 ? 1 : 0,
    proxy_id: proxy.id,
    tag_ids: rnd() > 0.4 ? [pick(TAGS).id] : [],
    device: {
      model: MODELS[i % MODELS.length],
      imei: String(35 + (i % 10)) + String(int(1e11, 9.9e11)).slice(0, 12),
      serialno: shortId().toUpperCase() + int(10000, 99999),
      android_id: Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join(''),
      gaid: `${shortId()}-${shortId()}-${shortId()}`.toLowerCase(),
      dpi_name: pick(['1080x1920 / 480dpi', '1440x3120 / 560dpi', '720x1600 / 320dpi']),
      timezone: TIMEZONES[i % TIMEZONES.length],
      language: LANGS[i % LANGS.length],
      longitude: (rnd() * 360 - 180).toFixed(4),
      latitude: (rnd() * 140 - 70).toFixed(4),
      sim_country: r.cc,
      sim_operator: OPERATORS[i % OPERATORS.length],
      wifi_name: pick(['HOME-5G', 'Xfinity-2244', 'TP-LINK_9C21', 'FRITZ!Box 7590']),
      bluetooth_name: `${MODELS[i % MODELS.length]}`,
    },
  }
}

export const PHONES: CloudPhone[] = Array.from({ length: 148 }, (_, i) => makePhone(i))

export const APPS: InstalledApp[] = [
  { package_name: 'com.zhiliaoapp.musically', name: 'TikTok', version: '34.5.4', size: '412M', installed_at: '2026-08-14 11:02:19' },
  { package_name: 'com.instagram.android', name: 'Instagram', version: '351.1.0', size: '298M', installed_at: '2026-08-14 11:04:51' },
  { package_name: 'com.facebook.katana', name: 'Facebook', version: '491.0.0', size: '344M', installed_at: '2026-08-02 09:41:03' },
  { package_name: 'com.whatsapp', name: 'WhatsApp', version: '2.26.8.72', size: '186M', installed_at: '2026-07-30 16:22:40' },
  { package_name: 'org.telegram.messenger', name: 'Telegram', version: '11.4.2', size: '92M', installed_at: '2026-07-30 16:24:12' },
  { package_name: 'com.google.android.gms', name: 'Google Play services', version: '25.30.11', size: '241M', installed_at: '2026-06-11 08:00:00' },
  { package_name: 'io.metamask', name: 'MetaMask', version: '7.44.0', size: '128M', installed_at: '2026-08-21 13:55:07' },
  { package_name: 'com.shopee.id', name: 'Shopee', version: '3.42.11', size: '204M', installed_at: '2026-08-25 10:14:33' },
]

export const CLOUD_NUMBERS: CloudNumber[] = Array.from({ length: 18 }, (_, i) => {
  const r = REGIONS[i % REGIONS.length]
  return {
    id: `cn_${5500 + i}`,
    msisdn: `+${int(1, 99)} ${int(200, 999)} ${int(100, 999)} ${int(1000, 9999)}`,
    country: r.cc,
    operator: OPERATORS[i % OPERATORS.length],
    bound_image_id: i % 3 === 0 ? null : PHONES[i]?.id ?? null,
    expired_at: '2026-11-30 23:59:59',
    status: i % 5 === 0 ? 0 : 1,
  }
})

export const SMS: SmsMessage[] = [
  { message: '[TikTok] 419283 is your verification code. Do not share it.', code: '419283', received_at: '2026-09-01 10:10:00' },
  { message: 'Instagram: 772104 is your login code.', code: '772104', received_at: '2026-09-01 09:41:22' },
  { message: 'Your WhatsApp code: 205-118. Tap to verify.', code: '205118', received_at: '2026-08-31 22:03:07' },
  { message: '[Shopee] Kode OTP anda 883921. Jangan bagikan.', code: '883921', received_at: '2026-08-31 18:55:41' },
  { message: 'Google verification code: 610455', code: '610455', received_at: '2026-08-31 12:19:03' },
]

export const TEAM: TeamMember[] = [
  { id: 'u_01', name: 'Amara Osei', email: 'amara@madova.io', role: 'Owner', phones: 148, last_active: '2 min ago', status: 'active' },
  { id: 'u_02', name: 'Dmitri Volkov', email: 'dmitri@madova.io', role: 'Admin', phones: 96, last_active: '18 min ago', status: 'active' },
  { id: 'u_03', name: 'Priya Raman', email: 'priya@madova.io', role: 'Operator', phones: 42, last_active: '1 hr ago', status: 'active' },
  { id: 'u_04', name: 'Tomás Ferreira', email: 'tomas@madova.io', role: 'Operator', phones: 31, last_active: 'Yesterday', status: 'active' },
  { id: 'u_05', name: 'Wei Chen', email: 'wei@madova.io', role: 'Viewer', phones: 0, last_active: '3 days ago', status: 'invited' },
  { id: 'u_06', name: 'Lena Hartmann', email: 'lena@madova.io', role: 'Operator', phones: 12, last_active: '2 weeks ago', status: 'suspended' },
]

export const SUB_ACCOUNTS: SubAccount[] = [
  { id: 'ra_1001', company: 'Northwind Media', contact: 'Jules Ardan', email: 'ops@northwind.media', plan: 'Scale', phones: 420, minutes_used: 184_200, minutes_quota: 240_000, mrr: 4180, margin: 0.38, status: 'active', since: '2025-04-11' },
  { id: 'ra_1002', company: 'Kite Social', contact: 'Bea Lindqvist', email: 'bea@kitesocial.se', plan: 'Growth', phones: 180, minutes_used: 71_400, minutes_quota: 90_000, mrr: 1620, margin: 0.41, status: 'active', since: '2025-08-02' },
  { id: 'ra_1003', company: 'Lagos Reach', contact: 'Chidi Nwosu', email: 'chidi@lagosreach.ng', plan: 'Scale', phones: 640, minutes_used: 302_900, minutes_quota: 320_000, mrr: 5940, margin: 0.35, status: 'active', since: '2024-11-19' },
  { id: 'ra_1004', company: 'Anda Commerce', contact: 'Rina Prakoso', email: 'rina@anda.co.id', plan: 'Starter', phones: 45, minutes_used: 12_050, minutes_quota: 20_000, mrr: 390, margin: 0.44, status: 'trial', since: '2026-08-14' },
  { id: 'ra_1005', company: 'Vertex Growth', contact: 'Sam Oyelaran', email: 'sam@vertexgrowth.io', plan: 'Growth', phones: 210, minutes_used: 88_300, minutes_quota: 90_000, mrr: 1890, margin: 0.4, status: 'past_due', since: '2025-02-27' },
  { id: 'ra_1006', company: 'Bluepeak Labs', contact: 'Hana Sato', email: 'hana@bluepeak.jp', plan: 'Scale', phones: 305, minutes_used: 140_100, minutes_quota: 180_000, mrr: 3120, margin: 0.37, status: 'active', since: '2025-06-30' },
  { id: 'ra_1007', company: 'Casa Digital', contact: 'Marta Ruiz', email: 'marta@casadigital.es', plan: 'Starter', phones: 30, minutes_used: 4_900, minutes_quota: 20_000, mrr: 260, margin: 0.46, status: 'churned', since: '2024-09-05' },
]

export const USAGE_30D: UsageBucket[] = Array.from({ length: 30 }, (_, i) => {
  const base = 22_000 + Math.sin(i / 3.4) * 5200 + i * 340
  return {
    label: `${i + 1}`,
    minutes: Math.round(base + rnd() * 2600),
    phones: Math.round(1580 + i * 11 + rnd() * 60),
    revenue: Math.round((base / 1000) * 41 + rnd() * 380),
  }
})

export const AUTOMATIONS: AutomationTask[] = [
  { id: 'at_01', name: 'Warm-up scroll · TikTok US', trigger: 'Every day 08:00 UTC', targets: 96, last_run: '5 hr ago', success_rate: 0.98, status: 'running' },
  { id: 'at_02', name: 'Rotate GPS + reskin', trigger: 'Weekly · Mon 02:00', targets: 148, last_run: '3 days ago', success_rate: 1, status: 'scheduled' },
  { id: 'at_03', name: 'Install release build', trigger: 'Webhook · CI green', targets: 24, last_run: '41 min ago', success_rate: 0.92, status: 'running' },
  { id: 'at_04', name: 'Harvest SMS codes', trigger: 'Every 5 min', targets: 18, last_run: '2 min ago', success_rate: 0.87, status: 'running' },
  { id: 'at_05', name: 'Nightly storage sweep', trigger: 'Every day 23:30 UTC', targets: 148, last_run: '11 hr ago', success_rate: 0.99, status: 'paused' },
  { id: 'at_06', name: 'Live stream relay · Shop EU', trigger: 'Manual', targets: 12, last_run: '2 days ago', success_rate: 0.64, status: 'failed' },
]

export const DRIVE_FILES: CloudDriveFile[] = [
  { id: 'fd_2291', name: 'tiktok-34.5.4.apk', kind: 'apk', size: '412 MB', uploaded_at: '2026-08-28 14:02', pushed_to: 96 },
  { id: 'fd_2292', name: 'creator-pack-sept.zip', kind: 'archive', size: '1.8 GB', uploaded_at: '2026-08-27 09:31', pushed_to: 42 },
  { id: 'fd_2293', name: 'promo-vertical-01.mp4', kind: 'video', size: '284 MB', uploaded_at: '2026-08-25 17:44', pushed_to: 128 },
  { id: 'fd_2294', name: 'avatars-batch-7.zip', kind: 'archive', size: '96 MB', uploaded_at: '2026-08-22 11:08', pushed_to: 148 },
  { id: 'fd_2295', name: 'internal-qa-build.apk', kind: 'apk', size: '78 MB', uploaded_at: '2026-08-21 08:15', pushed_to: 24 },
  { id: 'fd_2296', name: 'store-banner.png', kind: 'image', size: '2.4 MB', uploaded_at: '2026-08-19 19:53', pushed_to: 8 },
]

/* ------------------------------------------------------------------ *
 * Request routing — same paths and envelope as the upstream API.
 * ------------------------------------------------------------------ */

const ok = <T,>(data: T): ApiEnvelope<T> => ({ code: 200, data, message: 'Success' })

function paginate<T>(rows: T[], page = 1, pagesize = 10): Paged<T> {
  const total = rows.length
  const total_page = Math.max(1, Math.ceil(total / pagesize))
  const p = Math.min(Math.max(1, page), total_page)
  return { list: rows.slice((p - 1) * pagesize, p * pagesize), page: p, pagesize, total, total_page }
}

function filterPhones(req: CloudPhoneListRequest): CloudPhone[] {
  let rows = [...PHONES]
  const has = (arr?: string[]) => Array.isArray(arr) && arr.length > 0

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
    rows.sort((a, b) => (String(a[key]) > String(b[key]) ? dir : String(a[key]) < String(b[key]) ? -dir : 0))
  }
  return rows
}

/** Mutates the mock fleet so batch actions in the console feel real. */
function applyStatus(ids: string[], status: PhoneStatus): BatchResult {
  const result: BatchResult = { success: [], fail: [], fail_reason: {} }
  for (const id of ids.slice(0, 20)) {
    const phone = PHONES.find((p) => p.id === id)
    if (!phone) {
      result.fail.push(id)
      result.fail_reason[id] = 'Cloud phone not found'
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
  return result
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function mockRequest(path: string, body: Record<string, any>): Promise<ApiEnvelope<any>> {
  await delay(180 + Math.random() * 260)
  const page = Number(body.page) || 1

  switch (path) {
    case '/api/v1/cloudPhone/list': {
      const rows = filterPhones(body as CloudPhoneListRequest)
      return ok(paginate(rows, page, Math.min(Number(body.pagesize) || 10, 100)))
    }
    case '/api/v1/cloudPhone/groupList':
      return ok(paginate(GROUPS, page, 200))
    case '/api/v1/cloudPhone/batchPowerOn':
      return ok(applyStatus(body.image_ids ?? [], PhoneStatus.PoweredOn))
    case '/api/v1/cloudPhone/batchPowerOff':
      return ok(applyStatus(body.image_ids ?? [], PhoneStatus.PoweredOff))
    case '/api/v1/cloudPhone/batchRestart':
      return ok(applyStatus(body.image_ids ?? [], PhoneStatus.PoweringOn))
    case '/api/v1/cloudPhone/batchRoot':
      return ok(applyStatus(body.image_ids ?? [], PhoneStatus.PoweredOn))
    case '/api/v1/cloudPhone/update': {
      const images: any[] = body.images ?? []
      const result: BatchResult = { success: [], fail: [], fail_reason: {} }
      for (const img of images) {
        const phone = PHONES.find((p) => p.id === img.image_id)
        if (!phone) {
          result.fail.push(img.image_id)
          result.fail_reason[img.image_id] = 'Cloud phone not found'
          continue
        }
        if (img.name) phone.name = img.name
        if (img.remark !== undefined) phone.remark = img.remark
        if (img.dpi_name) phone.device.dpi_name = img.dpi_name
        if (img.gps?.longitude) phone.device.longitude = img.gps.longitude
        if (img.gps?.latitude) phone.device.latitude = img.gps.latitude
        if (img.locale?.timezone) phone.device.timezone = img.locale.timezone
        if (img.locale?.language) phone.device.language = img.locale.language
        if (img.device?.imei) phone.device.imei = img.device.imei
        result.success.push(img.image_id)
      }
      return ok(result)
    }
    case '/api/v1/cloudPhone/command': {
      const cmd: string = body.command ?? ''
      const run = (): AdbCommandResult => {
        if (!cmd.trim()) return { success: false, content: '', message: 'command is required' }
        if (cmd.startsWith('ls')) return { success: true, content: 'data\ntests\ntmp\ntraces\n', message: '' }
        if (cmd.includes('getprop ro.product.model')) return { success: true, content: 'Pixel 7 Pro\n', message: '' }
        if (cmd.includes('pm list packages')) {
          return { success: true, content: APPS.map((a) => `package:${a.package_name}`).join('\n') + '\n', message: '' }
        }
        if (cmd.startsWith('am ') || cmd.startsWith('input ')) return { success: true, content: '', message: '' }
        if (cmd.includes('wm size')) return { success: true, content: 'Physical size: 1080x1920\n', message: '' }
        return { success: true, content: `${cmd}: executed\n`, message: '' }
      }
      if (body.image_id) return ok(run())
      const ids: string[] = (body.image_ids ?? []).slice(0, 20)
      return ok(Object.fromEntries(ids.map((id) => [id, run()])))
    }
    case '/api/v1/cloudPhone/renewal': {
      const ids: string[] = body.image_ids ?? []
      for (const id of ids) {
        const phone = PHONES.find((p) => p.id === id)
        if (phone && (phone.status === PhoneStatus.Expired || phone.status === PhoneStatus.RenewalOverdue)) {
          phone.status = PhoneStatus.PoweredOff
        }
      }
      return ok({ order_id: `MDV-2026-${String(int(1000000, 9999999))}` })
    }
    case '/api/v1/proxy/list':
      return ok(paginate(PROXIES, page, Math.min(Number(body.pagesize) || 10, 100)))
    case '/api/v1/app/list':
      return ok(paginate(APPS, page, Number(body.pagesize) || 10))
    case '/api/v1/app/batchInstall':
    case '/api/v1/cloudDrive/push':
      return ok({ success: (body.image_ids ?? []).slice(0, 20), fail: [], fail_reason: {} })
    case '/api/v1/cloudNumber/smsList':
      return ok(paginate(SMS, page, Number(body.pagesize) || 10))
    default:
      return { code: 404, data: null, message: `Unknown endpoint: ${path}` }
  }
}
