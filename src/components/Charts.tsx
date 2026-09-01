import { useId, useMemo, useState } from 'react'
import { cx } from './ui'

/* Chart palette — brand-led, distinguishable in a single hue family. */
export const SERIES_COLORS = ['#6d5ef8', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a3a8ff']

/** Area chart with a hover readout. Pure SVG, no chart library. */
export function AreaChart({
  data, height = 200, valueFormat = (n: number) => String(n), label = 'value',
}: {
  data: { label: string; value: number }[]
  height?: number
  valueFormat?: (n: number) => string
  label?: string
}) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const { points, linePath, area, max, min } = useMemo(() => {
    const values = data.map((d) => d.value)
    const max = Math.max(...values) * 1.08
    const min = Math.min(...values) * 0.92
    const span = max - min || 1
    const step = data.length > 1 ? 100 / (data.length - 1) : 0
    const pts = data.map((d, i) => ({
      x: i * step,
      y: 100 - ((d.value - min) / span) * 100,
    }))
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    return { points: pts, linePath, area: `${linePath} L100,100 L0,100 Z`, max, min }
  }, [data])

  const active = hover ?? data.length - 1

  return (
    <div className="relative">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="font-mono text-lg font-semibold text-ink-50">{valueFormat(data[active].value)}</span>
        <span className="text-[0.72rem] text-ink-500">
          {label} · day {data[active].label}
        </span>
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${label} over ${data.length} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))))
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d5ef8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6d5ef8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#272d4a" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="#857ffb" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover !== null && (
          <line
            x1={points[hover].x} y1="0" x2={points[hover].x} y2="100"
            stroke="#6d5ef8" strokeWidth="0.8" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
          />
        )}
        <circle
          cx={points[active].x}
          cy={points[active].y}
          r="1.6"
          fill="#22d3ee"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-2 flex justify-between font-mono text-[0.62rem] text-ink-600">
        <span>{valueFormat(Math.round(min))}</span>
        <span>{valueFormat(Math.round(max))}</span>
      </div>
    </div>
  )
}

/** Donut for a small categorical breakdown, with an inline legend. */
export function Donut({
  data, size = 168, centerLabel, centerValue,
}: {
  data: { label: string; value: number; color?: string }[]
  size?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="-rotate-90" role="img" aria-label="Breakdown">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1a1f38" strokeWidth="12" />
          {data.map((d, i) => {
            const length = (d.value / total) * circumference
            const dash = `${length} ${circumference - length}`
            const el = (
              <circle
                key={d.label}
                cx="50" cy="50" r={radius}
                fill="none"
                stroke={d.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth="12"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += length
            return el
          })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="font-mono text-xl font-semibold text-ink-50">{centerValue}</span>
            <span className="mt-0.5 text-[0.68rem] text-ink-500">{centerLabel}</span>
          </div>
        )}
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2.5">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: d.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-[0.8rem] text-ink-300">{d.label}</span>
            <span className="shrink-0 font-mono text-[0.78rem] text-ink-100">{d.value}</span>
            <span className="w-10 shrink-0 text-right font-mono text-[0.7rem] text-ink-500">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Horizontal bars for ranked lists (regions, groups, packages). */
export function BarList({
  data, valueFormat = (n: number) => String(n),
}: { data: { label: string; value: number }[]; valueFormat?: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value)) || 1
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[0.8rem] text-ink-300">{d.label}</span>
            <span className="shrink-0 font-mono text-[0.76rem] text-ink-100">{valueFormat(d.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className={cx('h-full rounded-full transition-[width] duration-500')}
              style={{
                width: `${(d.value / max) * 100}%`,
                background: SERIES_COLORS[i % SERIES_COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Compact 7×N activity heatmap. */
export function Heatmap({ weeks = 14 }: { weeks?: number }) {
  const cells = useMemo(
    () => Array.from({ length: weeks * 7 }, (_, i) => (Math.sin(i * 1.7) + Math.cos(i / 3.1) + 2) / 4),
    [weeks],
  )
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1" aria-hidden="true">
      {cells.map((v, i) => (
        <span
          key={i}
          className="size-2.5 rounded-[2px]"
          style={{ background: `color-mix(in srgb, #6d5ef8 ${Math.round(v * 90) + 6}%, #141829)` }}
        />
      ))}
    </div>
  )
}
