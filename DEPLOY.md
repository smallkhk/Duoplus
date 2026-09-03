# Deploying MADOVA to cPanel (Namecheap)

The whole app — marketing site, console and API — runs as **one Node process** that also serves the
built front end. On cPanel that means one "Node.js App", and updates are a `git pull` and a restart.

Two things to settle before you start.

**1. Your plan must have Node.js.** In cPanel, look for **Setup Node.js App** under *Software*. On
Namecheap it is on the Stellar, Stellar Plus and Stellar Business shared plans, and on VPS/Dedicated.
If it is not there, your plan can only host the static front end — you would lose logins, device
control, purchases and the assistant, because those are the server. Ask Namecheap support to confirm
before buying anything.

**2. You build locally, not on the server.** Shared hosting has little memory and often no SSH, so
the build runs on your machine and the compiled output is published to a `deploy` branch. The server
never compiles anything and never runs `npm install`. The API is bundled to a single file with no
runtime dependencies, which also keeps you clear of the inode limits that shared plans enforce.

---

## Step 1 — Publish a deploy branch (on your machine)

```bash
git clone https://github.com/smallkhk/Duoplus.git madova
cd madova
npm install
./scripts/release.sh
```

That builds the front end and the API bundle, commits them to a `deploy` branch, and force-pushes it
to `origin`. `deploy` is what cPanel will pull. Your `main` branch stays clean — build output is
gitignored there.

What ends up on `deploy` that matters to the server:

| Path | What it is |
| --- | --- |
| `server-dist/app.js` | The whole API, bundled. Plain CommonJS, no dependencies. |
| `dist/` | The built front end, served by the API. |
| `package.json` | Only so cPanel shows the app; nothing is installed from it. |

### Or: build on the server instead

`scripts/release.sh` runs on **your machine**, not the server — it force-pushes to GitHub, and the
server has no credentials for that. If you would rather work entirely over SSH, skip the deploy
branch and build in place. It costs about 150 MB and 9,000 files of `node_modules`, which fits
comfortably inside a Namecheap shared plan's inode quota.

`npm` is not on `PATH` until you activate the Node virtualenv that cPanel creates for the
application — this is why `npm: command not found` happens in a fresh SSH session:

```bash
# find the activate script (needs the Node.js app to exist — Step 3)
ls -d ~/nodevenv/*/*/bin/activate

# activate it, then build
source ~/nodevenv/madova/22/bin/activate
cd ~/madova
npm install
npm run build
mkdir -p tmp && touch tmp/restart.txt
```

Adjust `22` to the Node version you picked. The activate line has to be re-run in every new SSH
session; add it to `~/.bashrc` if you build often.

**Node 22 is the floor.** The OpenAI SDK the assistant uses declares `node >=22`, so npm only warns
on Node 20 and the app can fail at runtime instead. If your host offers nothing newer than 20, pin
the SDK down a major instead: `npm i openai@^6` — 6.x declares no engine restriction and the code
compiles against it unchanged.

Updating then becomes:

```bash
source ~/nodevenv/madova/22/bin/activate
cd ~/madova && git pull && npm install && npm run build && touch tmp/restart.txt
```

`npm install` is not optional: a pull that adds a dependency makes the build fail without it. The
build checks for missing packages first and names them rather than reporting a bundler error.

The build toolchain — TypeScript, Vite, esbuild — lives in devDependencies, and cPanel exports
`NODE_ENV=production` when the app's Application mode is Production, which makes npm skip them and
the build fail with `tsc: command not found`. The committed `.npmrc` sets `include=dev` so this
works either way; if you ever install with a different tool, use `npm install --include=dev`.

If `npm run build` is killed part-way, the plan is out of memory. Retry with a smaller heap:
`NODE_OPTIONS=--max-old-space-size=512 npm run build`.

## Step 2 — Clone the repository in cPanel

cPanel → **Git™ Version Control** → **Create**.

