import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Icon } from '@/components/Icon'
import { PhoneFrame } from '@/components/PhoneFrame'
import { Button, Field, Input, Select, cx, useToast } from '@/components/ui'
import { BRAND, STATS } from '@/data/site'

type Mode = 'login' | 'register'

function AuthShell({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const isLogin = mode === 'login'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    /* Demo build: no auth backend, so we drop straight into the console. */
    setTimeout(() => {
      toast(isLogin ? 'Signed in to the demo console.' : 'Account created — your trial phone is provisioning.', 'ok')
      navigate('/console')
    }, 550)
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      {/* form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            to={isLogin ? '/register' : '/login'}
            className="text-[0.82rem] text-ink-400 transition-colors hover:text-ink-100"
          >
            {isLogin ? 'Create an account' : 'Sign in instead'}
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">
              {isLogin ? 'Sign in to your console' : 'Start with one free phone'}
            </h1>
            <p className="mt-3 text-[0.88rem] leading-relaxed text-ink-400">
              {isLogin
                ? 'Your fleet, your team and your API keys are where you left them.'
                : 'One cloud phone for 30 days with 30 minutes of runtime. No card, and nothing to install.'}
            </p>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {['Google', 'GitHub'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toast(`${p} sign-in is not wired up in this demo build.`, 'info')}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-900/60 text-[0.83rem] font-medium text-ink-200 transition-colors hover:border-ink-600 hover:bg-ink-800"
                >
                  <Icon name={p === 'GitHub' ? 'code' : 'globe'} className="size-4" />
                  {p}
                </button>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-800" />
              <span className="text-[0.7rem] uppercase tracking-wider text-ink-600">or</span>
              <span className="h-px flex-1 bg-ink-800" />
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {!isLogin && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name"><Input required placeholder="Jules Ardan" autoComplete="name" /></Field>
                  <Field label="Company"><Input placeholder="Northwind Media" autoComplete="organization" /></Field>
                </div>
              )}
              <Field label="Work email">
                <Input required type="email" placeholder="you@company.com" autoComplete="email" />
              </Field>
              <Field
                label="Password"
                hint={isLogin ? undefined : 'At least 10 characters, including a number.'}
              >
                <Input
                  required
                  type="password"
                  placeholder="••••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </Field>
              {!isLogin && (
                <Field label="What will you use phones for?">
                  <Select defaultValue="Social media & creators">
                    {[
                      'Social media & creators', 'E-commerce & marketplaces', 'Airdrop & web3',
                      'App QA & testing', 'Ad operations', 'Reselling to my customers', 'Something else',
                    ].map((o) => <option key={o}>{o}</option>)}
                  </Select>
                </Field>
              )}

              {isLogin && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[0.8rem] text-ink-400">
                    <input type="checkbox" className="size-3.5 rounded border-ink-600 bg-ink-950 accent-brand-500" />
                    Keep me signed in
                  </label>
                  <button
                    type="button"
                    onClick={() => toast('Password reset is not wired up in this demo build.', 'info')}
                    className="text-[0.8rem] text-brand-300 hover:text-brand-200"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={busy} iconRight={busy ? undefined : 'arrowRight'}>
                {busy ? 'One moment…' : isLogin ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <p className="mt-5 text-center text-[0.74rem] leading-relaxed text-ink-500">
              {isLogin ? (
                <>This demo build has no auth backend — any credentials open the console.</>
              ) : (
                <>
                  By creating an account you agree to the{' '}
                  <Link to="/legal/terms" className="text-ink-300 hover:text-ink-100">terms</Link> and{' '}
                  <Link to="/legal/aup" className="text-ink-300 hover:text-ink-100">acceptable use policy</Link>.
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-[0.74rem] text-ink-600">
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </div>

      {/* art side */}
      <aside className="relative hidden overflow-hidden border-l border-ink-800 lg:block">
        <div className="absolute inset-0 bg-aurora" />
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="grid grid-cols-3 items-end gap-4">
            {(['default', 'busy', 'off'] as const).map((tone, i) => (
              <div key={tone} className={cx(i === 1 && '-translate-y-6')}>
                <PhoneFrame tone={tone} />
              </div>
            ))}
          </div>

          <div>
            <blockquote className="max-w-md text-pretty text-[1.05rem] leading-relaxed text-ink-100">
              “We moved 1,400 creator accounts off a physical phone farm in three weeks. The rack is
              gone, the ops rota is gone, and account survival went up, not down.”
            </blockquote>
            <p className="mt-5 text-[0.85rem] font-medium text-ink-200">Jules Ardan</p>
            <p className="text-[0.78rem] text-ink-500">Head of Operations, Northwind Media</p>

            <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-ink-800 pt-8">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="font-mono text-xl font-semibold text-ink-50">{s.value}</dt>
                  <dd className="mt-0.5 text-[0.75rem] text-ink-500">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </aside>
    </div>
  )
}

export const Login = () => <AuthShell mode="login" />
export const Register = () => <AuthShell mode="register" />
