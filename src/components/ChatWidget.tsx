import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { Badge, Button, cx, useToast } from './ui'
import { api, ApiError, type Order, type ThreadMessage } from '@/lib/api'
import { accountChanged, useAuth } from '@/lib/auth'

const GUEST_KEY = 'madova.guest'

function guestKey(): string {
  try {
    let key = localStorage.getItem(GUEST_KEY)
    if (!key) {
      key = `g_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
      localStorage.setItem(GUEST_KEY, key)
    }
    return key
  } catch {
    /* Private browsing — the thread just won't survive a reload. */
    return `g_ephemeral_${Math.random().toString(36).slice(2)}`
  }
}

interface Bubble extends ThreadMessage {
  streaming?: boolean
}

const SUGGESTIONS_SIGNED_IN = [
  'How many devices do I have?',
  'Restart my first powered-off device',
  'Buy 3 phones in Germany for 90 days',
  'How does billing work?',
]

const SUGGESTIONS_GUEST = [
  'What is a cloud phone?',
  'How much does it cost?',
  'Do you support ADB?',
  'How does reselling work?',
]

export function ChatWidget() {
  const toast = useToast()
  const { user, meta, refresh } = useAuth()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Bubble[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [tools, setTools] = useState<{ name: string; summary: string; ok: boolean }[]>([])
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)
  const [loaded, setLoaded] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const key = useRef(guestKey())

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  /* Load the thread the first time the panel is opened, not on every page load. */
  useEffect(() => {
    if (!open || loaded) return
    setLoaded(true)
    api.thread(key.current)
      .then((d) => {
        setMessages(d.thread.messages.filter((m) => m.role !== 'system'))
        scrollToEnd()
      })
      .catch(() => {})
  }, [open, loaded, scrollToEnd])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setInput('')
    setTools([])
    setPendingOrder(null)
    setMessages((m) => [
      ...m,
      { id: `local_${Date.now()}`, role: 'user', text: trimmed, at: '' },
      { id: `stream_${Date.now()}`, role: 'assistant', text: '', at: '', streaming: true },
    ])
    scrollToEnd()
    setBusy(true)

    try {
      const res = await fetch('/api/assistant/message', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, guest_key: key.current }),
      })
      if (!res.ok || !res.body) throw new Error(`The assistant is unavailable (${res.status}).`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      /* Parse the SSE frames as they arrive so tool activity shows live. */
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let split: number
        while ((split = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, split)
          buffer = buffer.slice(split + 2)

          const eventLine = frame.split('\n').find((l) => l.startsWith('event: '))
          const dataLine = frame.split('\n').find((l) => l.startsWith('data: '))
          if (!eventLine || !dataLine) continue

          const event = eventLine.slice(7).trim()
          let payload: any
          try {
            payload = JSON.parse(dataLine.slice(6))
          } catch {
            continue
          }

          if (event === 'text') {
            setMessages((m) => {
              const next = [...m]
              const last = next[next.length - 1]
              if (last?.streaming) next[next.length - 1] = { ...last, text: last.text + payload.delta }
              return next
            })
            scrollToEnd()
          } else if (event === 'tool') {
            setTools((t) => [...t, payload])
            scrollToEnd()
          } else if (event === 'order') {
            setPendingOrder(payload.order)
          } else if (event === 'done') {
            setMessages((m) => {
              const next = [...m]
              next[next.length - 1] = { ...payload.message, streaming: false }
              return next
            })
            if (payload.pending_order) setPendingOrder(payload.pending_order)
            accountChanged()
            scrollToEnd()
          } else if (event === 'error') {
            throw new Error(payload.message)
          }
        }
      }
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error
        ? err.message
        : 'The assistant could not reply.'
      setMessages((m) => {
        const next = [...m]
        const last = next[next.length - 1]
        if (last?.streaming) next[next.length - 1] = { ...last, text: message, streaming: false }
        return next
      })
      toast(message, 'danger')
    } finally {
      setBusy(false)
      scrollToEnd()
    }
  }

  const approveOrder = async () => {
    if (!pendingOrder) return
    try {
      const paid = await api.payOrder(pendingOrder.id)
      toast(paid.provisioned.length
        ? `Order paid — ${paid.provisioned.length} device(s) provisioned.`
        : 'Order paid.', 'ok')
      setPendingOrder(null)
      setMessages((m) => [...m, {
        id: `local_${Date.now()}`,
        role: 'agent',
        text: paid.provisioned.length
          ? `Order approved. ${paid.provisioned.length} device${paid.provisioned.length === 1 ? '' : 's'} provisioned onto your account.`
          : 'Order approved and applied.',
        at: '',
      }])
      accountChanged()
      await refresh()
      scrollToEnd()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not complete the order.', 'danger')
    }
  }

  const suggestions = user ? SUGGESTIONS_SIGNED_IN : SUGGESTIONS_GUEST
  const fallbackMode = meta ? !meta.assistant.configured : false

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
        className={cx(
          'fixed bottom-5 right-5 z-[55] flex size-14 items-center justify-center rounded-full shadow-2xl transition-all duration-200',
          open
            ? 'bg-ink-800 text-ink-200 ring-1 ring-ink-700'
            : 'bg-brand-500 text-white shadow-brand-500/40 hover:scale-105 hover:bg-brand-400',
        )}
      >
        <Icon name={open ? 'x' : 'message'} className="size-6" />
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5">
            <span className="absolute inline-flex size-full animate-pulse-dot rounded-full bg-accent-400/80" />
            <span className="relative inline-flex size-3.5 rounded-full border-2 border-ink-950 bg-accent-400" />
          </span>
        )}
      </button>

      {/* panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[54] flex h-[min(34rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-800 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                  <Icon name="sparkle" className="size-3.5" />
                </span>
                <h2 className="truncate text-[0.9rem] font-semibold text-ink-50">MADOVA assistant</h2>
              </div>
              <p className="mt-1 text-[0.68rem] text-ink-500">
                {user
                  ? 'Connected to your account — it can act on your devices.'
                  : 'Ask anything. Sign in to let it act on your fleet.'}
              </p>
            </div>
            {fallbackMode
              ? <Badge tone="warn">Basic mode</Badge>
              : meta?.assistant.provider_label
                ? <Badge tone="brand">{meta.assistant.provider_label}</Badge>
                : null}
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="pb-2">
                <p className="text-[0.83rem] leading-relaxed text-ink-300">
                  Hello. I can answer questions about MADOVA and, once you are signed in, actually
                  work on your fleet — power devices, restart them, change settings, prepare orders.
                </p>
                {fallbackMode && (
                  <p className="mt-3 rounded-lg border border-warn/30 bg-warn/5 p-2.5 text-[0.74rem] leading-relaxed text-ink-300">
                    No model provider is configured on this server, so I am running the basic
                    intent router. Commands still work; conversation is limited.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-left text-[0.74rem] text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={m.id + i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cx(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.83rem] leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-md bg-brand-500 text-white'
                      : m.role === 'agent'
                        ? 'rounded-bl-md bg-ok/10 text-ok ring-1 ring-inset ring-ok/25'
                        : 'rounded-bl-md bg-ink-800 text-ink-100',
                  )}
                >
                  {m.text || (m.streaming ? <TypingDots /> : null)}
                  {m.actions && m.actions.length > 0 && (
                    <ul className="mt-2.5 space-y-1 border-t border-ink-700/70 pt-2">
                      {m.actions.map((a, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-[0.7rem] text-ink-400">
                          <Icon name={a.ok ? 'check' : 'alert'} className={cx('mt-0.5 size-3 shrink-0', a.ok ? 'text-ok' : 'text-warn')} />
                          {a.summary}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}

            {busy && tools.length > 0 && (
              <ul className="space-y-1">
                {tools.map((t, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-[0.7rem] text-ink-500">
                    <Icon name={t.ok ? 'check' : 'alert'} className={cx('size-3 shrink-0', t.ok ? 'text-ok' : 'text-warn')} />
                    {t.summary}
                  </li>
                ))}
              </ul>
            )}

            {pendingOrder && (
              <div className="rounded-xl border border-brand-500/40 bg-brand-500/[0.06] p-3.5">
                <p className="text-[0.78rem] font-medium text-ink-100">Approve this order?</p>
                <ul className="mt-2 space-y-1">
                  {pendingOrder.lines.map((l) => (
                    <li key={l.description} className="text-[0.74rem] text-ink-300">{l.description}</li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-[1.05rem] font-semibold text-ink-50">
                  ${(pendingOrder.total_cents / 100).toFixed(2)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => void approveOrder()}>Approve &amp; pay</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void api.cancelOrder(pendingOrder.id).catch(() => {})
                      setPendingOrder(null)
                    }}
                  >
                    Not now
                  </Button>
                </div>
                <p className="mt-2 text-[0.66rem] leading-relaxed text-ink-500">
                  Nothing is charged until you approve. The assistant cannot complete this itself.
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-ink-800 p-3">
            {!user && (
              <p className="mb-2 text-[0.7rem] text-ink-500">
                <Link to="/login" className="text-brand-300 hover:text-brand-200">Sign in</Link>{' '}
                to let the assistant control your devices.
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                placeholder={user ? 'Ask, or tell me what to do…' : 'Ask about MADOVA…'}
                className="max-h-24 min-h-10 flex-1 resize-none rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5 text-[0.83rem] text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              />
              <button
                onClick={() => void send(input)}
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500"
              >
                <Icon name={busy ? 'clock' : 'arrowRight'} className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="The assistant is replying">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse-dot rounded-full bg-ink-400"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  )
}
