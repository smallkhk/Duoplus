import { Link } from 'react-router-dom'
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react'
import { Icon } from './Icon'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

/* ------------------------------- layout -------------------------------- */

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-[76rem] px-5 sm:px-8', className)}>{children}</div>
}

export function Section({
  children, className, id,
}: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx('py-20 sm:py-28', className)}>
      <Container>{children}</Container>
    </section>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300">
      <span className="h-px w-6 bg-brand-400/60" />
      {children}
    </p>
  )
}

export function SectionHeading({
  eyebrow, title, lead, align = 'left',
}: { eyebrow?: string; title: ReactNode; lead?: ReactNode; align?: 'left' | 'center' }) {
  return (
    <div className={cx('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <p className={cx(
          'mb-4 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300',
          align === 'center' && 'justify-center',
        )}>
          <span className="h-px w-6 bg-brand-400/60" />
          {eyebrow}
        </p>
      )}
      <h2 className="text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-ink-50 sm:text-[2.6rem]">
        {title}
      </h2>
      {lead && <p className="mt-5 text-pretty text-base leading-relaxed text-ink-300 sm:text-lg">{lead}</p>}
    </div>
  )
}

/* ------------------------------- buttons ------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-[0_10px_30px_-12px] shadow-brand-500/70 hover:bg-brand-400 active:bg-brand-600 disabled:bg-brand-500/40',
  secondary:
    'bg-ink-800 text-ink-50 ring-1 ring-inset ring-ink-700 hover:bg-ink-700 hover:ring-ink-600 disabled:opacity-50',
  outline:
    'text-ink-100 ring-1 ring-inset ring-ink-700 hover:bg-ink-800/70 hover:ring-ink-600 disabled:opacity-50',
  ghost: 'text-ink-300 hover:bg-ink-800/70 hover:text-ink-50 disabled:opacity-50',
  danger: 'bg-danger/15 text-danger ring-1 ring-inset ring-danger/35 hover:bg-danger/25 disabled:opacity-50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[0.8rem]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-[0.95rem]',
}

const BUTTON_BASE =
  'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed'

export function Button({
  variant = 'primary', size = 'md', icon, iconRight, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: Size; icon?: string; iconRight?: string
}) {
  return (
    <button className={cx(BUTTON_BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {icon && <Icon name={icon} className="size-4 shrink-0" />}
      {children}
      {iconRight && <Icon name={iconRight} className="size-4 shrink-0" />}
    </button>
  )
}

export function ButtonLink({
  to, variant = 'primary', size = 'md', icon, iconRight, className, children,
}: {
  to: string; variant?: Variant; size?: Size; icon?: string; iconRight?: string
  className?: string; children: ReactNode
}) {
  const cls = cx(BUTTON_BASE, VARIANTS[variant], SIZES[size], className)
  const body = (
    <>
      {icon && <Icon name={icon} className="size-4 shrink-0" />}
      {children}
      {iconRight && <Icon name={iconRight} className="size-4 shrink-0" />}
    </>
  )
  if (to.startsWith('http')) {
    return <a href={to} className={cls} target="_blank" rel="noreferrer">{body}</a>
  }
  return <Link to={to} className={cls}>{body}</Link>
}

/* -------------------------------- cards -------------------------------- */

export function Card({
  className, children, as: As = 'div', hover = false,
}: { className?: string; children: ReactNode; as?: 'div' | 'article' | 'li'; hover?: boolean }) {
  return (
    <As className={cx(
      'rounded-2xl border border-ink-700/70 bg-ink-900/60 ring-hairline',
      hover && 'transition-colors duration-200 hover:border-brand-500/45 hover:bg-ink-850/80',
      className,
    )}>
      {children}
    </As>
  )
}

export function Badge({
  children, tone = 'neutral', className,
}: { children: ReactNode; tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'accent'; className?: string }) {
  const tones = {
    neutral: 'bg-ink-800 text-ink-300 ring-ink-700',
    brand: 'bg-brand-500/12 text-brand-300 ring-brand-500/30',
    accent: 'bg-accent-400/12 text-accent-300 ring-accent-400/30',
    ok: 'bg-ok/12 text-ok ring-ok/30',
    warn: 'bg-warn/12 text-warn ring-warn/30',
    danger: 'bg-danger/12 text-danger ring-danger/30',
  }
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ring-1 ring-inset',
      tones[tone], className,
    )}>
      {children}
    </span>
  )
}

export function Dot({ tone }: { tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'brand' }) {
  const tones = {
    ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', neutral: 'bg-ink-400', brand: 'bg-brand-400',
  }
  return <span className={cx('inline-block size-1.5 shrink-0 rounded-full', tones[tone])} />
}

/* -------------------------------- forms -------------------------------- */

export function Field({
  label, hint, children, className,
}: { label?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-[0.78rem] font-medium text-ink-300">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[0.72rem] text-ink-500">{hint}</span>}
    </label>
  )
}

const CONTROL =
  'w-full rounded-lg border border-ink-700 bg-ink-950/70 px-3 text-sm text-ink-50 placeholder:text-ink-500 ' +
  'transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, 'h-10', className)} {...rest} />
}

