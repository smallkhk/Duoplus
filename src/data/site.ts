/** Brand constants and marketing content for the MADOVA reseller site. */

export const BRAND = {
  name: 'MADOVA',
  tagline: 'Antidetect cloud phones for multi-account growth',
  promise: 'Real ARM Android devices in the cloud — provisioned in seconds, isolated by design, driven by an open API.',
  email: 'hello@madova.io',
  sales: 'partners@madova.io',
  status: 'status.madova.io',
}

export const STATS = [
  { value: '150+', label: 'Countries for GPS & SIM' },
  { value: '38 ms', label: 'Median control latency' },
  { value: '99.95%', label: 'Fleet uptime, trailing 90d' },
  { value: '1.2M', label: 'Phones booted this year' },
]

export interface Feature {
  slug: string
  title: string
  blurb: string
  detail: string
  icon: string
}

export const FEATURES: Feature[] = [
  {
    slug: 'real-arm',
    title: 'Real ARM hardware',
    blurb: 'Not an emulator. Physical ARM Android devices racked in our data centres and exposed to you over the browser.',
    detail: 'Every phone is a slice of genuine ARM silicon running stock Android 11–14. Apps that fingerprint the CPU, check for Houdini translation layers, or probe the sensor stack see an ordinary handset, because that is what they are talking to.',
    icon: 'cpu',
  },
  {
    slug: 'isolation',
    title: 'One phone, one identity',
    blurb: 'Independent environment, storage, IMEI, GAID, Android ID and Wi-Fi footprint on every device.',
    detail: 'Nothing is shared between phones — not the filesystem, not the keystore, not the advertising identifier. Reskin a device with one click and it comes back with a brand-new fingerprint and a clean data partition.',
    icon: 'shield',
  },
  {
    slug: 'geo',
    title: 'GPS, SIM & base station in 150+ countries',
    blurb: 'Set coordinates, timezone, locale, carrier, MCC/MNC and cell tower independently of the proxy.',
    detail: 'Location is composed from four layers that apps cross-check: the proxy exit, the GPS fix, the SIM identity and the serving cell. MADOVA lets you set all four, or derive them automatically from the proxy so they never disagree.',
    icon: 'globe',
  },
  {
    slug: 'proxy',
    title: 'Bring your own proxies',
    blurb: 'SOCKS5, HTTP and HTTPS, bound per phone or per group, with health checks and DNS control.',
    detail: 'Attach any residential, mobile or datacentre provider. MADOVA checks reachability and latency on a schedule, routes device DNS through the tunnel so nothing leaks, and quarantines a phone rather than exposing it when a proxy dies.',
    icon: 'route',
  },
  {
    slug: 'api',
    title: 'Open API & ADB',
    blurb: 'Every console action is an HTTP call. Full ADB shell access on any device.',
    detail: 'List, boot, restart, reskin, install, push files and read SMS from your own code. ADB is a toggle away for the cases where a shell beats an API, and root can be granted globally or scoped to named packages.',
    icon: 'terminal',
  },
  {
    slug: 'assistant',
    title: 'An assistant that operates the fleet',
    blurb: 'Ask in plain language and it acts — powers devices, changes settings, prepares orders, answers from the docs.',
    detail: 'The assistant is wired to your account, not to a canned FAQ. It reads your fleet, powers devices on and off, restarts them, rewrites GPS and locale, runs an ADB command and looks anything up in the knowledge base. Anything that spends money is prepared as an order only you can approve, and it can only ever touch devices on your own account.',
    icon: 'sparkle',
  },
  {
    slug: 'automation',
    title: 'Automation & RPA',
    blurb: 'Schedules, webhooks and recorded flows that fan out across thousands of phones.',
    detail: 'Record an interaction once and replay it across a group with per-device jitter, or trigger runs from cron and CI webhooks. Failures are retried, quarantined and reported per device rather than silently swallowed.',
    icon: 'workflow',
  },
  {
    slug: 'team',
    title: 'Teams & sharing',
    blurb: 'Share a single phone with a colleague or hand a whole group to a client, without sharing passwords.',
    detail: 'Roles run from Owner to Viewer. Share links are scoped, revocable and audited, so an operator can drive a device without ever seeing the account it belongs to.',
    icon: 'users',
  },
  {
    slug: 'drive',
    title: 'Cloud drive',
    blurb: 'Upload once, push APKs, media and archives to any number of devices.',
    detail: 'Keep your build artefacts and creative assets beside the fleet. Pushing a 400 MB APK to 500 phones is one call, and transfers happen inside our network rather than over your uplink.',
    icon: 'drive',
  },
  {
    slug: 'numbers',
    title: 'Cloud numbers & SMS',
    blurb: 'Rent real numbers, bind them to phones and read verification codes over the API.',
    detail: 'Numbers attach to a device as its SIM identity, so the handset and the number tell the same story. Inbound SMS arrives in the console and over the API with the verification code already parsed out.',
    icon: 'message',
  },
  {
    slug: 'streaming',
    title: 'Live stream automation',
    blurb: 'Loop pre-rendered video into streaming apps without a capture rig.',
    detail: 'Feed a video file straight into the device camera pipeline, so streaming apps see a live camera rather than a screen share — no phone farm, no HDMI splitters, no dedicated hardware.',
    icon: 'video',
  },
  {
    slug: 'sync',
    title: 'Operation sync',
    blurb: 'Drive one phone, mirror the gesture to hundreds. With natural per-device variance.',
    detail: 'Group control replays taps and swipes across a selection, adding small timing and coordinate jitter so the fleet does not move in lockstep.',
    icon: 'sync',
  },
  {
    slug: 'anywhere',
    title: 'No client to install',
    blurb: 'Run the whole fleet from a browser, on desktop or mobile. Native apps if you prefer.',
    detail: 'The console is a web app — nothing to install, nothing to update, and the fleet is reachable from any machine you happen to be at. Windows, macOS and Android builds are available for offline-first workflows.',
    icon: 'monitor',
  },
]

