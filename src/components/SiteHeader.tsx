import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { Icon } from './Icon'
import { ButtonLink, Container, cx } from './ui'
import { NAV_FEATURES, SOLUTIONS } from '@/data/site'

const PANELS = {
  features: {
    heading: 'Everything a phone farm gave you, without the rack',
    items: NAV_FEATURES.map((f) => ({ label: f.title, desc: f.blurb, to: `/features#${f.slug}`, icon: f.icon })),
    footer: { label: 'See all capabilities', to: '/features' },
  },
  solutions: {
    heading: 'Built for teams that run a lot of accounts',
    items: SOLUTIONS.map((s) => ({ label: s.title, desc: s.audience, to: `/solutions#${s.slug}`, icon: 'layers' })),
    footer: { label: 'Browse every use case', to: '/solutions' },
  },
} as const

type PanelKey = keyof typeof PANELS

export function SiteHeader() {
  const [open, setOpen] = useState<PanelKey | null>(null)
  const [mobile, setMobile] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const location = useLocation()

  useEffect(() => {
    setOpen(null)
    setMobile(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (setOpen(null), setMobile(false))
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const hoverOpen = (key: PanelKey) => {
    window.clearTimeout(closeTimer.current)
    setOpen(key)
  }
  const hoverClose = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(null), 140)
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-[0.85rem] font-medium transition-colors',
      isActive ? 'text-ink-50' : 'text-ink-300 hover:text-ink-50')

  return (
    <header
      className={cx(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled || open ? 'glass border-ink-700/70' : 'border-transparent bg-transparent',
      )}
      onMouseLeave={hoverClose}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <Logo className="mr-4" />

            <nav className="hidden items-center lg:flex">
              {(Object.keys(PANELS) as PanelKey[]).map((key) => (
                <button
                  key={key}
                  onMouseEnter={() => hoverOpen(key)}
                  onFocus={() => hoverOpen(key)}
                  onClick={() => setOpen(open === key ? null : key)}
                  aria-expanded={open === key}
                  className={cx(
                    'flex items-center gap-1 rounded-lg px-3 py-2 text-[0.85rem] font-medium capitalize transition-colors',
                    open === key ? 'text-ink-50' : 'text-ink-300 hover:text-ink-50',
                  )}
                >
                  {key}
                  <Icon name="chevronDown" className={cx('size-3.5 transition-transform', open === key && 'rotate-180')} />
                </button>
              ))}
              <NavLink to="/pricing" className={linkCls}>Pricing</NavLink>
              <NavLink to="/knowledge" className={linkCls}>Help</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-lg px-3 py-2 text-[0.85rem] font-medium text-ink-300 transition-colors hover:text-ink-50 sm:block"
            >
              Sign in
            </Link>
            <ButtonLink to="/console" size="sm" className="hidden sm:inline-flex" iconRight="arrowRight">
              Open console
            </ButtonLink>
            <button
              onClick={() => setMobile((m) => !m)}
              className="rounded-lg p-2 text-ink-300 hover:bg-ink-800 hover:text-ink-50 lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobile}
            >
              <Icon name={mobile ? 'x' : 'menu'} className="size-5" />
            </button>
          </div>
        </div>
      </Container>

      {/* Desktop mega panel */}
      {open && (
        <div
          className="absolute inset-x-0 top-full hidden border-b border-ink-700/70 bg-ink-950/95 backdrop-blur-xl lg:block"
          onMouseEnter={() => window.clearTimeout(closeTimer.current)}
          onMouseLeave={hoverClose}
        >
          <Container>
            <div className="grid grid-cols-[15rem_1fr] gap-10 py-8">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-300">{open}</p>
                <p className="mt-3 text-pretty text-[0.95rem] leading-snug text-ink-200">{PANELS[open].heading}</p>
                <Link
                  to={PANELS[open].footer.to}
                  className="mt-5 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-brand-300 hover:text-brand-200"
                >
                  {PANELS[open].footer.label}
                  <Icon name="arrowRight" className="size-3.5" />
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-1 xl:grid-cols-3">
                {PANELS[open].items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-ink-800/70"
                    >
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-brand-300 transition-colors group-hover:bg-brand-500/15">
                        <Icon name={item.icon} className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.85rem] font-medium text-ink-100">{item.label}</span>
                        <span className="mt-0.5 block line-clamp-2 text-[0.75rem] leading-snug text-ink-400">{item.desc}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </div>
      )}

      {/* Mobile drawer */}
      {mobile && (
        <div className="border-t border-ink-700/70 bg-ink-950 lg:hidden">
          <Container className="py-5">
            <nav className="flex flex-col gap-1">
              {[
                { label: 'Features', to: '/features' },
                { label: 'Solutions', to: '/solutions' },
                { label: 'Pricing', to: '/pricing' },
                { label: 'Help centre', to: '/knowledge' },
                { label: 'Download', to: '/download' },
                { label: 'Contact', to: '/contact' },
              ].map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) => cx(
                    'rounded-lg px-3 py-2.5 text-[0.9rem] font-medium',
                    isActive ? 'bg-ink-800 text-ink-50' : 'text-ink-300',
                  )}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-5 flex gap-2">
              <ButtonLink to="/login" variant="secondary" className="flex-1">Sign in</ButtonLink>
              <ButtonLink to="/console" className="flex-1">Open console</ButtonLink>
            </div>
          </Container>
        </div>
      )}
    </header>
  )
}
