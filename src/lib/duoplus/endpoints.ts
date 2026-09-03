/**
 * Catalogue of the upstream cloud-phone OpenAPI, used to render the MADOVA
 * developer reference and to drive the in-browser playground.
 *
 * `verified: false` marks an operation that exists in the upstream reference
 * but whose exact path we mirror by naming convention rather than from a
 * published spec — the reference page flags these so integrators confirm them
 * before shipping.
 */

export interface ApiParam {
  name: string
  type: 'string' | 'int' | 'array' | 'object' | 'bool'
  required: boolean
  desc: string
}

export interface ApiField {
  name: string
  type: string
  desc: string
}

export interface ApiEndpoint {
  id: string
  group: string
  name: string
  method: 'POST'
  path: string
  summary: string
  params: ApiParam[]
  fields: ApiField[]
  exampleRequest: Record<string, unknown>
  exampleResponse: unknown
  verified: boolean
  notes?: string[]
}

export const API_BASE_URL = 'https://openapi.duoplus.net'
export const API_KEY_HEADER = 'DuoPlus-API-Key'
export const API_QPS_LIMIT = 1

export const API_GROUPS = [
  'Cloud Phone',
  'Groups',
  'Proxy',
  'Application',
  'Cloud Drive',
  'Cloud Number',
  'Billing',
] as const

const pageParams: ApiParam[] = [
  { name: 'page', type: 'int', required: false, desc: 'Request page number. Defaults to the first page.' },
  { name: 'pagesize', type: 'int', required: false, desc: 'Items per page, max 100. Defaults to 10.' },
]

const pageFields: ApiField[] = [
  { name: 'data.page', type: 'int', desc: 'Current page' },
  { name: 'data.pagesize', type: 'int', desc: 'Items per page' },
  { name: 'data.total', type: 'int', desc: 'Total records' },
  { name: 'data.total_page', type: 'int', desc: 'Total pages' },
]

const batchFields: ApiField[] = [
  { name: 'data.success', type: 'array', desc: 'Cloud phone IDs the operation succeeded for' },
  { name: 'data.fail', type: 'array', desc: 'Cloud phone IDs the operation failed for' },
  { name: 'data.fail_reason', type: 'object', desc: 'Map of failed cloud phone ID to error message' },
]

const batchExampleResponse = {
  code: 200,
  data: { success: ['FnR9i'], fail: [], fail_reason: {} },
  message: 'Success',
}

