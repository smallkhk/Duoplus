import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo, LogoMark } from './Logo'
import { Icon } from './Icon'
import { Badge, Input, cx } from './ui'
import { getSettings } from '@/lib/duoplus/client'

const NAV: { section: string; items: { to: string; label: string; icon: string; end?: boolean }[] }[] = [
  {
    section: 'Fleet',
    items: [
      { to: '/console', label: 'Overview', icon: 'grid', end: true },
      { to: '/console/phones', label: 'Cloud phones', icon: 'phone' },
      { to: '/console/groups', label: 'Groups', icon: 'layers' },
      { to: '/console/proxies', label: 'Proxies', icon: 'route' },
    ],
  },
  {
    section: 'Content',
    items: [
      { to: '/console/apps', label: 'Applications', icon: 'drive' },
      { to: '/console/files', label: 'Cloud drive', icon: 'upload' },
      { to: '/console/numbers', label: 'Cloud numbers', icon: 'message' },
    ],
  },
  {
    section: 'Automation',
    items: [
      { to: '/console/automation', label: 'Tasks & RPA', icon: 'workflow' },
      { to: '/console/api', label: 'API', icon: 'key' },
    ],
  },
  {
    section: 'Account',
    items: [
      { to: '/console/resellers', label: 'Sub-accounts', icon: 'building' },
      { to: '/console/team', label: 'Team', icon: 'users' },
      { to: '/console/billing', label: 'Billing', icon: 'wallet' },
      { to: '/console/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [live, setLive] = useState(() => {
    const s = getSettings()
    return s.live && !!s.apiKey
  })
  const location = useLocation()

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    const sync = () => {
      const s = getSettings()
      setLive(s.live && !!s.apiKey)
    }
    window.addEventListener('madova:settings', sync)
    return () => window.removeEventListener('madova:settings', sync)
  }, [])

  return (
    <div className="flex min-h-dvh bg-ink-950">
      {/* sidebar */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-ink-800 bg-ink-900/60 transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          collapsed ? 'w-[4.5rem]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={cx('flex h-16 shrink-0 items-center border-b border-ink-800', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
          {collapsed ? (
            <Link to="/" aria-label="MADOVA home"><LogoMark className="size-7" /></Link>
          ) : (
            <Logo compact={false} />
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-200 lg:block"
              aria-label="Collapse sidebar"
            >
              <Icon name="chevronLeft" className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-3 rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-200"
            aria-label="Expand sidebar"
          >
            <Icon name="chevronRight" className="size-4" />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.section} className="mb-5">
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ink-600">
                  {group.section}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) => cx(
                        'flex items-center gap-3 rounded-lg py-2 text-[0.83rem] font-medium transition-colors',
                        collapsed ? 'justify-center px-2' : 'px-3',
                        isActive
                          ? 'bg-brand-500/15 text-brand-200'
                          : 'text-ink-400 hover:bg-ink-800/70 hover:text-ink-100',
                      )}
                    >
                      <Icon name={item.icon} className="size-4 shrink-0" />
                      {!collapsed && item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={cx('shrink-0 border-t border-ink-800 p-3', collapsed && 'px-2')}>
          {!collapsed ? (
            <div className="rounded-xl bg-ink-950/70 p-3.5 ring-1 ring-inset ring-ink-800">
              <div className="flex items-center justify-between">
                <span className="text-[0.72rem] font-medium text-ink-300">Trial</span>
                <Badge tone="warn">21 days left</Badge>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                <div className="h-full w-[30%] rounded-full bg-gradient-to-r from-brand-500 to-accent-400" />
              </div>
              <Link
                to="/console/billing"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-1.5 text-[0.76rem] font-medium text-white transition-colors hover:bg-brand-400"
              >
                Upgrade
                <Icon name="arrowRight" className="size-3" />
              </Link>
            </div>
          ) : (
            <Link
              to="/console/billing"
              className="grid size-10 place-items-center rounded-lg bg-brand-500/15 text-brand-300 hover:bg-brand-500/25"
              title="Upgrade"
            >
              <Icon name="bolt" className="size-4" />
            </Link>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-ink-950/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-950/85 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Icon name="menu" className="size-5" />
          </button>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
            <Input placeholder="Search phones, groups, proxies…" className="!h-9 pl-9" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/console/api"
              className={cx(
                'hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.74rem] font-medium ring-1 ring-inset transition-colors sm:flex',
                live
                  ? 'bg-ok/10 text-ok ring-ok/30 hover:bg-ok/15'
                  : 'bg-ink-900 text-ink-400 ring-ink-700 hover:text-ink-200',
              )}
              title={live ? 'Calls go to the live API' : 'Calls are answered by the sandbox fleet'}
            >
              <span className={cx('size-1.5 rounded-full', live ? 'animate-pulse-dot bg-ok' : 'bg-ink-500')} />
              {live ? 'Live API' : 'Sandbox'}
            </Link>

            <button
              className="relative rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
              aria-label="Notifications"
            >
              <Icon name="alert" className="size-4.5" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-400" />
            </button>

            <Link
              to="/console/settings"
              className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2.5 transition-colors hover:bg-ink-800"
            >
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[0.72rem] font-semibold text-white">
                AO
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-[0.78rem] font-medium leading-tight text-ink-100">Amara Osei</span>
                <span className="block text-[0.68rem] leading-tight text-ink-500">Owner · MADOVA</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Shared page header for console screens. */
export function PageHeader({
  title, lead, actions,
}: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-50 sm:text-2xl">{title}</h1>
        {lead && <p className="mt-1.5 max-w-2xl text-[0.86rem] leading-relaxed text-ink-400">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
