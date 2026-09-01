/**
 * Presentational sample data for console screens that have no backend yet.
 *
 * Cloud phones, groups, proxies and orders are real: they come from the MADOVA
 * API server. Everything in this file — automation tasks, cloud drive files,
 * rented numbers, team members, sub-accounts, usage history — is illustrative,
 * and each screen using it says so.
 */
import type {
  AutomationTask, CloudDriveFile, CloudNumber, InstalledApp, PhoneGroup, SmsMessage,
  SubAccount, TeamMember, UsageBucket,
} from '@/lib/duoplus/types'

/** Region metadata, mirroring the regions the server provisions into. */
export const REGIONS = [
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

/** The group catalogue, matching the server's fixed set. */
export const GROUPS: PhoneGroup[] = [
  { id: '9JKzb', name: 'TikTok US', sort: 1000, remark: 'Creator accounts, west coast GPS' },
  { id: 'Qm4tR', name: 'TikTok Shop EU', sort: 990, remark: 'Affiliate storefronts' },
  { id: 'Lz7Yc', name: 'Instagram Growth', sort: 980, remark: '' },
  { id: 'Vd2Np', name: 'Airdrop Farm', sort: 970, remark: 'Wallets + testnet tasks' },
  { id: 'Hb8Kw', name: 'App QA — Release', sort: 960, remark: 'Regression matrix' },
  { id: 'Yp6Mv', name: 'Unassigned', sort: 0, remark: '' },
]

export const TAGS = [
  { id: 'tg_warm', name: 'Warmed up' },
  { id: 'tg_new', name: 'New' },
  { id: 'tg_flag', name: 'Flagged' },
  { id: 'tg_prod', name: 'Production' },
  { id: 'tg_qa', name: 'QA' },
]

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

const OPERATORS = ['T-Mobile', 'Vodafone', 'Orange', 'Singtel', 'NTT Docomo', 'Vivo', 'Jio', 'Etisalat']

/** `bound_index` selects which of the account's phones the number attaches to. */
export const CLOUD_NUMBERS: (CloudNumber & { bound_index: number | null })[] =
  Array.from({ length: 18 }, (_, i) => {
    const r = REGIONS[i % REGIONS.length]
    return {
      id: `cn_${5500 + i}`,
      msisdn: `+${(i % 60) + 1} ${300 + i * 7} ${100 + i * 3} ${1000 + i * 41}`,
      country: r.cc,
      operator: OPERATORS[i % OPERATORS.length],
      bound_image_id: null,
      bound_index: i % 3 === 0 ? null : i,
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
    minutes: Math.round(base + Math.abs(Math.cos(i * 1.7)) * 2600),
    phones: Math.round(1580 + i * 11),
    revenue: Math.round((base / 1000) * 41),
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