- **Clone a Repository:** on
- **Clone URL:**
  - Public repo: `https://github.com/smallkhk/Duoplus.git`
  - Private repo: use the SSH URL `git@github.com:smallkhk/Duoplus.git`, then copy the public key
    from cPanel → *SSH Access* → *Manage SSH Keys* and add it to GitHub under
    *Settings → Deploy keys* (read access is enough).
- **Repository Path:** `madova` — this creates `/home/YOURUSER/madova`.
- **Repository Name:** `madova`

Create it, then open **Manage** on the repository and switch the checked-out branch to **deploy**.

> Cloning straight into the application directory is the simplest layout: the repository *is* the
> app, so pulling updates it in place with nothing to copy.

### If the application directory already exists

Creating the Node.js app in cPanel first leaves `~/madova` holding `app.js`, `public/`, `tmp/`,
`cgi-bin/`, `node_modules/` and `stderr.log`. `git clone` refuses to write into a non-empty
directory, so cloning there drops the project into a *subfolder* — `~/madova/Duoplus` — and cPanel
never finds `package.json`, which is where `npm install` fails with a confusing ENOENT pointing at
the virtualenv.

Attach the repository to the existing directory instead of cloning into it. None of the project's
files collide with cPanel's scaffolding:

```bash
cd ~/madova
rm -rf Duoplus madova                  # remove any nested clones from earlier attempts
git init
git remote add origin https://github.com/smallkhk/Duoplus.git
git fetch origin claude/madova-reseller-website-rt47gr
git checkout -f -t origin/claude/madova-reseller-website-rt47gr
```

`package.json` now sits at `~/madova/package.json`, where cPanel expects it.

**About `npm install` on CloudLinux:** the activated `npm` resolves `package.json` through a symlink
from the virtualenv to the application root. If that symlink was created before the repository
existed it points at nothing, and `npm install` reports a missing
`~/nodevenv/madova/22/lib/package.json`. Re-create it by pressing **Run NPM Install** once in
Setup Node.js App, or call the virtualenv's npm directly, which skips the wrapper:

```bash
cd ~/madova && ~/nodevenv/madova/22/bin/npm install
```

## Step 3 — Create the Node.js application

cPanel → **Setup Node.js App** → **Create Application**.

| Field | Value |
| --- | --- |
| Node.js version | **22 or newer** — the OpenAI SDK requires it |
| Application mode | Production — see the note below |
| Application root | `madova` |
| Application URL | your domain or a subdomain, e.g. `madova.yourdomain.com` |
| Application startup file | `server-dist/app.js` |

**Application mode matters more than it looks.** Setting it to Development exports
`NODE_ENV=development` into every shell the virtualenv activates, and Vite honours an ambient
NODE_ENV — which bundles React's development build: roughly double the JavaScript, dev-only
warnings and slower rendering, shipped to your customers. The build script now forces production
mode so this cannot happen, but leave the app in Production mode anyway unless you are debugging.

Save. Do **not** press "Run NPM Install" — there is nothing to install, and on a small plan it may
fail on memory or inodes.

## Step 4 — Environment variables

Only three variables belong here. **Every other key — the cloud phone provider, both payment
addresses, the assistant, SMTP — is set in the browser** on the Site settings page after you sign
in. Nothing below needs to be repeated there.

Two ways to set these — pick one.

**From the terminal (SSH):** create a `.env` file in the application root. The server reads it at
startup, and real environment variables always take precedence, so this never fights with anything
the host sets. `.env` is gitignored, so a `git pull` will not touch it.

```bash
cd ~/madova
cat > .env <<'EOF'
MADOVA_SESSION_SECRET=paste-a-long-random-string-here
MADOVA_DATA_DIR=/home/YOURUSER/madova-data
NODE_ENV=production
EOF
chmod 600 .env
```

**From cPanel:** Setup Node.js App, expand your app, and add them under *Environment variables*.

