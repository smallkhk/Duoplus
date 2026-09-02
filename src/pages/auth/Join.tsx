import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Icon } from '@/components/Icon'
import { Badge, Button, Field, Input, Skeleton, useToast } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'

type Invite = { name: string; email: string; role: string; company: string }

/**
 * Accepts a team invitation. The account created here carries a link to the
 * owner, so the new member signs in to the owner's fleet with the role they
 * were invited at — not to an empty account of their own.
 */
export function Join() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh } = useAuth()

  const token = params.get('invite') ?? params.get('token') ?? ''
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setLoadError('That link is missing its invitation token.'); return }
    api.invite(token)
      .then((d) => setInvite(d.invite))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not read that invitation.'))
  }, [token])

  const mismatch = confirm.length > 0 && password !== confirm
  const valid = password.length >= 10 && /\d/.test(password) && !mismatch

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.acceptInvite(token, password)
      await refresh()
      toast(`Welcome to ${invite?.company ?? 'the team'}.`, 'ok')
      navigate('/console', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept that invitation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 inline-block"><Logo /></Link>

        {loadError ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              This invitation is not usable
            </h1>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-400">{loadError}</p>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-400">
              Ask whoever invited you to send a new one.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-brand-300 hover:text-brand-200"
            >
              Go to sign in
              <Icon name="arrowRight" className="size-3.5" />
            </Link>
          </>
        ) : !invite ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Join {invite.company}
            </h1>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-400">
              You were invited as <Badge tone="brand">{invite.role}</Badge> using{' '}
              <span className="text-ink-200">{invite.email}</span>. Pick a password to finish.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <Field label="Password" hint="At least 10 characters, including a number.">
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
                Join the team
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
