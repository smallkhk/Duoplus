import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Catches a render error and shows it, instead of letting React unmount the
 * whole tree and leave a blank page.
 *
 * A blank page is the worst possible failure: it tells the customer nothing,
 * tells the operator nothing, and looks identical to a broken deploy. One bad
 * field in one row should cost that row, not the site.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    /* The console is where an operator will look first. */
    console.error('[madova] render failed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid min-h-[60vh] place-items-center px-6 py-16">
        <div className="max-w-lg text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-danger/12 text-danger">
            <Icon name="alert" className="size-5" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink-50">
            {this.props.label ?? 'This page hit an error'}
          </h1>
          <p className="mt-3 text-[0.86rem] leading-relaxed text-ink-400">
            Nothing on your account has changed. Reloading usually clears it; if it does not, the
            message below is what to send to support.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-ink-800 bg-ink-950/70 p-4 text-left font-mono text-[0.72rem] leading-relaxed text-ink-300">
            {error.message}
          </pre>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-ink-100 ring-1 ring-inset ring-ink-700 transition-colors hover:bg-ink-800/70"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-400"
            >
              Reload the page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
