import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './ui'

/** Hardware bezel used for hero art, the fleet grid and the console mirror. */
export function PhoneFrame({
  children, className, label, tone = 'default',
}: {
  children?: ReactNode; className?: string; label?: string
  tone?: 'default' | 'off' | 'busy'
}) {
  return (
    <div className={cx('relative', className)}>
      <div
        className={cx(
          'relative overflow-hidden rounded-[1.6rem] border border-ink-700 bg-ink-950 p-1.5 shadow-2xl',
          tone === 'busy' && 'border-brand-500/50',
        )}
      >
        <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[1.15rem] bg-ink-900">
          {/* status bar */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-1.5 text-[0.5rem] font-medium text-ink-300">
            <span>9:41</span>
            <span className="absolute left-1/2 top-1 h-3 w-10 -translate-x-1/2 rounded-full bg-ink-950" />
            <span className="flex items-center gap-0.5">
              <span className="inline-block h-1.5 w-1 rounded-sm bg-current opacity-50" />
              <span className="inline-block h-2 w-1 rounded-sm bg-current opacity-70" />
              <span className="inline-block h-2.5 w-1 rounded-sm bg-current" />
              <span className="ml-1 inline-block h-2 w-3.5 rounded-[2px] border border-current" />
            </span>
          </div>
          {tone === 'off' ? (
            <div className="grid h-full place-items-center bg-ink-950">
              <Icon name="power" className="size-6 text-ink-700" />
            </div>
          ) : (
            children ?? <AndroidHome />
          )}
          {/* gesture bar */}
          <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
            <span className="h-1 w-1/3 rounded-full bg-ink-500/70" />
          </div>
        </div>
      </div>
      {label && (
        <p className="mt-2 truncate text-center font-mono text-[0.65rem] text-ink-500">{label}</p>
      )}
    </div>
  )
}

const APP_TILES = [
  { name: 'TikTok', cls: 'bg-gradient-to-br from-[#25f4ee] to-[#fe2c55]' },
  { name: 'IG', cls: 'bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]' },
  { name: 'FB', cls: 'bg-[#1877f2]' },
  { name: 'WA', cls: 'bg-[#25d366]' },
  { name: 'TG', cls: 'bg-[#2aabee]' },
  { name: 'X', cls: 'bg-ink-800' },
  { name: 'YT', cls: 'bg-[#ff0033]' },
  { name: 'MM', cls: 'bg-gradient-to-br from-[#f6851b] to-[#e2761b]' },
  { name: 'Shp', cls: 'bg-[#ee4d2d]' },
  { name: 'Ply', cls: 'bg-gradient-to-br from-[#00d2ff] to-[#3a7bd5]' },
  { name: 'Cam', cls: 'bg-ink-700' },
  { name: 'Set', cls: 'bg-ink-700' },
]

/** Stylised Android home screen — deliberately abstract, no real logos. */
export function AndroidHome() {
  return (
    <div className="flex h-full flex-col bg-[radial-gradient(120%_90%_at_50%_0%,#2a2350_0%,#121629_55%,#0b0e1b_100%)] px-3 pb-6 pt-7">
      <div className="mb-3 text-center">
        <p className="text-[1.1rem] font-light leading-none text-white/90">9:41</p>
        <p className="mt-0.5 text-[0.45rem] text-white/50">Mon, 1 September</p>
      </div>
      <div className="grid flex-1 grid-cols-4 content-start gap-x-2 gap-y-3">
        {APP_TILES.map((a) => (
          <div key={a.name} className="flex flex-col items-center gap-1">
            <div className={cx('grid aspect-square w-full place-items-center rounded-[0.5rem] text-[0.4rem] font-bold text-white/90 shadow-sm', a.cls)}>
              {a.name}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-around rounded-xl bg-white/8 px-2 py-1.5 backdrop-blur">
        {APP_TILES.slice(0, 4).map((a) => (
          <div key={a.name} className={cx('size-4 rounded-[0.3rem]', a.cls)} />
        ))}
      </div>
    </div>
  )
}
