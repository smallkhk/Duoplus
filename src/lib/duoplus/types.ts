/**
 * Types for the upstream cloud-phone OpenAPI that MADOVA resells.
 *
 * Every call is `POST {base}/api/v1/...` with a JSON body, authenticated with
 * a `DuoPlus-API-Key` request header. Responses always use the same envelope:
 *
 *   { code: 200, data: <payload>, message: "Success" }
 *
 * `code` is 200 on success and 401 when the key is rejected. Upstream rate
 * limits every endpoint to 1 QPS.
 */

export interface ApiEnvelope<T> {
  code: number
  data: T
  message: string
}

export interface Paged<T> {
  list: T[]
  page: number
  pagesize: number
  total: number
  total_page: number
}

/** Cloud phone lifecycle state, as returned by `/api/v1/cloudPhone/list`. */
export enum PhoneStatus {
  NotConfigured = 0,
  PoweredOn = 1,
  PoweredOff = 2,
  Expired = 3,
  RenewalOverdue = 4,
  PoweringOn = 10,
  Configuring = 11,
  ConfigurationFailed = 12,
}

export const PHONE_STATUS_LABEL: Record<number, string> = {
  0: 'Not configured',
  1: 'Powered on',
  2: 'Powered off',
  3: 'Expired',
  4: 'Renewal overdue',
  10: 'Powering on',
  11: 'Configuring',
  12: 'Configuration failed',
}

/** Startup mode — how a phone consumes minutes when it boots. */
export const START_PHONE_TYPE_LABEL: Record<number, string> = {
  1: 'Prioritize subscription startup',
  2: 'Subscription startup',
  3: 'Temporary startup',
}

export interface PhoneGroupRef {
  id: string
  name: string
}

export interface CloudPhone {
  id: string
  name: string
  status: PhoneStatus
  os: string
  size: string
  created_at: string
  expired_at: string
  ip: string
  area: string
  remark: string
  adb: string
  adb_password: string
  group: PhoneGroupRef[]
  http_status: number
  region: string
  /* Fields MADOVA carries alongside the upstream payload for the console UI. */
  start_phone_type: number
  share_status: number
  renewal_status: number
  proxy_id: string
  tag_ids: string[]
  device: DeviceFingerprint
}

export interface DeviceFingerprint {
  model: string
  imei: string
  serialno: string
  android_id: string
  gaid: string
  dpi_name: string
  timezone: string
  language: string
  longitude: string
  latitude: string
  sim_country: string
  sim_operator: string
  wifi_name: string
  bluetooth_name: string
}

export interface CloudPhoneListRequest {
  image_id?: string[]
  name?: string
  group_id?: string
  remark?: string
  ips?: string[]
  link_status?: string[]
  proxy_id?: string
  share_status?: string[]
  start_phone_type?: string[]
  adb_status?: string[]
  renewal_status?: string[]
  sort_by?: 'name' | 'created_at' | 'expired_at' | 'os'
  order?: 'asc' | 'desc'
  user_ids?: string[]
  tag_ids?: string[]
  region_id?: string[]
  page?: number
  pagesize?: number
}

export interface PhoneGroup {
  id: string
  name: string
  sort: number
  remark: string
}

export interface Proxy {
  id: string
  name: string
  host: string
  port: string
  user: string
  area: string
  group_ids: string[]
  group_name: string[]
  /* MADOVA console extras */
  protocol: 'socks5' | 'http' | 'https'
  latency_ms: number
  checked_at: string
  healthy: boolean
}

/** Shape returned by batch endpoints such as `/api/v1/cloudPhone/update`. */
export interface BatchResult {
  success: string[]
  fail: string[]
  fail_reason: Record<string, string>
}

export interface AdbCommandResult {
  success: boolean
  content: string
  message: string
}

export interface InstalledApp {
  package_name: string
  name: string
  version: string
  size: string
  installed_at: string
}

export interface CloudNumber {
  id: string
  msisdn: string
  country: string
  operator: string
  bound_image_id: string | null
  expired_at: string
  status: number
}

export interface SmsMessage {
  message: string
  code: string
  received_at: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'Owner' | 'Admin' | 'Operator' | 'Viewer'
  phones: number
  last_active: string
  status: 'active' | 'invited' | 'suspended'
}

/** Reseller-side records — MADOVA's own layer on top of the upstream API. */
export interface SubAccount {
  id: string
  company: string
  contact: string
  email: string
  plan: string
  phones: number
  minutes_used: number
  minutes_quota: number
  mrr: number
  margin: number
  status: 'active' | 'trial' | 'past_due' | 'churned'
  since: string
}

export interface UsageBucket {
  label: string
  minutes: number
  phones: number
  revenue: number
}

export interface AutomationTask {
  id: string
  name: string
  trigger: string
  targets: number
  last_run: string
  success_rate: number
  status: 'running' | 'scheduled' | 'paused' | 'failed'
}

export interface CloudDriveFile {
  id: string
  name: string
  kind: 'apk' | 'image' | 'video' | 'archive' | 'other'
  size: string
  uploaded_at: string
  pushed_to: number
}
