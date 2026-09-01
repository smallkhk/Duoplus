/**
 * The MADOVA knowledge base.
 *
 * One source feeds two consumers: the public /knowledge page, and the
 * assistant's `search_knowledge` tool. Keeping them together means the answers
 * customers read and the answers the assistant gives cannot drift apart.
 */

export interface Article {
  id: string
  category: string
  title: string
  summary: string
  tags: string[]
  body: string
}

export const CATEGORIES = [
  'Getting started',
  'Devices',
  'Identity & detection',
  'Networking',
  'Billing',
  'Automation & API',
  'Reselling',
  'Troubleshooting',
] as const

export const ARTICLES: Article[] = [
  {
    id: 'what-is-a-cloud-phone',
    category: 'Getting started',
    title: 'What a MADOVA cloud phone actually is',
    summary: 'A slice of a real ARM Android device in our data centre — not an emulator.',
    tags: ['cloud phone', 'emulator', 'arm', 'android', 'hardware'],
    body: `Every MADOVA phone runs on genuine ARM silicon in one of our data centres, on stock Android 11 through 14. There is no x86 translation layer, so an app that inspects the CPU, the sensor stack or the build fingerprint sees an ordinary handset.

Each device gets its own environment, its own storage partition, and its own hardware identity — IMEI, serial number, Android ID, advertising ID, Wi-Fi and Bluetooth details. Nothing is shared between two phones on your account.

You reach a phone from the browser console, from the native apps, over ADB, or over the API. There is nothing to install to get started.`,
  },
  {
    id: 'first-phone',
    category: 'Getting started',
    title: 'Booting your first phone',
    summary: 'Create an account, provision a device, power it on — about a minute end to end.',
    tags: ['start', 'trial', 'provision', 'boot', 'first'],
    body: `1. Create an account. Every new account starts on the free trial: one cloud phone for 30 days and 30 startup minutes, no card required.
2. Open Console → Cloud phones. Your trial device is listed as Powered off.
3. Select it and press Power on. The status moves to Powering on and then to Powered on, usually within a few seconds.
4. Open the device to mirror its screen, or connect over ADB using the address shown on the device's Overview tab.

To add more devices, use Console → Buy devices. Pick a region, a quantity and a term, and they are provisioned as soon as the order is paid.`,
  },
  {
    id: 'power-states',
    category: 'Devices',
    title: 'Device states and what each one means',
    summary: 'The nine statuses a phone can report, and which are actionable.',
    tags: ['status', 'power', 'expired', 'configuring', 'states'],
    body: `A phone reports one of these states:

- Not configured (0) — provisioned but never set up.
- Powered on (1) — running, and consuming startup minutes.
- Powered off (2) — stopped. Storage, apps and logged-in sessions are all preserved; runtime billing stops.
- Expired (3) — the subscription lapsed. Renew to bring it back.
- Renewal overdue (4) — payment failed. Renew to restore it before storage is released.
- Powering on (10) — booting.
- Configuring (11) — applying a fingerprint or environment change.
- Configuration failed (12) — the last change did not apply; retry or reset the device.

Powering a phone off never wipes it. Only a reskin or reset replaces the environment.`,
  },
  {
    id: 'control-a-device',
    category: 'Devices',
    title: 'Ways to control a device',
    summary: 'Console, chat assistant, API and ADB all drive the same engine.',
    tags: ['control', 'restart', 'power on', 'power off', 'adb', 'assistant'],
    body: `There are four ways to act on a device, and they all reach the same control plane:

- The console. Select phones in the fleet table and use the bulk bar: Power on, Power off, Restart, Run ADB, Renew.
- The assistant. Ask it in plain language — "restart TikTok-US-014", "power off everything in the Airdrop Farm group". It performs the action and reports what changed.
- The API. POST to /api/v1/cloudPhone/batchPowerOn, batchPowerOff or batchRestart with up to 20 device IDs.
- ADB. Connect to the address on the device's Overview tab and drive it with a shell.

Batch operations take at most 20 devices per call. Larger selections are chunked automatically by the console and the assistant.`,
  },
  {
    id: 'fingerprints',
    category: 'Identity & detection',
    title: 'Keeping a device fingerprint coherent',
    summary: 'Proxy exit, GPS, SIM and serving cell must agree, or the device contradicts itself.',
    tags: ['fingerprint', 'gps', 'sim', 'imei', 'detection', 'timezone', 'locale'],
    body: `Apps rarely check one signal. They cross-check four:

- The proxy exit IP and the country it geolocates to.
- The GPS fix reported by the location provider.
- The SIM identity — MCC/MNC, operator name, MSISDN country.
- The serving cell (LAC/CID) and the device timezone and locale.

A device whose IP says Los Angeles, GPS says Berlin and SIM says Singapore is the easiest thing in the world to flag. MADOVA can derive GPS, timezone, locale and SIM from the attached proxy so they never disagree, or you can set each one explicitly.

Change any of them with POST /api/v1/cloudPhone/update, or from the device drawer in the console. Fields you omit are left untouched.`,
  },
  {
    id: 'reskin',
    category: 'Identity & detection',
    title: 'Reskin vs restart vs reset',
    summary: 'Three different operations that are easy to confuse.',
    tags: ['reskin', 'reset', 'restart', 'wipe', 'new identity'],
    body: `Restart reboots the device. Storage, apps, sessions and identity all survive. Use it when an app is misbehaving.

Reskin generates a new hardware identity — IMEI, serial, Android ID, advertising ID, Wi-Fi and Bluetooth — while keeping the device. Use it when you want a clean identity for a new account.

Reset returns the device to a factory state: new identity and an empty data partition. Everything installed and every logged-in session is gone. There is no undo.`,
  },
  {
    id: 'proxies',
    category: 'Networking',
    title: 'Attaching your own proxies',
    summary: 'SOCKS5, HTTP and HTTPS, bound per device or per group, with DNS routed through the tunnel.',
    tags: ['proxy', 'socks5', 'dns', 'residential', 'ip', 'leak'],
    body: `MADOVA does not sell proxies — bring any residential, mobile or datacentre provider you already use. SOCKS5, HTTP and HTTPS are supported.

Bind a proxy to a single phone or to a whole group. Device DNS is routed through the tunnel by default, which stops resolution leaking around the proxy and betraying the real location.

We health-check every proxy on a schedule and record latency. If a proxy stops responding, the phones bound to it are held rather than being exposed on a bare connection.`,
  },
  {
    id: 'billing-model',
    category: 'Billing',
    title: 'How billing works: two meters',
    summary: 'You pay for the device you keep, and separately for the minutes it runs.',
    tags: ['billing', 'price', 'cost', 'minutes', 'subscription', 'invoice'],
    body: `Device charge. Each phone you hold is billed per month. List price is $1.70 per device-month, and the volume discount steps down automatically: 40% off from 10 devices, 65% from 50, 80% from 200, 90% from 1,000 and 95% from 5,000 — which is where the headline $0.085 per device-month comes from.

Runtime charge. Pick whichever is cheaper for how you work:
- Prepaid startup minutes, from $0.0042 per minute, dropping to $0.0030 on the largest package. Minutes never expire and are only consumed while a phone is powered on.
- A flat monthly startup subscription at $16.91 per concurrent device, with no per-minute fees at all.

Below roughly 2.5 hours of runtime per day, metered minutes win. Above that, the subscription does. You can mix both across one fleet, per device.`,
  },
  {
    id: 'buying-devices',
    category: 'Billing',
    title: 'Buying and renewing devices',
    summary: 'Order from the console or ask the assistant; devices appear as soon as the order is paid.',
    tags: ['buy', 'purchase', 'order', 'renew', 'checkout', 'add devices'],
    body: `To buy devices, open Console → Buy devices. Choose a region, a quantity, a term and optionally a prepaid minute package. The quote shows the volume tier you land in before you commit.

You can also ask the assistant — "buy me 5 phones in Germany for 90 days". It prepares the order and shows you the total; nothing is charged until you press Approve. The assistant can never complete a purchase on its own.

Renewals work the same way. Select phones in the fleet table and press Renew, or ask the assistant to renew a device by name. A renewal extends from the current expiry date, so renewing early never loses you time.`,
  },
  {
    id: 'api-basics',
    category: 'Automation & API',
    title: 'Calling the API',
    summary: 'Every endpoint is a POST with a JSON body and one auth header.',
    tags: ['api', 'key', 'header', 'rate limit', 'envelope', 'integration'],
    body: `Every endpoint is POST {base}/api/v1/..., takes a JSON body, and returns the same envelope: { code, data, message }. A code of 200 means the call worked.

Authenticate with a single header. Generate a key in Console → Automation → API; it is account-scoped and can be revoked at any time.

Each endpoint allows one request per second. The limit is per endpoint, not per account, so a list call and a power-on call do not compete — but two list calls do. Batch instead of looping: power actions and ADB take up to 20 device IDs per request.

Batch endpoints report per-device outcomes. A 200 response can still contain failures in data.fail with reasons in data.fail_reason — always check it.`,
  },
  {
    id: 'adb',
    category: 'Automation & API',
    title: 'Using ADB',
    summary: 'A shell on any device, with an IP allowlist and optional scoped root.',
    tags: ['adb', 'shell', 'root', 'command', 'whitelist'],
    body: `ADB is a per-device toggle. Once enabled, the device's Overview tab shows an address you can connect to directly: adb connect <host>:<port>.

You can also run commands without a local ADB client, through POST /api/v1/cloudPhone/command. Supply either image_id for one device or image_ids for up to twenty. The adb shell prefix is not needed, and each command must finish within ten seconds — for longer work, append > /dev/null 2>&1 & to background it.

Root can be granted for the whole device or scoped to named packages, which is usually what you want when an app checks for it.

Restrict ADB to an IP allowlist from Console → Settings → Security.`,
  },
  {
    id: 'assistant',
    category: 'Automation & API',
    title: 'What the assistant can do',
    summary: 'It reads your account and performs real actions — with purchases gated behind your approval.',
    tags: ['assistant', 'ai', 'chat', 'support', 'automation'],
    body: `The assistant is connected to your account, not to a canned FAQ. Signed in, it can:

- List and filter your fleet, and report status, expiry and region.
- Power devices on and off, and restart them.
- Rename a device, change its remark, GPS, timezone or language.
- Run an ADB command on a device.
- Renew a subscription.
- Prepare a purchase for you to approve.
- Look anything up in this knowledge base.
- Hand the conversation to a human when you ask.

Two guardrails: anything that spends money is prepared as a pending order that only you can approve, and the assistant can only ever touch devices on your own account.

Signed out, it answers questions from the knowledge base and can take a message for the team.`,
  },
  {
    id: 'reseller',
    category: 'Reselling',
    title: 'Reselling under your own brand',
    summary: 'Wholesale rates, sub-accounts with quotas, your brand on the console.',
    tags: ['reseller', 'white label', 'partner', 'wholesale', 'sub-account', 'margin'],
    body: `Three tiers. Affiliate pays 20% revenue share for 12 months per referral with no fleet commitment. Reseller starts at 300 devices and takes 30% off list, with sub-accounts and consolidated invoicing. White label starts at 2,000 devices, takes 45% off list, and puts your brand and domain on the console.

Sub-accounts each get their own console, their own users, and device and minute quotas you set. They cannot exceed the quota and they never see another customer's fleet.

You set retail pricing; MADOVA invoices you at wholesale on net 30 terms. Margin per customer is reported in Console → Sub-accounts.`,
  },
  {
    id: 'account-linking',
    category: 'Troubleshooting',
    title: 'My accounts got linked anyway',
    summary: 'Almost always one of four causes — and all four are fixable.',
    tags: ['linked', 'banned', 'flagged', 'detection', 'problem'],
    body: `In order of how often we see it:

1. Shared proxy exit. Two accounts behind one IP is the strongest link there is. Give every device its own exit.
2. Inconsistent geography. The IP, GPS, SIM and timezone disagree. Derive them from the proxy, or set all four to match.
3. Behavioural pattern. Identical timing across devices reads as automation. Turn on per-device jitter for group actions and warm accounts up before they do anything important.
4. Recycled identity. Reusing a device that previously held a flagged account carries the old fingerprint. Reskin before reusing.

If you are still linked after all four, open a support thread with the device IDs and we will look at the fingerprint with you.`,
  },
  {
    id: 'device-wont-start',
    category: 'Troubleshooting',
    title: 'A device will not power on',
    summary: 'Check expiry, minute balance, and the configuration state in that order.',
    tags: ['wont start', 'boot', 'stuck', 'powering on', 'failed'],
    body: `Work through these in order:

1. Is the subscription live? A device in Expired or Renewal overdue will refuse to start. Renew it and try again.
2. Do you have runtime? Metered devices need startup minutes on the account. Check Console → Billing.
3. Is it stuck in Configuring? A configuration change is still applying. Give it a minute.
4. Did it land in Configuration failed? The last fingerprint change did not apply. Re-apply it, or reset the device.

If a device sits in Powering on for more than two minutes, restart it once. If that does not clear it, open a support thread with the device ID.`,
  },
  {
    id: 'security',
    category: 'Troubleshooting',
    title: 'Keeping the account secure',
    summary: 'Keys, two-factor, allowlists, and what to do if something leaks.',
    tags: ['security', 'api key', 'leak', '2fa', 'password'],
    body: `An API key grants access to every endpoint on the account, including renewal, which spends money. Treat it like a password: never commit it, never ship it to a browser, and proxy it server-side in any web integration.

If a key leaks, revoke it from Console → Automation → API. Revocation takes effect immediately.

Turn on required two-factor authentication for the whole team from Console → Settings → Security, and restrict ADB connections to an IP allowlist while you are there.`,
  },
]

const norm = (s: string) => s.toLowerCase()

/** Lightweight keyword scoring — the corpus is small enough not to need an index. */
export function searchArticles(query: string, limit = 4): Article[] {
  const terms = norm(query).split(/[^a-z0-9]+/).filter((t) => t.length > 2)
  if (terms.length === 0) return ARTICLES.slice(0, limit)

  const scored = ARTICLES.map((a) => {
    const title = norm(a.title)
    const tags = a.tags.map(norm)
    const haystack = norm(`${a.title} ${a.summary} ${a.tags.join(' ')} ${a.body}`)
    let score = 0
    for (const t of terms) {
      if (title.includes(t)) score += 6
      if (tags.some((tag) => tag.includes(t))) score += 4
      if (norm(a.summary).includes(t)) score += 2
      if (haystack.includes(t)) score += 1
    }
    return { a, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((s) => s.a)
}

export function articleById(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id)
}
