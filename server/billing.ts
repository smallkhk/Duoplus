/**
 * Pricing and orders.
 *
 * The model mirrors what the public pricing page quotes: devices are billed per
 * month with a volume discount, runtime is bought either as prepaid startup
 * minutes or as a flat monthly subscription.
 *
 * Orders settle one of two ways: an on-chain USDT payment confirmed by
 * server/crypto.ts, or account credit an operator granted. `payOrder` refuses
 * anything else — provisioning without payment is how you give your fleet away.
 */
import { db, findUser, mutate, nowIso, prefixedId, type Order, type OrderLine, type User } from './store.js'
import { provision, REGION_INDEX, REGIONS } from './fleet.js'

/** List price for one device-month, before volume discount. */
export const DEVICE_LIST_CENTS = 170

export const VOLUME_TIERS = [
  { min: 1, off: 0 },
  { min: 10, off: 0.4 },
  { min: 50, off: 0.65 },
  { min: 200, off: 0.8 },
  { min: 1000, off: 0.9 },
  { min: 5000, off: 0.95 },
]

export const MINUTE_PACKAGES = [
  { size: 5_000, rate_cents: 0.42 },
  { size: 20_000, rate_cents: 0.4 },
  { size: 100_000, rate_cents: 0.37 },
  { size: 500_000, rate_cents: 0.34 },
  { size: 1_000_000, rate_cents: 0.3 },
]

export const DURATIONS = [7, 30, 90, 180, 360]

export function volumeTier(quantity: number) {
  return [...VOLUME_TIERS].reverse().find((t) => quantity >= t.min) ?? VOLUME_TIERS[0]
}

export function minuteRateCents(amount: number) {
  return [...MINUTE_PACKAGES].reverse().find((p) => amount >= p.size)?.rate_cents ?? MINUTE_PACKAGES[0].rate_cents
}

export interface DeviceQuoteInput {
  quantity: number
  duration_days: number
  region: string
  os?: string
  group_name?: string
  minutes?: number
}

export interface RenewalQuoteInput {
  phone_ids: string[]
  duration_days: number
}

export interface Quote {
  lines: OrderLine[]
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  tier_off: number
}

export function quote(input: DeviceQuoteInput): Quote {
  /* Quantity 0 is a minutes-only order — topping up runtime without buying devices. */
  const quantity = Math.max(0, Math.min(500, Math.floor(input.quantity ?? 1)))
  const days = DURATIONS.includes(input.duration_days) ? input.duration_days : 30
  const months = days / 30

  const tier = volumeTier(quantity)
  const listPer = Math.round(DEVICE_LIST_CENTS * months)
  const netPer = Math.round(listPer * (1 - tier.off))

  const lines: OrderLine[] = []

  if (quantity > 0) {
    lines.push({
      kind: 'device',
      description: `${quantity} × cloud phone · ${days} days · ${REGION_INDEX[input.region]?.area ?? input.region}`,
      quantity,
      unit_cents: netPer,
      total_cents: netPer * quantity,
    })
  }

  if (input.minutes && input.minutes > 0) {
    const rate = minuteRateCents(input.minutes)
    lines.push({
      kind: 'minutes',
      description: `${input.minutes.toLocaleString('en-US')} prepaid startup minutes`,
      quantity: input.minutes,
      unit_cents: rate,
      total_cents: Math.round(rate * input.minutes),
    })
  }

  const minutesTotal = lines.find((l) => l.kind === 'minutes')?.total_cents ?? 0
  const listTotal = listPer * quantity + minutesTotal
  const total = lines.reduce((s, l) => s + l.total_cents, 0)

  return {
    lines,
    subtotal_cents: listTotal,
    discount_cents: listTotal - total,
    total_cents: total,
    tier_off: tier.off,
  }
}

/** Price a renewal — same per-device-month rate and volume tier as a purchase. */
export function quoteRenewal(input: RenewalQuoteInput): Quote {
  const quantity = input.phone_ids.length
  const days = DURATIONS.includes(input.duration_days) ? input.duration_days : 30
  const months = days / 30
  const tier = volumeTier(quantity)
  const listPer = Math.round(DEVICE_LIST_CENTS * months)
  const netPer = Math.round(listPer * (1 - tier.off))
  const lines: OrderLine[] = [{
    kind: 'device',
    description: `Renew ${quantity} × cloud phone · ${days} days`,
    quantity,
    unit_cents: netPer,
    total_cents: netPer * quantity,
  }]
  const listTotal = listPer * quantity
  return {
    lines,
    subtotal_cents: listTotal,
    discount_cents: listTotal - lines[0].total_cents,
    total_cents: lines[0].total_cents,
    tier_off: tier.off,
  }
}

export function createRenewalOrder(
  user: User,
  input: RenewalQuoteInput,
  createdBy: 'user' | 'assistant',
  note?: string,
): Order {
  const q = quoteRenewal(input)
  const days = DURATIONS.includes(input.duration_days) ? input.duration_days : 30
  const order: Order = {
    id: prefixedId('ord'),
    user_id: user.id,
    status: 'pending',
    lines: q.lines,
    subtotal_cents: q.subtotal_cents,
    discount_cents: q.discount_cents,
    total_cents: q.total_cents,
    renew_phone_ids: input.phone_ids,
    renew_days: days,
    created_at: nowIso(),
    created_by: createdBy,
    note,
  }
  mutate((d) => d.orders.push(order))
  return order
}