export interface Solution {
  slug: string
  title: string
  audience: string
  problem: string
  play: string[]
  metric: string
}

export const SOLUTIONS: Solution[] = [
  {
    slug: 'tiktok',
    title: 'TikTok & short-form at scale',
    audience: 'Creator networks, MCNs, growth agencies',
    problem: 'Posting from one machine gets a whole roster of accounts linked and throttled the moment the platform correlates device IDs.',
    play: [
      'One phone per account with its own IMEI, GAID and storage',
      'Residential proxy and GPS pinned to the account\'s stated city',
      'Warm-up scrolling on a schedule before the first upload',
      'Bulk publish through the API from your own scheduler',
    ],
    metric: 'Agencies typically run 200–2,000 phones per brand.',
  },
  {
    slug: 'ecommerce',
    title: 'Marketplace & TikTok Shop',
    audience: 'Cross-border sellers, affiliate teams',
    problem: 'Storefronts, affiliate accounts and buyer personas need to look like they come from different households in different countries.',
    play: [
      'Group phones by marketplace region with matching SIM and locale',
      'Cloud numbers for account verification in-market',
      'Push creative packs from the cloud drive to every storefront',
      'Nightly reskin on the buyer-persona group',
    ],
    metric: 'Sellers run 40–600 phones across 8–12 markets.',
  },
  {
    slug: 'airdrop',
    title: 'Airdrop & testnet farming',
    audience: 'Web3 funds, farming collectives',
    problem: 'Sybil detection clusters wallets by device fingerprint and IP long before it looks at on-chain behaviour.',
    play: [
      'Wallet-per-phone with unique hardware identifiers',
      'Independent proxy exit per device, health-checked',
      'Scheduled interaction flows with randomised timing',
      'ADB scripting for wallets without a public API',
    ],
    metric: 'Collectives run 500–10,000 phones per campaign.',
  },
  {
    slug: 'qa',
    title: 'Mobile app QA',
    audience: 'Mobile engineering teams',
    problem: 'A device lab is expensive to buy, tedious to maintain, and impossible to hand to a distributed team.',
    play: [
      'Matrix of Android 11–14 across eight device profiles',
      'Install the release build from CI via webhook',
      'Parallel ADB test runs with logs streamed back',
      'Reset to a clean device between suites',
    ],
    metric: 'Teams run 20–120 phones with per-minute billing.',
  },
  {
    slug: 'ads',
    title: 'Ad accounts & campaign ops',
    audience: 'Performance marketers, media buyers',
    problem: 'Ad platforms link accounts across devices and ban entire portfolios when one is flagged.',
    play: [
      'Hard isolation between every business manager',
      'Region-consistent proxy, GPS, SIM and locale',
      'Shared access for buyers without credential handoff',
      'Audit trail of who touched which account',
    ],
    metric: 'Buyers run 30–400 phones per agency.',
  },
  {
    slug: 'gaming',
    title: 'Cloud gaming & multi-boxing',
    audience: 'Guilds, game studios, reward players',
    problem: 'Running many game clients needs more phones, more power and more patience than any desk can hold.',
    play: [
      'Long-running instances on subscription startup',
      'Operation sync to drive a squad in parallel',
      'Root scoped to the game package where needed',
      'Snapshot and restore before risky progression',
    ],
    metric: 'Guilds run 50–800 concurrent instances.',
  },
  {
    slug: 'social',
    title: 'Social media management',
    audience: 'Brand teams, community managers',
    problem: 'Schedulers cannot do what needs a real handset — DMs, stories, lives, comment triage.',
    play: [
      'A durable phone per brand handle',
      'Shared with the community team, not the password',
      'Automations for routine posting and triage',
      'Mobile console so the on-call manager can step in',
    ],
    metric: 'Brand teams run 10–150 phones.',
  },
  {
    slug: 'whitelabel',
    title: 'White-label reselling',
    audience: 'Agencies, hosting providers, regional distributors',
    problem: 'You have the customers and the market knowledge, but not a fleet, a control plane or a billing system.',
    play: [
      'Your brand, your domain, your pricing',
      'Sub-accounts with quotas and per-client margin',
      'Wholesale rates that drop as your fleet grows',
      'One consolidated invoice, settled monthly',
    ],
    metric: 'Partners typically resell 300–5,000 phones.',
  },
]

