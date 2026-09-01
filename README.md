# MADOVA

A reseller website and operator console for antidetect cloud phones, built on the
[DuoPlus Cloud Phone OpenAPI](https://help.duoplus.net/docs/api-reference). MADOVA is the
white-label brand: the marketing site sells the capacity, and the console drives it through the
same JSON API a real integration would use.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle into dist/
npm run preview  # serve the built bundle
```

## What's in it

**Marketing site** — home, capabilities, solutions, pricing (with a working cost calculator),
the reseller/white-label programme, a developer API reference with a live playground, downloads,
contact, and legal pages.

**Console** — a full operator UI over the API:

| Screen | What it does |
| --- | --- |
| Overview | Fleet KPIs, 30-day runtime chart, status donut, region breakdown, sub-account revenue |
| Cloud phones | Filter, sort, paginate; multi-select drives the batch endpoints; detail drawer with fingerprint, screen and an ADB console |
| Groups / Proxies | Cohorts, and proxy health with latency and binding counts |
| Applications / Cloud drive | Installed packages, and file push to a group |
| Cloud numbers | Rented numbers with an SMS inbox and parsed verification codes |
| Tasks & RPA | Schedules, webhooks, per-device success rates |
| API | Key management, sandbox/live switch, and a live log of every call the console made |
| Sub-accounts / Team / Billing / Settings | The reseller layer — quotas, margin, roles, invoices, white-label branding |

## The API layer

Everything the console shows comes through one client, which speaks the upstream contract exactly:
`POST {base}/api/v1/...`, JSON body, a `DuoPlus-API-Key` header, and a
`{ code, data, message }` envelope on every response.

```
src/lib/duoplus/
  types.ts       # request/response shapes, status enums
  endpoints.ts   # endpoint catalogue — drives the reference page and the playground
  client.ts      # the client: auth, 1 QPS serialisation, request log, sandbox/live routing
  mock.ts        # deterministic in-browser fleet answering the same paths
```

**Sandbox by default.** With no key configured, calls are answered by `mock.ts` — a seeded fleet of
148 phones that responds on the real paths with the real envelope, and mutates when you power
phones on and off. Nothing is stubbed at the component level, so the console exercises the same
code path either way.

**Going live.** Paste a key into *Console → Automation → API* and flip the switch. The identical
requests then go to `https://openapi.duoplus.net`, routed in development through the `/upstream`
Vite proxy to sidestep CORS. A real deployment should terminate that proxy server-side so the key
never reaches a browser — the console stores it in `localStorage`, which is fine for a demo and not
for production.

**Rate limiting.** Upstream caps every endpoint at 1 QPS, so `client.ts` funnels all calls through a
single promise chain with minimum spacing rather than letting components fire in parallel. Batch
operations chunk their IDs to the documented maximum of 20 per request.

### Endpoint coverage

Verified against the published reference:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/cloudPhone/list` | Filtered, sorted, paginated fleet |
| `POST /api/v1/cloudPhone/groupList` | Groups (page size fixed at 200) |
| `POST /api/v1/cloudPhone/update` | Rewrite name, GPS, SIM, locale, Wi-Fi, device IDs |
| `POST /api/v1/cloudPhone/command` | ADB shell, up to 20 phones, 10-second ceiling |
| `POST /api/v1/cloudPhone/batchRoot` | Root, globally or per package |
| `POST /api/v1/cloudPhone/renewal` | Extend subscriptions, returns an order ID |
| `POST /api/v1/proxy/list` | Proxies and their group bindings |
| `POST /api/v1/cloudNumber/smsList` | SMS inbox with the verification code extracted |

Batch power on/off/restart, the application endpoints and cloud drive push are documented in the
upstream reference, but their exact paths are not published in it. Those entries carry
`verified: false` in `endpoints.ts`, and the reference page renders a visible warning that the path
follows the naming convention of its siblings and should be confirmed before shipping. Their
request and response shapes are correct regardless.

## Notes

- Dark theme throughout, defined as tokens in `src/index.css`; no UI framework beyond Tailwind.
- Charts are hand-rolled SVG (`src/components/Charts.tsx`) — no charting dependency.
- Verified free of horizontal overflow at 390 / 768 / 1280 px, with no console errors on any route.
- There is no auth backend: any credentials on the sign-in form open the console. Forms that would
  write to a real system say so inline rather than pretending to succeed.
- Pricing follows the public model — per-device monthly, metered startup minutes, and a flat
  monthly startup subscription — with volume tiers that reach the headline $0.085/device/month at
  95% off list. The calculator quotes runtime both ways and applies whichever is cheaper.
