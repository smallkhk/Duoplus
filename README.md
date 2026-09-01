# MADOVA

A reseller platform for antidetect cloud phones, built on the
[DuoPlus Cloud Phone OpenAPI](https://help.duoplus.net/docs/api-reference). MADOVA is the
white-label brand: a marketing site that sells the capacity, a console that operates it, and an
AI assistant that can actually drive it.

```bash
npm install
npm run dev      # API on :8787, Vite on :5173 (the web app proxies /api to the API)
npm run build    # typecheck + production bundle into dist/
npm start        # single process: API + the built SPA on :8787
```

Sign in with the seeded demo account — **demo@madova.io** / **madova-demo-2026** — for a fleet of
148 devices, or register and get the free trial: one device and 30 startup minutes.

## Architecture

It is a real client/server app, not a static site. Anything the browser must not hold lives on the
server: the cloud phone API key, password hashes, session signing, order settlement and the model
credentials.

```
server/                      Node + Express API
  store.ts        Durable JSON store (users, devices, orders, support threads)
  auth.ts         scrypt password hashing, signed httpOnly session cookies
  fleet.ts        The device engine — the one place device state changes
  billing.ts      Pricing, quotes, orders, provisioning
  knowledge.ts    The knowledge base (serves the /knowledge page AND the assistant)
  assistant.ts    Claude with tool use, streamed over SSE, plus a no-credential fallback
  assistant-tools.ts  The tools the assistant can run
  seed.ts         First-boot demo account
src/                         React + Vite SPA
  lib/api.ts      Typed client for the MADOVA API
  lib/auth.tsx    Session context and the console route guard
  lib/duoplus/    The cloud phone contract: types, endpoint catalogue, client
```

## Accounts and sessions

Registration and sign-in are real. Passwords are hashed with scrypt and a per-user salt; sessions
are an HMAC-signed `userId.expiry` token in an httpOnly, SameSite=Lax cookie, so there is no session
table and nothing sensitive in the browser. The console is gated by `RequireAuth`, which bounces
signed-out visitors to `/login` and returns them to the page they wanted afterwards.

Every account is isolated. Device queries are scoped by owner, and a control call naming a device on
someone else's account fails rather than acting.

Password reset and OAuth sign-in are the two auth flows not implemented — the buttons say so.

## Device control

Every device action — from the console, the assistant, or the API playground — goes through one
function, `cloudCall` in `server/fleet.ts`. There is no second code path that could drift.

It resolves one of two ways:

- **No `MADOVA_UPSTREAM_KEY`** (the default): the server's own engine answers. Device state is real
  and persists; power transitions, fingerprint edits, renewals and ADB output all behave as the
  upstream contract specifies. Booting is asynchronous, so a device passes through *Powering on*
  before it reaches *Powered on*, exactly as it does upstream.
- **`MADOVA_UPSTREAM_KEY` set**: calls are forwarded to `https://openapi.duoplus.net` with the key
  attached server-side, serialised to respect the documented 1 QPS per-endpoint limit. Batch
  operations chunk their IDs to the documented maximum of 20 per request.

The browser never sees a key either way. It posts `{ path, body }` to `/api/cloud` and gets the
upstream envelope — `{ code, data, message }` — straight back.

### Endpoint coverage

Verified against the published reference:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/cloudPhone/list` | Filtered, sorted, paginated fleet |
| `POST /api/v1/cloudPhone/groupList` | Groups (page size fixed at 200) |
| `POST /api/v1/cloudPhone/update` | Rewrite name, GPS, SIM, locale, Wi-Fi, device IDs |
| `POST /api/v1/cloudPhone/command` | ADB shell, up to 20 devices, 10-second ceiling |
| `POST /api/v1/cloudPhone/batchRoot` | Root, globally or per package |
| `POST /api/v1/cloudPhone/renewal` | Extend subscriptions, returns an order ID |
| `POST /api/v1/proxy/list` | Proxies and their group bindings |
| `POST /api/v1/cloudNumber/smsList` | SMS inbox with the verification code extracted |

Batch power on/off/restart, the application endpoints and cloud drive push are documented upstream
as operations, but their exact paths are not published. Those carry `verified: false` in
`endpoints.ts`, and the reference page renders a visible warning to confirm the path before shipping
against it. Their request and response shapes are correct regardless.

## Buying devices

Console → **Buy devices**. Pick a region, quantity and term; the quote re-prices on every change and
shows the volume tier you land in. Approving the order provisions the devices immediately, each with
an identity coherent for its region — SIM, operator, timezone, locale and GPS all agree.

Pricing follows the public model: $1.70 per device-month list, stepping down through the volume
tiers to the headline $0.085 at 95% off; prepaid startup minutes from $0.0042 down to $0.0030; and a
flat $16.91 monthly startup subscription as the alternative to metered runtime.

**No payment processor is connected.** `payOrder` in `server/billing.ts` records the order as paid
and provisions without taking money. That function is the single place to add a real charge, and it
is commented as such.

## The assistant

The floating support button is on every page. Signed in, the assistant is connected to the account
and can:

- list and filter the fleet, and report status, expiry and region
- power devices on and off, and restart them
- rename a device and change its remark, GPS, timezone or language
- run an ADB command and return the output
- prepare a purchase or a renewal
- read the orders, and search the knowledge base
- hand the thread to a human

Two guardrails are structural, not prompt-level. **The assistant cannot spend money**:
`prepare_device_purchase` and `prepare_renewal` create a *pending* order and return it; the customer
gets an Approve button and only `POST /api/orders/:id/pay` — which the assistant has no tool for —
completes it. And **every tool is scoped to the caller's account**, so it cannot reach another
customer's devices even if it tries.

It runs on `claude-opus-5` with adaptive thinking, streamed to the browser over SSE so tool activity
appears as it happens rather than at the end. The loop is hand-written rather than using the SDK
tool runner precisely so each tool call can be emitted mid-flight.

**Without model credentials** (`ANTHROPIC_API_KEY` unset) the assistant falls back to a
deterministic intent router in the same file. It runs the same tools, so restarting a device, buying
phones and searching the docs all still work — it just cannot converse. The chat header shows
"Basic mode" so nobody mistakes it for the model.

## Knowledge base

`/knowledge` and the assistant's `search_knowledge` tool are served by the same 16 articles in
`server/knowledge.ts`. What a customer reads and what the assistant answers with cannot drift apart,
and the assistant is instructed to say it does not know rather than invent a price or a limit.

## Configuration

Everything is optional — see `.env.example`. `MADOVA_SESSION_SECRET` is the one to set in any real
deployment; without it a random secret is generated per process and every restart signs users out.

## What is real and what is illustrative

Real, and persisted: accounts, sessions, devices and their state, groups, proxies, orders,
provisioning, support threads, and every assistant action.

Illustrative sample data, in `src/data/demo.ts`, on screens with no backend yet: automation tasks,
cloud drive files, rented numbers, team members, sub-accounts and the 30-day usage history. Each
screen that writes to one of these says inline that the action is not wired up, rather than
pretending to succeed.

## Verification

- Typecheck (web and server) and production build clean.
- All routes render with no console errors; no horizontal overflow at 390 / 768 / 1280 px.
- Driven end to end in a browser: the console guard redirects and returns to the requested page;
  registration provisions a trial device; checkout took a fleet from 1 to 6 devices; the assistant
  powered on a named device, and a chat purchase went pending → approved → 9 devices; a wrong
  password is rejected; guest chat answers from the knowledge base.
- **Not exercised against live services:** this environment had neither an Anthropic key nor a cloud
  phone key, so the `claude-opus-5` path and the upstream forwarding path are written to their
  documented contracts but have not been run against the real APIs.
