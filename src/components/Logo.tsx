import { Link } from 'react-router-dom'
import { cx } from './ui'

/** MADOVA mark: an "M" cut from a rounded phone silhouette. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="madova-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#857ffb" />
          <stop offset="55%" stopColor="#6d5ef8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="17" fill="url(#madova-mark)" />
      <rect x="19" y="9" width="26" height="46" rx="7" fill="#0e1220" opacity=".28" />
      <path
        d="M20 45V19h6.4l5.6 10.6L37.6 19H44v26h-6.2V31.3L32 41.6l-5.8-10.3V45z"
        fill="#fff"
      />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cx('group flex items-center gap-2.5', className)} aria-label="MADOVA home">
      <LogoMark className={compact ? 'size-7' : 'size-8'} />
      {!compact && (
        <span className="text-[1.05rem] font-semibold tracking-[0.13em] text-ink-50">MADOVA</span>
      )}
    </Link>
  )
}
