import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import {
  Badge, Button, ButtonLink, Card, Code, Container, CopyButton, Section, SectionHeading,
  Select, cx, useToast,
} from '@/components/ui'
import {
  API_BASE_URL, API_GROUPS, API_KEY_HEADER, API_QPS_LIMIT, ENDPOINTS, ERROR_CODES,
  type ApiEndpoint,
} from '@/lib/duoplus/endpoints'
import { call } from '@/lib/duoplus/client'
import { useAuth } from '@/lib/auth'

export function Developers() {
  const [activeId, setActiveId] = useState(ENDPOINTS[0].id)
  const active = ENDPOINTS.find((e) => e.id === activeId) ?? ENDPOINTS[0]

  const grouped = useMemo(
    () => API_GROUPS.map((g) => ({ group: g, items: ENDPOINTS.filter((e) => e.group === g) }))
      .filter((g) => g.items.length > 0),
    [],
  )

  return (
    <>
      <Hero />
      <Quickstart />

      <div className="border-t border-ink-800">
        <Container className="py-16">
          <div className="grid gap-10 lg:grid-cols-[15rem_1fr]">
            <nav className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-500">
                Endpoints
              </p>
              <div className="mt-4 space-y-5">
                {grouped.map((g) => (
                  <div key={g.group}>
                    <p className="px-3 text-[0.72rem] font-semibold text-ink-400">{g.group}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {g.items.map((e) => (
                        <li key={e.id}>
                          <button
                            onClick={() => setActiveId(e.id)}
                            className={cx(
                              'w-full rounded-lg px-3 py-1.5 text-left text-[0.8rem] transition-colors',
                              e.id === activeId
                                ? 'bg-brand-500/15 font-medium text-brand-200'
                                : 'text-ink-400 hover:bg-ink-800/70 hover:text-ink-100',
                            )}
                          >
                            {e.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </nav>

            <EndpointDoc endpoint={active} />
          </div>
        </Container>
      </div>

      <Reference />
    </>
  )
}

/* --------------------------------- hero -------------------------------- */

function Hero() {
  return (
    <div className="relative overflow-hidden border-b border-ink-800">
      <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
      <Container className="relative py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] [&>*]:min-w-0">
          <div>
            <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300">
              Developers
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              One header, one verb,{' '}
              <span className="text-gradient">one envelope</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-[1.05rem] leading-relaxed text-ink-300">
              Every MADOVA endpoint is a POST that takes JSON and returns{' '}
              <code className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-300">
                {'{ code, data, message }'}
              </code>
              . There is no SDK to learn and no OAuth dance — authenticate with a single header and
              start calling.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/console/api" icon="key">Get an API key</ButtonLink>
              <a
                href="#playground"
                className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-ink-100 ring-1 ring-inset ring-ink-700 transition-colors hover:bg-ink-800/70"
              >
                <Icon name="bolt" className="size-4" />
                Try a live call
              </a>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-2.5">
              <span className="font-mono text-[0.7rem] text-ink-500">Base URL</span>
              <CopyButton text={API_BASE_URL} />
            </div>
            <div className="space-y-4 p-5">
              {[
                ['Base URL', API_BASE_URL],
                ['Auth header', `${API_KEY_HEADER}: <your key>`],
                ['Method', 'POST · application/json'],
                ['Rate limit', `${API_QPS_LIMIT} QPS per endpoint`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-ink-800 pb-3 last:border-0 last:pb-0">
                  <span className="shrink-0 text-[0.76rem] text-ink-500">{k}</span>
                  <span className="truncate text-right font-mono text-[0.78rem] text-ink-100">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Container>
    </div>
  )
}

/* ------------------------------ quickstart ----------------------------- */

const LANGS = {
  curl: {
    label: 'cURL',
    code: `curl -X POST ${API_BASE_URL}/api/v1/cloudPhone/list \\
  -H "Content-Type: application/json" \\
  -H "Lang: en" \\
  -H "${API_KEY_HEADER}: $MADOVA_KEY" \\
  -d '{"page":1,"pagesize":50,"link_status":["1"]}'`,
  },
  node: {
    label: 'Node.js',
    code: `const madova = async (path, body = {}) => {
  const res = await fetch("${API_BASE_URL}" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "${API_KEY_HEADER}": process.env.MADOVA_KEY,
    },
    body: JSON.stringify(body),
  })
  const { code, data, message } = await res.json()
  if (code !== 200) throw new Error(\`\${code}: \${message}\`)
  return data
}

const { list } = await madova("/api/v1/cloudPhone/list", {
  link_status: ["1"],
  pagesize: 50,
})
console.log(list.map(p => p.name))`,
  },
  python: {
    label: 'Python',
    code: `import os, requests

BASE = "${API_BASE_URL}"
HEADERS = {
    "Content-Type": "application/json",
    "${API_KEY_HEADER}": os.environ["MADOVA_KEY"],
}

def madova(path, body=None):
    r = requests.post(BASE + path, json=body or {}, headers=HEADERS, timeout=30)
    payload = r.json()
    if payload["code"] != 200:
        raise RuntimeError(f'{payload["code"]}: {payload["message"]}')
    return payload["data"]

fleet = madova("/api/v1/cloudPhone/list", {"link_status": ["2"]})
madova("/api/v1/cloudPhone/batchPowerOn", {
    "image_ids": [p["id"] for p in fleet["list"]][:20]
})`,
  },
  go: {
    label: 'Go',
    code: `func madova(path string, body any) (json.RawMessage, error) {
    buf, _ := json.Marshal(body)
    req, _ := http.NewRequest("POST", "${API_BASE_URL}"+path, bytes.NewReader(buf))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("${API_KEY_HEADER}", os.Getenv("MADOVA_KEY"))

    res, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer res.Body.Close()

    var env struct {
        Code    int             \`json:"code"\`
        Data    json.RawMessage \`json:"data"\`
        Message string          \`json:"message"\`
    }
    if err := json.NewDecoder(res.Body).Decode(&env); err != nil {
        return nil, err
    }
    if env.Code != 200 {
        return nil, fmt.Errorf("%d: %s", env.Code, env.Message)
    }
    return env.Data, nil
}`,
  },
} as const

type LangKey = keyof typeof LANGS

function Quickstart() {
  const [lang, setLang] = useState<LangKey>('curl')

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] [&>*]:min-w-0">
        <div>
          <SectionHeading
            eyebrow="Quickstart"
            title="From key to fleet in five lines"
            lead="Generate a key in the console, send it as a header, and every endpoint is available immediately. There is nothing to enable per-endpoint."
          />
          <ol className="mt-8 space-y-5">
            {[
              ['Generate a key', <>Console → <strong className="font-medium text-ink-100">Automation → API</strong>. Keys are scoped to the account and can be revoked at any time.</>],
              ['Send it as a header', <>Add <code className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-300">{API_KEY_HEADER}</code> to every request. There is no query-string fallback.</>],
              ['Respect the rate limit', <>Each endpoint allows {API_QPS_LIMIT} request per second. Serialise your calls and back off when you see a 429.</>],
              ['Read the envelope', <>A 200 in <code className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-300">code</code> means the call worked. Batch endpoints still report per-device failures in <code className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-300">data.fail</code>.</>],
            ].map(([t, d], i) => (
              <li key={i} className="flex gap-4">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-500/15 font-mono text-[0.68rem] font-semibold text-brand-300">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[0.88rem] font-medium text-ink-100">{t as string}</span>
                  <span className="mt-1 block text-[0.83rem] leading-relaxed text-ink-400">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap gap-1">
            {(Object.keys(LANGS) as LangKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setLang(k)}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-[0.8rem] font-medium transition-colors',
                  lang === k ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-100',
                )}
              >
                {LANGS[k].label}
              </button>
            ))}
            <span className="ml-auto"><CopyButton text={LANGS[lang].code} /></span>
          </div>
          <Code className="max-h-[30rem]">{LANGS[lang].code}</Code>
        </div>
      </div>
    </Section>
  )
}

/* ---------------------------- endpoint detail --------------------------- */

function EndpointDoc({ endpoint }: { endpoint: ApiEndpoint }) {
  const [tab, setTab] = useState<'request' | 'response' | 'try'>('request')

  useEffect(() => { setTab('request') }, [endpoint.id])

  return (
    <div id="playground" className="scroll-mt-20 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="accent">{endpoint.method}</Badge>
        <code className="font-mono text-[0.92rem] text-ink-50">{endpoint.path}</code>
        <CopyButton text={`${API_BASE_URL}${endpoint.path}`} label="Copy URL" />
      </div>

      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink-50">{endpoint.name}</h2>
      <p className="mt-3 max-w-2xl text-pretty text-[0.95rem] leading-relaxed text-ink-300">
        {endpoint.summary}
      </p>

      {!endpoint.verified && (
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/5 p-3.5">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="text-[0.8rem] leading-relaxed text-ink-300">
            <strong className="font-medium text-warn">Path follows convention, not a published spec.</strong>{' '}
            This operation exists upstream, but we mirror its path from the naming pattern of its
            siblings. Confirm it against your account's reference before you ship against it — the
            request and response shapes below are correct either way.
          </p>
        </div>
      )}

      {endpoint.notes && endpoint.notes.length > 0 && (
        <ul className="mt-5 space-y-2">
          {endpoint.notes.map((n) => (
            <li key={n} className="flex gap-2.5 text-[0.82rem] leading-relaxed text-ink-400">
              <Icon name="info" className="mt-0.5 size-3.5 shrink-0 text-brand-400" />
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex gap-1 border-b border-ink-800">
        {([
          ['request', 'Request'],
          ['response', 'Response'],
          ['try', 'Try it'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cx(
              '-mb-px border-b-2 px-4 py-2.5 text-[0.85rem] font-medium transition-colors',
              tab === id
                ? 'border-brand-500 text-ink-50'
                : 'border-transparent text-ink-400 hover:text-ink-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'request' && (
          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] [&>*]:min-w-0">
            <ParamTable
              title="Body parameters"
              rows={endpoint.params.map((p) => ({
                name: p.name, type: p.type, desc: p.desc, required: p.required,
              }))}
            />
            <div>
              <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-500">
                Example request
              </p>
              <Code>{JSON.stringify(endpoint.exampleRequest, null, 2)}</Code>
            </div>
          </div>
        )}

        {tab === 'response' && (
          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] [&>*]:min-w-0">
            <ParamTable
              title="Response fields"
              rows={endpoint.fields.map((f) => ({ name: f.name, type: f.type, desc: f.desc }))}
            />
            <div>
              <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-500">
                Example response
              </p>
              <Code>{JSON.stringify(endpoint.exampleResponse, null, 2)}</Code>
            </div>
          </div>
        )}

        {tab === 'try' && <Playground endpoint={endpoint} />}
      </div>
    </div>
  )
}

function ParamTable({
  title, rows,
}: { title: string; rows: { name: string; type: string; desc: string; required?: boolean }[] }) {
  return (
    <div>
      <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-500">{title}</p>
      <div className="overflow-hidden rounded-xl border border-ink-700/70">
        <table className="w-full border-collapse text-left text-[0.8rem]">
          <tbody className="divide-y divide-ink-800">
            {rows.map((r) => (
              <tr key={r.name} className="align-top">
                <td className="w-[40%] px-4 py-3">
                  <code className="font-mono text-[0.78rem] text-brand-300">{r.name}</code>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[0.68rem] text-ink-500">{r.type}</span>
                    {r.required && (
                      <span className="rounded bg-danger/12 px-1.5 py-0.5 text-[0.62rem] font-medium text-danger">
                        required
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 leading-relaxed text-ink-300">{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------ playground ------------------------------ */

function Playground({ endpoint }: { endpoint: ApiEndpoint }) {
  const toast = useToast()
  const { user, meta } = useAuth()
  const [body, setBody] = useState(() => JSON.stringify(endpoint.exampleRequest, null, 2))
  const [result, setResult] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<{ code: number; ms: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBody(JSON.stringify(endpoint.exampleRequest, null, 2))
    setResult(null)
    setOutcome(null)
  }, [endpoint.id])

  const send = async () => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(body)
    } catch {
      toast('Request body is not valid JSON.', 'danger')
      return
    }
    setBusy(true)
    const started = performance.now()
    try {
      const envelope = await call(endpoint.path, parsed)
      setResult(JSON.stringify(envelope, null, 2))
      setOutcome({ code: envelope.code, ms: Math.round(performance.now() - started) })
    } catch (err) {
      setResult(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2))
      setOutcome({ code: 0, ms: Math.round(performance.now() - started) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-900/50 px-4 py-3">
        <Icon name={user ? 'bolt' : 'lock'} className="size-4 shrink-0 text-brand-300" />
        <p className="flex-1 text-[0.8rem] text-ink-300">
          {user
            ? <>Signed in as {user.name} — this runs against your own account
                {meta?.cloud.upstream ? <>, forwarded to <code className="font-mono text-ink-100">{API_BASE_URL}</code></> : ' on the MADOVA engine'}.</>
            : <>Sign in to run a call. The playground uses your session, so it only ever touches your own devices.</>}
        </p>
        <Link to={user ? '/console/api' : '/login'} className="text-[0.78rem] font-medium text-brand-300 hover:text-brand-200">
          {user ? 'API settings →' : 'Sign in →'}
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-500">
              Request body
            </span>
            <button
              onClick={() => setBody(JSON.stringify(endpoint.exampleRequest, null, 2))}
              className="text-[0.72rem] text-ink-400 hover:text-ink-100"
            >
              Reset
            </button>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            rows={14}
            aria-label="Request body"
            className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950 p-4 font-mono text-[0.78rem] leading-relaxed text-ink-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={send} disabled={busy || !user} icon={busy ? undefined : 'play'}>
              {busy ? 'Sending…' : !user ? 'Sign in to send' : `Send ${endpoint.method}`}
            </Button>
            <span className="font-mono text-[0.72rem] text-ink-500">{endpoint.path}</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-500">
              Response
            </span>
            {outcome && (
              <span className="flex items-center gap-2">
                <Badge tone={outcome.code === 200 ? 'ok' : 'danger'}>{outcome.code || 'error'}</Badge>
                <span className="font-mono text-[0.7rem] text-ink-500">{outcome.ms} ms</span>
              </span>
            )}
          </div>
          {result ? (
            <Code className="max-h-[24rem]">{result}</Code>
          ) : (
            <div className="grid h-[19rem] place-items-center rounded-xl border border-dashed border-ink-700 bg-ink-950/50 px-6 text-center">
              <div>
                <Icon name="terminal" className="mx-auto size-5 text-ink-600" />
                <p className="mt-3 text-[0.83rem] text-ink-400">Send the request to see the envelope.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- reference ------------------------------ */

function Reference() {
  const [lang, setLang] = useState('en')

  return (
    <div className="border-t border-ink-800 bg-ink-900/30">
      <Section>
        <SectionHeading
          eyebrow="Reference"
          title="Headers, limits and error codes"
          lead="The parts of an integration that are easy to get wrong and tedious to discover in production."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <Card className="p-7">
            <h3 className="text-[1rem] font-semibold text-ink-50">Request headers</h3>
            <dl className="mt-5 space-y-4">
              {[
                [API_KEY_HEADER, 'Your API key. Required on every call. Generated and rotated from Console → Automation → API.'],
                ['Content-Type', 'application/json — bodies are JSON objects, never form-encoded.'],
                ['Lang', 'Interface language for human-readable messages: zh, zh-TW, en or ru.'],
              ].map(([h, d]) => (
                <div key={h} className="border-b border-ink-800 pb-4 last:border-0 last:pb-0">
                  <dt className="font-mono text-[0.82rem] text-brand-300">{h}</dt>
                  <dd className="mt-1.5 text-[0.83rem] leading-relaxed text-ink-400">{d}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex items-center gap-3 border-t border-ink-800 pt-5">
              <span className="text-[0.8rem] text-ink-400">Preview the Lang header:</span>
              <Select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="!h-8 !w-auto !text-[0.78rem]"
              >
                <option value="en">en</option>
                <option value="zh">zh</option>
                <option value="zh-TW">zh-TW</option>
                <option value="ru">ru</option>
              </Select>
              <code className="font-mono text-[0.75rem] text-ink-500">Lang: {lang}</code>
            </div>
          </Card>

          <Card className="p-7">
            <h3 className="text-[1rem] font-semibold text-ink-50">Rate limiting</h3>
            <p className="mt-3 text-[0.85rem] leading-relaxed text-ink-400">
              Every endpoint permits {API_QPS_LIMIT} request per second. The limit is per endpoint,
              not per account, so a list call and a power-on call do not compete — but two list calls
              do.
            </p>
            <div className="mt-5 space-y-3">
              {[
                ['Serialise per endpoint', 'Queue calls to the same path rather than firing them in parallel.'],
                ['Batch instead of looping', 'Power actions and ADB take up to 20 device IDs per request. One call beats twenty.'],
                ['Back off on 429', 'Retry with exponential backoff and jitter. A tight retry loop stays rate-limited.'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-2.5">
                  <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-ok" strokeWidth={2.6} />
                  <p className="text-[0.82rem] leading-relaxed text-ink-300">
                    <strong className="font-medium text-ink-100">{t}.</strong> {d}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-lg bg-ink-950/60 p-3.5 text-[0.78rem] leading-relaxed text-ink-400 ring-1 ring-inset ring-ink-700">
              The MADOVA client in this site serialises calls through a single queue for exactly this
              reason — see <code className="font-mono text-brand-300">src/lib/duoplus/client.ts</code>.
            </p>
          </Card>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-700/70">
          <table className="w-full min-w-[42rem] border-collapse text-left text-[0.85rem]">
            <thead>
              <tr className="border-b border-ink-700/70 bg-ink-900/70 text-[0.72rem] uppercase tracking-wider text-ink-400">
                <th className="px-5 py-3.5 font-medium">code</th>
                <th className="px-5 py-3.5 font-medium">Meaning</th>
                <th className="px-5 py-3.5 font-medium">What to do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {ERROR_CODES.map((e) => (
                <tr key={e.code}>
                  <td className="px-5 py-3.5">
                    <Badge tone={e.code === '200' ? 'ok' : e.code === '500' ? 'danger' : 'warn'}>{e.code}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-ink-100">{e.meaning}</td>
                  <td className="px-5 py-3.5 text-ink-400">{e.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/console/api" icon="key">Generate an API key</ButtonLink>
          <ButtonLink to="/console" variant="outline" iconRight="arrowRight">Open the console</ButtonLink>
        </div>
      </Section>
    </div>
  )
}