export interface Plan {
  id: string
  name: string
  price: string
  unit: string
  cadence: string
  pitch: string
  cta: string
  featured?: boolean
  points: string[]
  quantities?: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Free trial',
    price: '$0',
    unit: '',
    cadence: 'for 30 days',
    pitch: 'One cloud phone and 30 minutes of temporary startup, so you can put the product in front of a real app before paying anything.',
    cta: 'Claim a phone',
    points: [
      '1 cloud phone for 30 days',
      '30 minutes of temporary startup',
      'Full console and API access',
      'No card required',
    ],
  },
  {
    id: 'device',
    name: 'Cloud phone',
    price: '$0.085',
    unit: '/ device / month',
    cadence: 'billed per device',
    pitch: 'The device itself — its environment, storage and identity. Pay for the phones you keep, add startup time separately.',
    cta: 'Size a fleet',
    featured: true,
    points: [
      'One-click reskin and simulated fingerprint',
      'Independent environment and storage per device',
      'Global GPS, SIM and base station data',
      'Volume pricing to 95% off at scale',
    ],
    quantities: ['2', '5', '10', '50', '100', '500', '2,000', '10,000'],
  },
  {
    id: 'minutes',
    name: 'Startup minutes',
    price: '$0.0042',
    unit: '/ minute',
    cadence: 'prepaid package',
    pitch: 'Metered runtime, billed on the actual minutes a phone spends powered on. Unlimited concurrency, no cap on total boots.',
    cta: 'Buy minutes',
    points: [
      'Charged on actual startup duration',
      'Every phone metered separately',
      'Unlimited concurrent and total opens',
      'Minutes never expire',
    ],
    quantities: ['5,000', '20,000', '100,000', '500,000', '1,000,000'],
  },
  {
    id: 'subscription',
    name: 'Monthly startup',
    price: '$16.91',
    unit: '/ month',
    cadence: 'save 15% annually',
    pitch: 'Flat-rate runtime for phones that stay up. Concurrency matches your subscription count and nothing meters against you.',
    cta: 'Subscribe',
    points: [
      'No per-minute fees at all',
      'Unlimited total opens',
      'Concurrency equal to your subscription count',
      '15% off when paid annually',
    ],
  },
]

export interface ResellerTier {
  name: string
  fleet: string
  discount: string
  margin: string
  perks: string[]
  featured?: boolean
}

export const RESELLER_TIERS: ResellerTier[] = [
  {
    name: 'Affiliate',
    fleet: 'No fleet commitment',
    discount: '20% revenue share',
    margin: '12 months per referral',
    perks: ['Tracked referral links', 'Monthly payouts from $50', 'Co-branded collateral', 'Self-serve dashboard'],
  },
  {
    name: 'Reseller',
    fleet: '300+ phones',
    discount: '30% off list',
    margin: 'You set retail pricing',
    perks: ['Sub-accounts with quotas', 'Consolidated monthly invoice', 'Named partner manager', 'Priority support queue'],
    featured: true,
    },
  {
    name: 'White label',
    fleet: '2,000+ phones',
    discount: '45% off list',
    margin: 'Full pricing control',
    perks: ['Your brand and custom domain', 'Themed console and emails', 'Wholesale API with sub-account scoping', 'Quarterly capacity planning'],
  },
]

