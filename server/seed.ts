/**
 * First-boot seed.
 *
 * Creates a demo account with a populated fleet so the console has something to
 * show before anyone signs up. Real accounts start from the free trial instead:
 * one device, 30 minutes.
 */
import { buildPhone, DEFAULT_GROUPS, REGIONS } from './fleet.js'
import { createUser } from './auth.js'
import { db, findUserByEmail, mutate, nowIso, prefixedId, type User } from './store.js'
import { PhoneStatus } from '../src/lib/duoplus/types.js'

export const DEMO_EMAIL = 'demo@madova.io'
export const DEMO_PASSWORD = 'madova-demo-2026'

const NAME_PREFIX = ['TikTok', 'IG', 'FB', 'Shop', 'Farm', 'QA', 'Ads', 'Live']

const STATUS_POOL: PhoneStatus[] = [
  PhoneStatus.PoweredOn, PhoneStatus.PoweredOn, PhoneStatus.PoweredOn, PhoneStatus.PoweredOn,
  PhoneStatus.PoweredOff, PhoneStatus.PoweredOff, PhoneStatus.PoweredOff,
  PhoneStatus.PoweringOn, PhoneStatus.Configuring, PhoneStatus.NotConfigured,
  PhoneStatus.Expired, PhoneStatus.RenewalOverdue, PhoneStatus.ConfigurationFailed,
]

/** Give a new account its free trial device. */
export function grantTrialPhone(user: User) {
  const phone = buildPhone({
    ownerId: user.id,
    index: 1,
    region: REGIONS[0].region,
    os: 'Android 13',
    groupName: 'Unassigned',
    durationDays: 30,
    namePrefix: 'Trial',
  })
  phone.remark = 'Free trial device'
  mutate((d) => d.phones.push(phone))
  return phone
}

export function seed() {
  if (findUserByEmail(DEMO_EMAIL)) return

  const demo = createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    name: 'Amara Osei',
    company: 'MADOVA',
    use_case: 'Reselling to my customers',
  })

  mutate((d) => {
    const u = d.users.find((x) => x.id === demo.id)!
    u.plan = 'scale'
    u.minutes_balance = 412_800
    u.credit_cents = 250_00
  })

  const phones = Array.from({ length: 148 }, (_, i) => {
    const region = REGIONS[i % REGIONS.length]
    const group = DEFAULT_GROUPS[i % (DEFAULT_GROUPS.length - 1)]
    const status = STATUS_POOL[i % STATUS_POOL.length]
    const lapsed = status === PhoneStatus.Expired || status === PhoneStatus.RenewalOverdue

    const phone = buildPhone({
      ownerId: demo.id,
      index: i + 1,
      region: region.region,
      groupName: group.name,
      durationDays: lapsed ? -(2 + (i % 21)) : 9 + (i % 80),
      namePrefix: NAME_PREFIX[i % NAME_PREFIX.length],
    })
    phone.status = status
    phone.os = ['Android 11', 'Android 12', 'Android 13', 'Android 14'][i % 4]
    phone.remark = ['', '', 'creator account', 'do not reset', 'client: Northwind', 'warming'][i % 6]
    phone.renewal_status = i % 2
    phone.start_phone_type = (i % 3) + 1
    phone.share_status = i % 3
    phone.proxy_id = `px_${region.region}`
    if (i % 4 === 0) phone.adb_password = 'adb' + String(1000 + i)
    return phone
  })

  mutate((d) => d.phones.push(...phones))

  mutate((d) => {
    d.orders.push({
      id: prefixedId('ord'),
      user_id: demo.id,
      status: 'paid',
      lines: [{ kind: 'device', description: '148 × cloud phone · 30 days', quantity: 148, unit_cents: 34, total_cents: 5032 }],
      subtotal_cents: 25160,
      discount_cents: 20128,
      total_cents: 5032,
      created_at: nowIso(),
      paid_at: nowIso(),
      created_by: 'user',
    })
  })
}

export function stats() {
  const d = db()
  return { users: d.users.length, phones: d.phones.length, orders: d.orders.length, threads: d.threads.length }
}
