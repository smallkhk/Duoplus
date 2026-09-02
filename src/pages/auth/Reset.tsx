import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Icon } from '@/components/Icon'
import { Button, Field, Input, useToast } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'

/**
 * Completes a password reset. The token is an HMAC over the account's current
 * password hash, so it stops working the moment the password changes — using
 * one twice fails, which is what makes a mailed link safe to send.
 */
export function Reset() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh } = useAuth()

  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && password !== confirm
  const valid = password.length >= 10 && /\d/.test(password) && !mismatch

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.resetPassword(token, password)
      await refresh()
      toast('Password changed. You are signed in.', 'ok')
      navigate('/console', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset that password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 inline-block"><Logo /></Link>

        {!token ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              That link is incomplete
            </h1>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-400">
              Reset links carry a token. Open the one you were sent, or request a new one from the
              sign-in page.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-brand-300 hover:text-brand-200"
            >
              Back to sign in
              <Icon name="arrowRight" className="size-3.5" />
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Choose a new password</h1>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-400">
              The link works once. Setting a password here signs you straight in.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <Field label="New password" hint="At least 10 characters, including a number.">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoFocus
                />
              </Field>
              <Field label="Confirm password" error={mismatch ? 'Those do not match.' : undefined}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••••"
                />
              </Field>

              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/8 p-3 text-[0.82rem] text-ink-200">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!valid}>
                Set password and sign in
              </Button>
            </form>

            <p className="mt-6 text-center text-[0.8rem] text-ink-500">
              Remembered it?{' '}
              <Link to="/login" className="text-brand-300 hover:text-brand-200">Sign in instead</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
