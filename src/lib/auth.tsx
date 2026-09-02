import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, type AccountSummary, type ServerMeta, type SessionUser } from './api'

interface AuthState {
  user: SessionUser | null
  account: AccountSummary | null
  meta: ServerMeta | null
  /** The signed-in person's role on the account they are working inside. */
  role: 'owner' | 'admin' | 'operator' | 'viewer'
  /** Set only when signed in as a team member, naming whose account this is. */
  accountOwner: { name: string; company: string } | null
  /** Null while the session is still being resolved on first paint. */
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; name: string; company?: string; use_case?: string }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [meta, setMeta] = useState<ServerMeta | null>(null)
  const [role, setRole] = useState<AuthState['role']>('owner')
  const [accountOwner, setAccountOwner] = useState<AuthState['accountOwner']>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await api.me()
      setUser(data.user)
      setAccount(data.account ?? null)
      setRole(data.role ?? 'owner')
      setAccountOwner(data.account_owner ?? null)
    } catch {
      setUser(null)
      setAccount(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([api.me(), api.meta()]).then(([me, m]) => {
      if (cancelled) return
      if (me.status === 'fulfilled') {
        setUser(me.value.user)
        setAccount(me.value.account ?? null)
        setRole(me.value.role ?? 'owner')
        setAccountOwner(me.value.account_owner ?? null)
      }
      if (m.status === 'fulfilled') setMeta(m.value)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  /* Any device action can change the account summary; let pages nudge it. */
  useEffect(() => {
    const onChange = () => { void refresh() }
    window.addEventListener('madova:account', onChange)
    return () => window.removeEventListener('madova:account', onChange)
  }, [refresh])

  const value = useMemo<AuthState>(() => ({
    user,
    account,
    meta,
    role,
    accountOwner,
    ready,
    login: async (email, password) => {
      const data = await api.login(email, password)
      setUser(data.user)
      await refresh()
    },
    register: async (input) => {
      const data = await api.register(input)
      setUser(data.user)
      await refresh()
    },
    logout: async () => {
      await api.logout()
      setUser(null)
      setAccount(null)
    },
    refresh,
  }), [user, account, meta, role, accountOwner, ready, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Tell the auth context that the account may have changed. */
export function accountChanged() {
  window.dispatchEvent(new CustomEvent('madova:account'))
}

/** Gate for the console: sends signed-out visitors to sign in and back again. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950">
        <div className="flex items-center gap-3 text-[0.85rem] text-ink-400">
          <span className="size-4 animate-spin rounded-full border-2 border-ink-700 border-t-brand-400" />
          Checking your session…
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <>{children}</>
}
