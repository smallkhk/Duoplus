import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { Icon } from './Icon'
import { Container } from './ui'
import { BRAND, FOOTER_LINKS } from '@/data/site'

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[20rem_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-pretty text-[0.85rem] leading-relaxed text-ink-400">
              {BRAND.promise}
            </p>
            <div className="mt-6 flex items-center gap-2 text-[0.78rem] text-ink-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-pulse-dot rounded-full bg-ok/70" />
                <span className="relative inline-flex size-2 rounded-full bg-ok" />
              </span>
              All systems operational — {BRAND.status}
            </div>
            <a
              href={`mailto:${BRAND.email}`}
              className="mt-4 inline-flex items-center gap-2 text-[0.82rem] text-ink-300 hover:text-ink-50"
            >
              <Icon name="mail" className="size-4" />
              {BRAND.email}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_LINKS.map((col) => (
              <div key={col.heading}>
                <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-400">
                  {col.heading}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label + l.to}>
                      <Link to={l.to} className="text-[0.83rem] text-ink-300 transition-colors hover:text-ink-50">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-ink-800 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.76rem] text-ink-500">
            © {new Date().getFullYear()} {BRAND.name}. Cloud phone capacity resold under licence.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.76rem] text-ink-500">
            <Link to="/legal/terms" className="hover:text-ink-300">Terms</Link>
            <Link to="/legal/privacy" className="hover:text-ink-300">Privacy</Link>
            <Link to="/legal/aup" className="hover:text-ink-300">Acceptable use</Link>
            <Link to="/knowledge" className="hover:text-ink-300">Help centre</Link>
          </div>
        </div>
      </Container>
    </footer>
  )
}