export function createOrder(
  user: User,
  input: DeviceQuoteInput,
  createdBy: 'user' | 'assistant',
  note?: string,
): Order {
  const q = quote(input)
  const region = REGION_INDEX[input.region] ? input.region : REGIONS[0].region
  const quantity = Math.max(0, Math.min(500, Math.floor(input.quantity ?? 1)))
  const order: Order = {
    id: prefixedId('ord'),
    user_id: user.id,
    status: 'pending',
    lines: q.lines,
    subtotal_cents: q.subtotal_cents,
    discount_cents: q.discount_cents,
    total_cents: q.total_cents,
    provision: quantity > 0 ? {
      quantity,
      region,
      os: input.os ?? 'Android 13',
      duration_days: DURATIONS.includes(input.duration_days) ? input.duration_days : 30,
      group_name: input.group_name,
    } : undefined,
    minutes: input.minutes && input.minutes > 0 ? input.minutes : undefined,
    created_at: nowIso(),
    created_by: createdBy,
    note,
  }
  mutate((d) => d.orders.push(order))
  return order
}

export interface PaidOrder {
  order: Order
  provisioned: string[]
}

/**
 * Settle an order and provision what it bought.
 *
 * Refuses unless the order is actually funded — either an on-chain payment this
 * server has seen confirmed, or account credit covering the total. `allowFree`
 * exists only for operator tooling and is never reachable from a request.
 */
export function payOrder(
  user: User,
  orderId: string,
  opts: { allowFree?: boolean } = {},
): PaidOrder | { error: string } {
  const order = db().orders.find((o) => o.id === orderId && o.user_id === user.id)
  if (!order) return { error: 'Order not found' }
  if (order.status === 'paid') return { error: 'This order has already been paid' }
  if (order.status === 'cancelled') return { error: 'This order was cancelled' }

  const settledOnChain = order.payment?.status === 'confirmed'
  const coveredByCredit = user.credit_cents >= order.total_cents
  if (!settledOnChain && !coveredByCredit && !opts.allowFree) {
    return { error: 'This order is not paid yet. Complete the payment first.' }
  }

  const provisioned: string[] = []

  if (order.renew_phone_ids?.length) {
    const days = order.renew_days ?? 30
    mutate((d) => {
      for (const id of order.renew_phone_ids!) {
        const phone = d.phones.find((p) => p.id === id && p.owner_id === user.id)
        if (!phone) continue
        const current = new Date(phone.expired_at.replace(' ', 'T') + 'Z')
        const from = current.getTime() > Date.now() ? current : new Date()
        phone.expired_at = new Date(from.getTime() + days * 864e5)
          .toISOString().slice(0, 19).replace('T', ' ')
        if (phone.status === 3 || phone.status === 4) phone.status = 2
      }
    })
  }

  if (order.provision) {
    const phones = provision(user, {
      quantity: order.provision.quantity,
      region: order.provision.region,
      os: order.provision.os,
      groupName: order.provision.group_name,
      durationDays: order.provision.duration_days,
      namePrefix: order.provision.group_name ? order.provision.group_name.split(' ')[0] : 'Phone',
    })
    provisioned.push(...phones.map((p) => p.id))
  }

  mutate((d) => {
    const stored = d.orders.find((o) => o.id === order.id)!
    stored.status = 'paid'
    stored.paid_at = nowIso()

    const u = d.users.find((x) => x.id === user.id)!
    if (order.minutes) u.minutes_balance += order.minutes
    /* Any account credit covers part of the charge; the rest is treated as captured. */
    u.credit_cents = Math.max(0, u.credit_cents - order.total_cents)
    if (u.plan === 'trial') {
      const owned = d.phones.filter((p) => p.owner_id === u.id).length
      u.plan = owned >= 200 ? 'scale' : owned >= 50 ? 'growth' : 'starter'
    }
  })

  return { order: { ...order, status: 'paid', paid_at: nowIso() }, provisioned }
}

export function cancelOrder(user: User, orderId: string): boolean {
  return mutate((d) => {
    const order = d.orders.find((o) => o.id === orderId && o.user_id === user.id)
    if (!order || order.status !== 'pending') return false
    order.status = 'cancelled'
    return true
  })
}

export function ordersOf(userId: string): Order[] {
  return db().orders
    .filter((o) => o.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function orderById(userId: string, orderId: string): Order | undefined {
  return db().orders.find((o) => o.id === orderId && o.user_id === userId)
}

export function accountSummary(userId: string) {
  const user = findUser(userId)
  const phones = db().phones.filter((p) => p.owner_id === userId)
  const orders = ordersOf(userId)
  return {
    plan: user?.plan ?? 'trial',
    minutes_balance: user?.minutes_balance ?? 0,
    credit_cents: user?.credit_cents ?? 0,
    phones_total: phones.length,
    phones_powered_on: phones.filter((p) => p.status === 1).length,
    phones_powered_off: phones.filter((p) => p.status === 2).length,
    phones_expired: phones.filter((p) => p.status === 3 || p.status === 4).length,
    regions: [...new Set(phones.map((p) => REGION_INDEX[p.region]?.area ?? p.region))],
    orders_total: orders.length,
    orders_pending: orders.filter((o) => o.status === 'pending').length,
    spend_cents: orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total_cents, 0),
  }
}