export function Textarea({
  className, ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(CONTROL, 'py-2.5 leading-relaxed', className)} {...rest} />
}

export function Select({
  className, children, ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="relative">
      <select className={cx(CONTROL, 'h-10 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
    </div>
  )
}

export function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand-500' : 'bg-ink-700',
      )}
    >
      <span className={cx(
        'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
        checked ? 'translate-x-[1.4rem]' : 'translate-x-0.5',
      )} />
    </button>
  )
}

export function Checkbox({
  checked, indeterminate = false, onChange, label,
}: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'grid size-4 shrink-0 place-items-center rounded border transition-colors',
        checked || indeterminate
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-ink-600 bg-ink-950 hover:border-ink-500',
      )}
    >
      {indeterminate
        ? <Icon name="minus" className="size-3" strokeWidth={3} />
        : checked && <Icon name="check" className="size-3" strokeWidth={3} />}
    </button>
  )
}

/* ------------------------------ disclosure ----------------------------- */

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="divide-y divide-ink-700/70 border-y border-ink-700/70">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-start justify-between gap-6 py-5 text-left"
            >
              <span className={cx('text-[0.98rem] font-medium transition-colors', isOpen ? 'text-ink-50' : 'text-ink-200')}>
                {item.q}
              </span>
              <Icon
                name="chevronDown"
                className={cx('mt-0.5 size-4 shrink-0 text-ink-400 transition-transform duration-200', isOpen && 'rotate-180 text-brand-300')}
              />
            </button>
            <div className={cx('grid transition-all duration-300', isOpen ? 'grid-rows-[1fr] pb-6' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <p className="max-w-2xl text-pretty text-sm leading-relaxed text-ink-300">{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs, value, onChange, className,
}: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto rounded-xl bg-ink-900/70 p-1 ring-1 ring-inset ring-ink-700/70', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[0.82rem] font-medium transition-colors',
            value === t.id ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:text-ink-100',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx(
              'rounded px-1.5 py-0.5 text-[0.68rem] tabular-nums',
              value === t.id ? 'bg-ink-600 text-ink-100' : 'bg-ink-800 text-ink-400',
            )}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------- modal -------------------------------- */

export function Modal({
  open, onClose, title, description, children, footer, wide = false,
}: {
  open: boolean; onClose: () => void; title: string; description?: string
  children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative max-h-[88vh] w-full overflow-hidden rounded-t-2xl border border-ink-700 bg-ink-900 shadow-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-700/70 px-6 py-4">
          <div>
            <h3 id={titleId} className="text-base font-semibold text-ink-50">{title}</h3>
            {description && <p className="mt-1 text-[0.82rem] text-ink-400">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <Icon name="x" className="size-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-700/70 bg-ink-950/40 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/* -------------------------------- toasts ------------------------------- */

interface Toast { id: number; text: string; tone: 'ok' | 'danger' | 'info' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const icons = { ok: 'check', danger: 'alert', info: 'info' } as const
  const tones = {
    ok: 'text-ok border-ok/30', danger: 'text-danger border-danger/30', info: 'text-brand-300 border-brand-500/30',
  }

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'animate-rise pointer-events-auto flex items-start gap-3 rounded-xl border bg-ink-900/95 px-4 py-3 shadow-xl backdrop-blur',
              tones[t.tone],
            )}
          >
            <Icon name={icons[t.tone]} className="mt-0.5 size-4 shrink-0" />
            <p className="text-[0.83rem] leading-snug text-ink-100">{t.text}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* --------------------------------- code -------------------------------- */

/** Minimal JSON highlighter — enough colour to read a payload, no dependency. */
export function Code({ children, className }: { children: string; className?: string }) {
  const html = useMemo(() => {
    const escaped = children
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return escaped.replace(
      /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g,
      (m, key, str, num, lit) => {
        if (key) return `<span class="text-brand-300">${key}</span>`
        if (str) return `<span class="text-ok">${str}</span>`
        if (num) return `<span class="text-accent-300">${num}</span>`
        if (lit) return `<span class="text-warn">${lit}</span>`
        return m
      },
    )
  }, [children])

  return (
    <pre className={cx('overflow-x-auto rounded-xl border border-ink-700/70 bg-ink-950 p-4 font-mono text-[0.78rem] leading-relaxed text-ink-200', className)}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => { setDone(true); setTimeout(() => setDone(false), 1600) },
          () => {},
        )
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.72rem] font-medium text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
    >
      <Icon name={done ? 'check' : 'copy'} className="size-3.5" />
      {done ? 'Copied' : label}
    </button>
  )
}

/* ------------------------------- feedback ------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-ink-800/80', className)} />
}

export function EmptyState({
  icon = 'search', title, body, action,
}: { icon?: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-ink-800 text-ink-400">
        <Icon name={icon} className="size-5" />
      </div>
      <p className="text-sm font-medium text-ink-100">{title}</p>
      <p className="mt-1.5 max-w-sm text-[0.82rem] leading-relaxed text-ink-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