| Variable | Value | Why |
| --- | --- | --- |
| `MADOVA_SESSION_SECRET` | a long random string | **Required.** Signs session cookies. Without it a new secret is generated on every restart and everyone is signed out. Generate one with `openssl rand -hex 32`. |
| `NODE_ENV` | `production` | Marks session cookies `Secure`, so they only travel over HTTPS. Set this only once HTTPS works, or nobody stays signed in. |
| `MADOVA_DATA_DIR` | `/home/YOURUSER/madova-data` | **Recommended.** Keeps the database outside the repository so a bad deploy or a re-clone cannot delete your accounts and devices. |

One more is worth setting if more than one person will have an account:

| Variable | Value | Why |
| --- | --- | --- |
| `MADOVA_ADMIN_EMAIL` | the address you sign in with | Names the site administrator outright. Without it the oldest real account gets the role, which is almost always you — but naming it removes the doubt. |

Then restart: press **Restart** in Setup Node.js App, or `touch ~/madova/tmp/restart.txt` over SSH.

## Step 4b — Lock down the application root

**Do this before the site is public.** cPanel points the domain at the application root, and Apache
serves any file it finds there *before* handing the request to Passenger. Everything in the
repository is therefore downloadable over HTTPS — including `data/madova.json`, which holds every
account with its password hash and salt. Dotfiles like `.env` are blocked by cPanel's default rules,
but nothing else is.

The entry HTML now lives in `web/index.html`, so there is no `index.html` at the project root for
Apache to serve — `/` reaches the app. Earlier versions kept it at the root, which made the bare `/`
return an unbuilt template that renders as a blank page while every other route worked. If you see
that, you are on an older build: `git pull && npm run build`.

Two fixes. First, move the database out of the web root:

```bash
cd ~/madova
mkdir -p ~/madova-data
mv data/madova.json ~/madova-data/ 2>/dev/null
rmdir data 2>/dev/null
grep -q MADOVA_DATA_DIR .env || echo "MADOVA_DATA_DIR=$HOME/madova-data" >> .env
```

Second, stop Apache handing out project files at all. Express already serves everything the browser
needs, so nothing in the application root has to be publicly readable:

```bash
cd ~/madova
cat >> .htaccess <<'EOF'

# Passenger serves the whole app. Apache must not hand out project files.
RedirectMatch 404 ^/(data|server|server-dist|src|scripts|node_modules|dist|web)/
<FilesMatch "\.(ts|tsx|json|md|yml|yaml|map|lock|example)$">
  Require all denied
</FilesMatch>
EOF
touch tmp/restart.txt
```

Append — do not overwrite. cPanel put the Passenger directives in that file and replacing them takes
the app offline.

Then verify nothing leaks:

```bash
for p in data/madova.json package.json server/index.ts src/lib/auth.tsx index.html; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' https://YOURDOMAIN/$p)"
done
```

Every one should be 403 or 404. `/`, `/console` and `/api/meta` should all be 200.

**If the site was already reachable before you did this, treat it as a disclosure.** Rotate
`MADOVA_SESSION_SECRET` (which signs everyone out), and reset the password of any real account.

Note that some hosts do not permit `Indexes` overrides in `.htaccess`, so a `DirectoryIndex`
directive there may be silently ignored. That is why the entry HTML was moved out of the project
root rather than being suppressed with Apache configuration.

## Step 5 — Check it

Visit your Application URL. You should get the marketing site. Then:

- `https://yourdomain.com/api/meta` should return JSON — that is the API answering.
- Sign in with `demo@madova.io` / `madova-demo-2026` and open the console.

**Change the demo password or delete that account before you take real customers.** It is seeded on
first boot and its credentials are in this repository. Sign in, or edit
`/home/YOURUSER/madova-data/madova.json` directly, and remove it.

---

## Updating after the first deploy

This is the loop you asked about. On your machine:

```bash
git add -A && git commit -m "..." && git push origin main
./scripts/release.sh
```

Then in cPanel:

1. **Git™ Version Control** → **Manage** on `madova` → **Update from Remote**.
   (This is the `git pull`. cPanel does it for you; the branch must be `deploy`.)
2. **Setup Node.js App** → **Restart**.

That is the whole update. Nothing is built or installed on the server.

If you have SSH access, the same thing from a terminal:

```bash
cd ~/madova && git pull origin deploy && npm install && mkdir -p tmp && touch tmp/restart.txt
```

`touch tmp/restart.txt` is how Passenger is told to reload — it is equivalent to pressing Restart.

### Back up the database before an update

The data file gains new collections as features are added. Old files are read as-is and the missing
collections simply come back empty, so an update never rewrites what is already there — but a
one-line backup costs nothing and is the difference between a bad deploy being an inconvenience and
being a disaster:

```bash
cp ~/madova-data/madova.json ~/madova-data/madova.$(date +%F-%H%M).json
```

(Use `~/madova/data/madova.json` if you did not set `MADOVA_DATA_DIR`.) To roll back, stop the app,
copy the dated file back over `madova.json`, and restart.

### If the repository is not in the application directory

If you keep the repository somewhere else (say `~/repositories/madova`) and the app in `~/madova`,
use the included `.cpanel.yml`: edit `DEPLOY_PATH` in it to your application root, then in Git
Version Control press **Update from Remote** followed by **Deploy HEAD Commit**. It copies the build
output across and touches `tmp/restart.txt` for you.

---

## Domain and HTTPS

- **A subdomain** (`madova.yourdomain.com`) is the tidiest: create it under *Domains → Subdomains*
  first, then pick it as the Application URL.
- **The root domain** works too, but Passenger writes an `.htaccess` into `public_html`, so move any
  existing site out of the way first.
- **SSL:** cPanel → *SSL/TLS Status* → **Run AutoSSL**. Namecheap issues a free certificate. Do this
  before setting `NODE_ENV=production`, because `Secure` cookies will not be sent over plain HTTP and
  nobody will be able to stay signed in.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| 503 Service Unavailable | Passenger could not start the app. `tail -50 ~/madova/stderr.log` has the reason. Most often the startup file is still cPanel's stub `app.js` rather than `server-dist/app.js`, or the build has not been run so `server-dist/` does not exist. |
| `/` shows a blank page referencing `/src/main.tsx` | Apache is serving the source `index.html` instead of the app. See Step 4b. |
| Project files download over HTTPS | The application root is the document root. See Step 4b — this exposes the account database. |
| `EADDRINUSE` when testing by hand | Passenger already has the app running on that port. That is a healthy sign — pick another port to test with, e.g. `PORT=3999 node server-dist/app.js`. |
| `Cannot find module 'server-dist/app.js'` | The startup file path is wrong, or `deploy` was never checked out. The path is relative to the application root. |
| `Cannot use import statement outside a module` | You pointed the startup file at `server/index.ts` instead of `server-dist/app.js`. Passenger runs plain JavaScript only. |
| Signed out on every page load | `MADOVA_SESSION_SECRET` is not set, or `NODE_ENV=production` without HTTPS working yet. |
| Site loads, but every API call fails | The app is not running; only the static files are being served. Check *Setup Node.js App* shows it started. |
| Data disappeared after a deploy | `MADOVA_DATA_DIR` was left at the default, so the database lived inside the repository. Set it to a path outside and restore from a backup. |
| "Update from Remote" changes nothing | cPanel is on a different branch. Switch the checked-out branch to `deploy` in Manage. |
| Assistant says "Basic mode" | No provider key in the environment. Add one and Restart — a Save alone does not reload the process. |

---

## Going live

Everything that used to mean editing `.env` and restarting is now a page in the console.

### Step 1 — Sign in and find Site settings

Register your account on the live site. The first real account becomes the site administrator, and
a **Site settings** entry appears at the bottom of the console sidebar — only you can see it. The
startup log names whoever holds the role:

```
admin        : you@your-domain.com (oldest account)
```

If that line names someone else, set `MADOVA_ADMIN_EMAIL` in `.env` and restart.

### Step 2 — Fill in the page

Site settings opens with **What is working** — a plain list of what a customer can and cannot do on
your site right now. Work down it. Each section has a **Test** button that really calls the
provider, the explorer or the model and tells you what came back, so a wrong key is caught here
rather than by a customer.