export const STEPS = [
  {
    n: '01',
    title: 'Provision',
    body: 'Pick a region and a device profile, choose how many phones you need, and they are up in under a minute. No queue, no hardware lead time.',
  },
  {
    n: '02',
    title: 'Shape the identity',
    body: 'Attach a proxy, set GPS, timezone, locale and SIM, then let MADOVA generate a coherent hardware fingerprint — or write your own values.',
  },
  {
    n: '03',
    title: 'Install and warm up',
    body: 'Push APKs and creative from the cloud drive, then run warm-up automations so accounts have history before they do anything that matters.',
  },
  {
    n: '04',
    title: 'Operate and scale',
    body: 'Drive phones from the browser, script them over the API, or hand groups to clients as sub-accounts under your own brand.',
  },
]

export const TESTIMONIALS = [
  {
    quote: 'We moved 1,400 creator accounts off a physical phone farm in three weeks. The rack is gone, the ops rota is gone, and account survival went up, not down.',
    name: 'Jules Ardan',
    role: 'Head of Operations, Northwind Media',
  },
  {
    quote: 'The API is the product for us. Our scheduler boots phones, publishes, and shuts them down again — we pay for about six minutes per post.',
    name: 'Bea Lindqvist',
    role: 'CTO, Kite Social',
  },
  {
    quote: 'We resell MADOVA to 60 agencies under our own brand. Sub-accounts, quotas and one invoice at the end of the month — I never touch the infrastructure.',
    name: 'Chidi Nwosu',
    role: 'Founder, Lagos Reach',
  },
]

export const FAQS = [
  {
    q: 'Are these emulators?',
    a: 'No. Every MADOVA phone is a slice of a real ARM Android device in one of our data centres. There is no x86 translation layer, so apps that check the CPU, sensors or build fingerprint see an ordinary handset.',
  },
  {
    q: 'How is a phone billed?',
    a: 'Two meters. The device itself is billed per month while you keep it. Runtime is billed either per minute of startup time or on a flat monthly startup subscription — whichever is cheaper for how you work.',
  },
  {
    q: 'What happens when I stop a phone?',
    a: 'Runtime billing stops and the environment, storage, installed apps and logged-in sessions are all preserved. Booting it again returns the same device, not a fresh one.',
  },
  {
    q: 'Can I use my own proxies?',
    a: 'Yes, and most customers do. SOCKS5, HTTP and HTTPS are supported, bound per phone or per group, with scheduled health checks. Device DNS is routed through the tunnel so it does not leak around the proxy.',
  },
  {
    q: 'Is there an API?',
    a: 'Every console action is an HTTP call, authenticated with a DuoPlus-API-Key header against a JSON API. See the developer reference for the full endpoint list, and note the 1 QPS per-endpoint rate limit when you design your integration.',
  },
  {
    q: 'Do I get ADB and root?',
    a: 'ADB is a per-device toggle with an IP whitelist. Root can be granted for the whole device or scoped to named packages, which is usually what you want when an app checks for it.',
  },
  {
    q: 'How does white-label reselling work?',
    a: 'You get wholesale rates, sub-accounts with their own quotas, and a console on your own domain carrying your brand. Your customers never see MADOVA, and you receive one consolidated invoice each month.',
  },
  {
    q: 'Where are the phones located?',
    a: 'Ten regions today — United States, Germany, United Kingdom, Singapore, Japan, Brazil, India, UAE, Indonesia and Nigeria — with GPS and SIM simulation covering more than 150 countries.',
  },
]

export const NAV_FEATURES = FEATURES.slice(0, 8)

export const FOOTER_LINKS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Solutions', to: '/solutions' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Developer API', to: '/developers' },
      { label: 'Help centre', to: '/knowledge' },
      { label: 'Download', to: '/download' },
    ],
  },
  {
    heading: 'Partners',
    links: [
      { label: 'Reseller programme', to: '/reseller' },
      { label: 'White label', to: '/reseller#white-label' },
      { label: 'Affiliates', to: '/reseller#tiers' },
      { label: 'Contact sales', to: '/contact' },
    ],
  },
  {
    heading: 'Use cases',
    links: SOLUTIONS.slice(0, 5).map((s) => ({ label: s.title, to: `/solutions#${s.slug}` })),
  },
  {
    heading: 'Company',
    links: [
      { label: 'Console', to: '/console' },
      { label: 'Buy devices', to: '/console/store' },
      { label: 'Sign in', to: '/login' },
      { label: 'Create account', to: '/register' },
      { label: 'Contact', to: '/contact' },
    ],
  },
]
