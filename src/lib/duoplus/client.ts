/**
 * Cloud phone client.
 *
 * Every device call goes to the MADOVA API server, which decides whether it
 * resolves against the local engine or the real upstream OpenAPI and attaches
 * the key. The browser holds no credentials, so there is nothing here to leak.
 *
 * The request shape below still mirrors the upstream contract exactly — path,
 * JSON body and the `{ code, data, message }` envelope — so the same calls work
 * against either backend.
 */
import type { ApiEnvelope } from './types'

export type Lang = 'en' | 'zh' | 'zh-TW' | 'ru'

export interface RequestLogEntry {
  id: number
  at: string
  path: string
  ms: number
  code: number
  ok: boolean
}

const log: RequestLogEntry[] = []
let logSeq = 0

export function getRequestLog(): RequestLogEntry[] {
  return log
}

function record(entry: Omit<RequestLogEntry, 'id'>) {
  log.unshift({ id: ++logSeq, ...entry })
  if (log.length > 40) log.pop()
  window.dispatchEvent(new CustomEvent('madova:request'))
}

const LANG_KEY = 'madova.lang'

export function getLang(): Lang {
  try {
    return (localStorage.getItem(LANG_KEY) as Lang) || 'en'
  } catch {
    return 'en'
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* private browsing — the preference just doesn't persist */
  }
  window.dispatchEvent(new CustomEvent('madova:settings'))
}

export class ApiError extends Error {
  constructor(public code: number, message: string, public path: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * The upstream API allows 1 QPS per endpoint. The server enforces that for
 * forwarded traffic; serialising here as well keeps a busy console from
 * queueing a burst it will only have to wait out.
 */
const MIN_SPACING_MS = 60
let chain: Promise<unknown> = Promise.resolve()

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task)
  chain = next.then(
    () => new Promise((r) => setTimeout(r, MIN_SPACING_MS)),
    () => new Promise((r) => setTimeout(r, MIN_SPACING_MS)),
  )
  return next
}

/** Issue a call and return the raw envelope. */
export async function call<T = unknown>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<ApiEnvelope<T>> {
  return serialise(async () => {
    const started = performance.now()
    let envelope: ApiEnvelope<T>
    try {
      const res = await fetch('/api/cloud', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, body, lang: getLang() }),
      })
      envelope = (await res.json()) as ApiEnvelope<T>
    } catch (err) {
      record({ at: new Date().toLocaleTimeString(), path, ms: Math.round(performance.now() - started), code: 0, ok: false })
      throw new ApiError(0, err instanceof Error ? err.message : 'Network error', path)
    }

    record({
      at: new Date().toLocaleTimeString(),
      path,
      ms: Math.round(performance.now() - started),
      code: envelope.code,
      ok: envelope.code === 200,
    })
    return envelope
  })
}

/** Issue a call and unwrap `data`, throwing `ApiError` on a non-200 code. */
export async function callData<T = unknown>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const envelope = await call<T>(path, body)
  if (envelope.code !== 200) throw new ApiError(envelope.code, envelope.message || 'Request failed', path)
  return envelope.data
}