| Section | What it turns on |
| --- | --- |
| Cloud phone supply | Real handsets instead of the built-in engine. Without a key everything still works, but the devices are simulated. |
| Payments · BNB Smart Chain | USDT over BEP-20 at checkout. Needs your receiving address; an Etherscan V2 key is free and strongly recommended. |
| Payments · Tron | USDT over TRC-20. Needs your receiving address; a TronGrid key is optional but the public tier is slow. |
| Support assistant | A real model behind the chat bubble. Without a key it answers from the knowledge base and can still run device actions. |
| Site and email | Your public URL (used to build reset and invitation links) and SMTP. Until SMTP is set, those links go to the server log. |

Saved settings apply on the **next request** — no restart. A stored key comes back masked, and
saving the form without retyping it leaves it alone.

Anything already in your `.env` keeps working: the page falls through to the environment when
nothing is set here, and each field tells you which it is using.

### Step 3 — Remove the demo account

Demo data is **off unless you ask for it** (`MADOVA_SEED_DEMO=true`), so a fresh install never has
any and the sign-in page never offers a demo login. An install that predates that default may still
be carrying the seeded account, in which case Site settings shows a red banner and a **Remove demo
data** button. Press it — that deletes the demo login and its 148 fake devices, and nothing else.

Over SSH instead, if you prefer:

```bash
cd ~/madova
source ~/nodevenv/madova/22/bin/activate
npm run remove-demo
touch tmp/restart.txt
```

The script writes a timestamped backup first.

### Taking payment — how it settles

**The server never holds a private key.** You give it your own receiving address per chain and it
only watches the chain, so a compromise of this box loses data, not funds.

Each invoice is given a unique amount (a per-order offset in the fourth decimal, reserved while the
invoice is open), so two customers owing the same price are never confused on-chain. The server
matches recipient, exact amount and timestamp, refuses a transaction already credited to another
order, and provisions the moment the transfer is deep enough — 12 confirmations on BSC, 60 seconds
of age on Tron, both adjustable on the page. Provisioning happens server-side on the poll, so a
customer who closes the tab still gets what they paid for.

Only USDT is auto-confirmed. It is a stablecoin, so a dollar invoice is a token invoice with no
price oracle involved; quoting native BNB or TRX would need a live rate and a slippage window.

Two things to verify yourself before real money moves: the token contract and its decimals (the
defaults are the canonical USDT values, but check them — they sit next to each other on the page
because changing one without the other asks customers for the wrong amount), and **one small
end-to-end payment on each chain**.

### Your own API keys

The public API at `/v1` is yours, not your customers'. Keys are issued at the bottom of Site
settings, carry only the scopes you grant, and are shown once. Use them to automate your own fleet
from a script:

```bash
curl -X POST https://your-domain.com/v1/cloudPhone/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MADOVA_KEY" \
  -d '{"page":1,"pagesize":10}'
```

### Before real volume

**Move off the JSON store.** It is fine for a pilot, but two simultaneous writes can lose one.
`server/store.ts` is the only file that touches storage.

## What shared hosting will and will not do well

Honest limits, so nothing surprises you later.

- **The database is a JSON file.** Fine for a demo or a small pilot. The server refreshes it across
  worker processes, but two simultaneous writes can still lose one of them. Before you have real
  customers, move to Postgres or MySQL — `server/store.ts` is the only file that touches storage, so
  it is a contained change.
- **Back it up.** Add a cron job in cPanel:
  `cp ~/madova-data/madova.json ~/backups/madova-$(date +\%F).json`
- **Passenger idles the app out.** After a quiet spell the first request is slow while it restarts.
  Harmless here — everything is persisted — but it is why the first page load can take a second.
- **Namecheap caps concurrent processes and memory** on shared plans. This app is one small process,
  so it fits, but streaming assistant replies hold a connection open for their duration.
- **Move to a VPS when** you have real customers, want a real database, need more than a few
  concurrent users, or want zero-downtime deploys. Nothing in the app changes — the same
  `node server-dist/app.js` runs anywhere, and you would put it behind nginx with systemd or Docker.