export const ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'cloudphone-list',
    group: 'Cloud Phone',
    name: 'Cloud Phone List',
    method: 'POST',
    path: '/api/v1/cloudPhone/list',
    summary: 'Paginated list of every cloud phone on the account, with rich filtering and sorting.',
    verified: true,
    params: [
      { name: 'image_id', type: 'array', required: false, desc: 'Cloud phone IDs' },
      { name: 'name', type: 'string', required: false, desc: 'Name' },
      { name: 'group_id', type: 'string', required: false, desc: 'Group ID, can be obtained from the cloud phone group list' },
      { name: 'remark', type: 'string', required: false, desc: 'Remark' },
      { name: 'ips', type: 'array', required: false, desc: 'IPs' },
      { name: 'link_status', type: 'array', required: false, desc: 'Status: 0 Not configured; 1 Powered on; 2 Powered off; 3 Expired; 4 Renewal overdue; 10 Powering on; 11 Configuring; 12 Configuration failed' },
      { name: 'proxy_id', type: 'string', required: false, desc: 'Proxy ID, can be obtained from the proxy list' },
      { name: 'share_status', type: 'array', required: false, desc: 'Sharing status: 0 Not configured; 1 Shared; 2 Not shared' },
      { name: 'start_phone_type', type: 'array', required: false, desc: 'Startup mode: 1 Prioritize subscription startup; 2 Subscription startup; 3 Temporary startup' },
      { name: 'adb_status', type: 'array', required: false, desc: 'ADB: 0 Disabled; 1 Enabled' },
      { name: 'renewal_status', type: 'array', required: false, desc: 'Auto-renewal: 0 No; 1 Yes' },
      { name: 'sort_by', type: 'string', required: false, desc: 'Options: name, created_at, expired_at, os' },
      { name: 'order', type: 'string', required: false, desc: 'asc for ascending, desc for descending' },
      { name: 'user_ids', type: 'array', required: false, desc: 'Connected member IDs, from the connected member list' },
      { name: 'tag_ids', type: 'array', required: false, desc: 'Tag IDs, from the tag list' },
      { name: 'region_id', type: 'array', required: false, desc: 'OS IDs, from the cloud phone resource list' },
      ...pageParams,
    ],
    fields: [
      { name: 'data.list[].id', type: 'string', desc: 'Cloud phone ID' },
      { name: 'data.list[].name', type: 'string', desc: 'Cloud phone name' },
      { name: 'data.list[].status', type: 'int', desc: 'Status: 0 Not configured; 1 Powered on; 2 Powered off; 3 Expired; 4 Renewal overdue; 10 Powering on; 11 Configuring; 12 Configuration failed' },
      { name: 'data.list[].os', type: 'string', desc: 'Operating system' },
      { name: 'data.list[].size', type: 'string', desc: 'Storage size' },
      { name: 'data.list[].created_at', type: 'string', desc: 'Creation timestamp' },
      { name: 'data.list[].expired_at', type: 'string', desc: 'Expiration timestamp' },
      { name: 'data.list[].ip', type: 'string', desc: 'Cloud phone IP' },
      { name: 'data.list[].area', type: 'string', desc: 'Area' },
      { name: 'data.list[].remark', type: 'string', desc: 'Remark' },
      { name: 'data.list[].adb', type: 'string', desc: 'ADB address' },
      { name: 'data.list[].adb_password', type: 'string', desc: 'ADB password' },
      { name: 'data.list[].group', type: 'array', desc: 'Group information objects' },
      { name: 'data.list[].http_status', type: 'int', desc: 'Whether the HTTP service is enabled: 1 Yes; 0 No' },
      { name: 'data.list[].region', type: 'string', desc: 'Cloud phone region' },
      ...pageFields,
    ],
    exampleRequest: { page: 1, pagesize: 10, sort_by: 'created_at', order: 'desc' },
    exampleResponse: {
      code: 200,
      data: {
        list: [
          {
            id: '7Uw0M',
            name: 'TikTok-US-014',
            status: 1,
            os: 'Android 12',
            size: '30.08G',
            created_at: '2026-04-10 19:14:56',
            expired_at: '2026-06-10 19:14:56',
            ip: '104.28.61.19',
            area: 'US',
            remark: 'creator account',
            adb: '127.0.0.1:20100',
            adb_password: '',
            group: [{ id: '9JKzb', name: 'TikTok US' }],
            http_status: 0,
            region: 'us-west',
          },
        ],
        page: 1,
        pagesize: 10,
        total: 1,
        total_page: 1,
      },
      message: 'Success',
    },
  },
  {
    id: 'cloudphone-batch-power-on',
    group: 'Cloud Phone',
    name: 'Batch Power On',
    method: 'POST',
    path: '/api/v1/cloudPhone/powerOn',
    summary: 'Boot up to 20 cloud phones in a single call. Each phone begins consuming startup minutes when it reaches Powered on.',
    verified: false,
    notes: ['Up to 20 cloud phones per request.'],
    params: [{ name: 'image_ids', type: 'array', required: true, desc: 'Cloud phone IDs, max 20 per request' }],
    fields: batchFields,
    exampleRequest: { image_ids: ['7Uw0M', 'FnR9i'] },
    exampleResponse: batchExampleResponse,
  },
  {
    id: 'cloudphone-batch-power-off',
    group: 'Cloud Phone',
    name: 'Batch Power Off',
    method: 'POST',
    path: '/api/v1/cloudPhone/powerOff',
    summary: 'Shut down up to 20 cloud phones. Startup minutes stop accruing once a phone reaches Powered off.',
    verified: false,
    notes: ['Up to 20 cloud phones per request.'],
    params: [{ name: 'image_ids', type: 'array', required: true, desc: 'Cloud phone IDs, max 20 per request' }],
    fields: batchFields,
    exampleRequest: { image_ids: ['7Uw0M'] },
    exampleResponse: batchExampleResponse,
  },
  {
    id: 'cloudphone-batch-restart',
    group: 'Cloud Phone',
    name: 'Batch Restart',
    method: 'POST',
    path: '/api/v1/cloudPhone/restart',
    summary: 'Reboot up to 20 cloud phones without releasing their environment or storage.',
    verified: false,
    notes: ['Up to 20 cloud phones per request.'],
    params: [{ name: 'image_ids', type: 'array', required: true, desc: 'Cloud phone IDs, max 20 per request' }],
    fields: batchFields,
    exampleRequest: { image_ids: ['7Uw0M'] },
    exampleResponse: batchExampleResponse,
  },
  {
    id: 'cloudphone-update',
    group: 'Cloud Phone',
    name: 'Batch Modify Parameters',
    method: 'POST',
    path: '/api/v1/cloudPhone/update',
    summary: 'Rewrite the device fingerprint of one or more phones — IMEI, GPS, SIM, locale, Wi-Fi, Bluetooth and base station.',
    verified: true,
    notes: ['All optional parameters: if not provided, the corresponding parameter values will not be modified.'],
    params: [
      { name: 'images', type: 'array', required: true, desc: 'Array of cloud phone configuration objects' },
      { name: 'images[].image_id', type: 'string', required: true, desc: 'Cloud phone ID' },
      { name: 'images[].name', type: 'string', required: false, desc: 'Name' },
      { name: 'images[].dpi_name', type: 'string', required: false, desc: 'Resolution' },
      { name: 'images[].remark', type: 'string', required: false, desc: 'Remark' },
      { name: 'images[].proxy', type: 'object', required: false, desc: 'id (string), dns (int: 1 enabled, 2 disabled)' },
      { name: 'images[].gps', type: 'object', required: false, desc: 'type (int: 1 proxy-based, 2 custom), longitude, latitude' },
      { name: 'images[].locale', type: 'object', required: false, desc: 'type (int), timezone, language' },
      { name: 'images[].sim', type: 'object', required: false, desc: 'status, country, number_id, msisdn, operator, mcc, mnc, msin, iccid, imsi' },
      { name: 'images[].bluetooth', type: 'object', required: false, desc: 'name, address' },
      { name: 'images[].wifi', type: 'object', required: false, desc: 'status (1 on, 2 off), name, mac, bssid' },
      { name: 'images[].device', type: 'object', required: false, desc: 'imei, serialno, android_id, name, gsf_id, gaid' },
      { name: 'images[].station', type: 'object', required: false, desc: 'lac (int), cid (int)' },
    ],
    fields: batchFields,
    exampleRequest: {
      images: [
        {
          image_id: '7Uw0M',
          name: 'TikTok-US-014',
          gps: { type: 2, longitude: '-118.2437', latitude: '34.0522' },
          locale: { type: 2, timezone: 'America/Los_Angeles', language: 'en-US' },
        },
      ],
    },
    exampleResponse: batchExampleResponse,
  },
  {
    id: 'cloudphone-command',
    group: 'Cloud Phone',
    name: 'Execute ADB Command',
    method: 'POST',
    path: '/api/v1/cloudPhone/command',
    summary: 'Run a shell command on one or many phones. Supply either image_ids or image_id.',
    verified: true,
    notes: [
      'This interface only supports commands that can be executed within 10 seconds.',
      'For long-running work, append `> /dev/null 2>&1 &` to run it in the background.',
      'Supports up to 20 cloud phones per request.',
      'The `adb shell` prefix is not needed.',
    ],
    params: [
      { name: 'image_ids', type: 'array', required: false, desc: 'Cloud phone IDs. Required when image_id is not provided.' },
      { name: 'image_id', type: 'string', required: false, desc: 'Single cloud phone ID. Required when image_ids is not provided.' },
      { name: 'command', type: 'string', required: true, desc: 'Command to execute; the adb shell prefix is not needed.' },
    ],
    fields: [
      { name: 'data[imageId].success', type: 'bool', desc: 'Whether the command ran' },
      { name: 'data[imageId].content', type: 'string', desc: 'Standard output of the command' },
      { name: 'data[imageId].message', type: 'string', desc: 'Error information, empty on success' },
    ],
    exampleRequest: { image_ids: ['7Uw0M'], command: 'ls' },
    exampleResponse: {
      code: 200,
      data: { '7Uw0M': { success: true, content: 'data\ntests\ntmp\ntraces\n', message: '' } },
      message: 'Success',
    },
  },
  {
    id: 'cloudphone-batch-root',
    group: 'Cloud Phone',
    name: 'Batch Set Root',
    method: 'POST',
    path: '/api/v1/cloudPhone/batchRoot',
    summary: 'Grant or revoke root, globally or for a named set of packages.',
    verified: true,
    params: [
      { name: 'image_ids', type: 'array', required: true, desc: 'Cloud phone IDs' },
      { name: 'status', type: 'int', required: true, desc: 'Root switch: 1 Enable all; 2 Disable all; 3 Enable specified packages; 4 Disable specified packages' },
      { name: 'pkgs', type: 'array', required: false, desc: 'Package names. Required when status is 3 or 4.' },
    ],
    fields: batchFields,
    exampleRequest: { image_ids: ['7Uw0M'], status: 3, pkgs: ['com.zhiliaoapp.musically'] },
    exampleResponse: batchExampleResponse,
  },
  {
    id: 'cloudphone-renewal',
    group: 'Billing',
    name: 'Renew Cloud Phone',
    method: 'POST',
    path: '/api/v1/cloudPhone/renewal',
    summary: 'Extend the subscription on a set of phones and receive the resulting order number.',
    verified: true,
    params: [
      { name: 'image_ids', type: 'array', required: true, desc: 'Cloud phone IDs, from the cloud phone list' },
      { name: 'duration', type: 'string', required: true, desc: 'Subscription duration: 7 / 30 / 90 / 180 / 360 days. Defaults to 30.' },
      { name: 'coupon_code', type: 'string', required: false, desc: 'Coupon code for a discount' },
    ],
    fields: [{ name: 'data.order_id', type: 'string', desc: 'Generated order number' }],
    exampleRequest: { image_ids: ['7Uw0M', 'FnR9i'], duration: '90' },
    exampleResponse: { code: 200, data: { order_id: 'MDV-2026-0041882' }, message: 'Success' },
  },
  {
    id: 'cloudphone-grouplist',
    group: 'Groups',
    name: 'Cloud Phone Group List',
    method: 'POST',
    path: '/api/v1/cloudPhone/groupList',
    summary: 'List the groups phones can be organised into. Page size is fixed at 200.',
    verified: true,
    notes: ['Page size cannot be changed — it is fixed at 200 entries per page.'],
    params: [{ name: 'page', type: 'int', required: false, desc: 'Page number to request. Defaults to the first page.' }],
    fields: [
      { name: 'data.list[].id', type: 'string', desc: 'Group identifier' },
      { name: 'data.list[].name', type: 'string', desc: 'Group name' },
      { name: 'data.list[].sort', type: 'int', desc: 'Sort order value' },
      { name: 'data.list[].remark', type: 'string', desc: 'Group remark' },
      ...pageFields,
    ],
    exampleRequest: { page: 1 },
    exampleResponse: {
      code: 200,
      data: {
        list: [{ id: '9JKzb', name: 'TikTok US', sort: 1000, remark: '' }],
        page: 1,
        pagesize: 200,
        total: 1,
        total_page: 1,
      },
      message: 'Success',
    },
  },
  {
    id: 'proxy-list',
    group: 'Proxy',
    name: 'Proxy List',
    method: 'POST',
    path: '/api/v1/proxy/list',
    summary: 'List every proxy in the account together with the groups it is bound to.',
    verified: true,
    params: pageParams,
    fields: [
      { name: 'data.list[].id', type: 'string', desc: 'Proxy identifier' },
      { name: 'data.list[].name', type: 'string', desc: 'Proxy name' },
      { name: 'data.list[].host', type: 'string', desc: 'Host address' },
      { name: 'data.list[].port', type: 'string', desc: 'Port number' },
      { name: 'data.list[].user', type: 'string', desc: 'Account / username' },
      { name: 'data.list[].area', type: 'string', desc: 'Geographic region' },
      { name: 'data.list[].group_ids', type: 'array', desc: 'Associated group identifiers' },
      { name: 'data.list[].group_name', type: 'array', desc: 'Associated group names' },
      ...pageFields,
    ],
    exampleRequest: { page: 1, pagesize: 100 },
    exampleResponse: {
      code: 200,
      data: {
        list: [
          {
            id: 'px_8813',
            name: 'US-Residential-01',
            host: '104.28.61.19',
            port: '3001',
            user: 'madova_us1',
            area: 'US',
            group_ids: ['9JKzb'],
            group_name: ['TikTok US'],
          },
        ],
        page: 1,
        pagesize: 10,
        total: 1,
        total_page: 1,
      },
      message: 'Success',
    },
  },
  {
    id: 'app-list',
    group: 'Application',
    name: 'List Installed Apps',
    method: 'POST',
    path: '/api/v1/app/list',
    summary: 'Enumerate the packages installed on a phone.',
    verified: false,
    params: [{ name: 'image_id', type: 'string', required: true, desc: 'Cloud phone ID' }],
    fields: [
      { name: 'data.list[].package_name', type: 'string', desc: 'Android package name' },
      { name: 'data.list[].name', type: 'string', desc: 'Display name' },
      { name: 'data.list[].version', type: 'string', desc: 'Installed version' },
      { name: 'data.list[].size', type: 'string', desc: 'On-device size' },
    ],
    exampleRequest: { image_id: '7Uw0M' },
    exampleResponse: {
      code: 200,
      data: {
        list: [
          { package_name: 'com.zhiliaoapp.musically', name: 'TikTok', version: '34.5.4', size: '412M' },
        ],
        page: 1,
        pagesize: 10,
        total: 1,
        total_page: 1,
      },
      message: 'Success',
    },
  },
  {
    id: 'app-install',
    group: 'Application',
    name: 'Batch Install App',
    method: 'POST',
    path: '/api/v1/app/batchInstall',
    summary: 'Push an APK from the cloud drive onto a set of phones.',
    verified: false,
    params: [
      { name: 'image_ids', type: 'array', required: true, desc: 'Cloud phone IDs' },
      { name: 'file_id', type: 'string', required: true, desc: 'Cloud drive file ID of the APK' },
    ],
    fields: batchFields,
    exampleRequest: { image_ids: ['7Uw0M'], file_id: 'fd_2291' },
    exampleResponse: batchExampleResponse,
  },
  {
    id: 'drive-push',
    group: 'Cloud Drive',
    name: 'File Push',
    method: 'POST',
    path: '/api/v1/cloudDrive/push',
    summary: 'Copy a cloud drive file into the shared storage of the selected phones.',
    verified: false,
    params: [
      { name: 'image_ids', type: 'array', required: true, desc: 'Cloud phone IDs' },
      { name: 'file_id', type: 'string', required: true, desc: 'Cloud drive file ID' },
      { name: 'path', type: 'string', required: false, desc: 'Destination path on the device' },
    ],
    fields: batchFields,
    exampleRequest: { image_ids: ['7Uw0M'], file_id: 'fd_2291', path: '/sdcard/Download' },
    exampleResponse: batchExampleResponse,
  },
  {
    id: 'cloudnumber-smslist',
    group: 'Cloud Number',
    name: 'Cloud Number SMS',
    method: 'POST',
    path: '/api/v1/cloudNumber/smsList',
    summary: 'Read the SMS inbox of a cloud number, with the verification code already extracted.',
    verified: true,
    params: [
      { name: 'number_id', type: 'string', required: true, desc: 'Cloud phone number ID, from the cloud number list' },
      ...pageParams,
    ],
    fields: [
      { name: 'data.list[].message', type: 'string', desc: 'SMS content' },
      { name: 'data.list[].code', type: 'string', desc: 'Verification code extracted from the SMS' },
      { name: 'data.list[].received_at', type: 'string', desc: 'SMS time (GMT+08:00)' },
      ...pageFields,
    ],
    exampleRequest: { number_id: 'cn_5512', page: 1, pagesize: 50 },
    exampleResponse: {
      code: 200,
      data: {
        list: [
          { message: '[TikTok] 419283 is your verification code', code: '419283', received_at: '2026-03-20 10:10:00' },
        ],
        page: 1,
        pagesize: 10,
        total: 1,
        total_page: 1,
      },
      message: 'Success',
    },
  },
]

export const ERROR_CODES: { code: string; meaning: string; fix: string }[] = [
  { code: '200', meaning: 'Success', fix: 'The call completed. Batch endpoints can still report per-phone failures in data.fail.' },
  { code: '401', meaning: 'Unauthorized — re-login required', fix: `Check the ${API_KEY_HEADER} header. Keys are rotated from Console → Automation → API.` },
  { code: '403', meaning: 'Forbidden', fix: 'The key is valid but the account lacks the entitlement for this endpoint.' },
  { code: '429', meaning: 'Rate limited', fix: `Every endpoint is capped at ${API_QPS_LIMIT} QPS. Serialise calls and back off on 429.` },
  { code: '500', meaning: 'Upstream error', fix: 'Retry with jittered backoff. If it persists, open a ticket with the request ID.' },
]
