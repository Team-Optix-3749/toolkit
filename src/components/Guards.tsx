import { useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { isApproved, isAdmin, isOwner } from '~/lib/rbac'
import type { ReactNode } from 'react'

const REDIRECT_KEY = 'postLoginRedirect'

/** Where a signed-out visitor was headed (e.g. a scanned check-in QR), consumed once after login. */
export function takeLoginRedirect(): { to: string; search: Record<string, unknown> } | null {
  try {
    const raw = sessionStorage.getItem(REDIRECT_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function Loading() {
  return (
    <div className="min-h-dvh grid place-items-center bg-canvas text-ink-soft font-mono text-sm">
      Loading…
    </div>
  )
}

/** MEMBER+ only. Routes by account state: blocked → /account-blocked, pending → /pending-approval, guests → /login. */
export function RequireApproved({ children }: { children: ReactNode }) {
  const { loading, user, role, profile } = useAuth()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const profileReady = !loading && user && profile
  useEffect(() => {
    if (loading) return
    if (!user) {
      try {
        sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ to: location.pathname, search: location.search }))
      } catch {}
      return void navigate({ to: '/login' })
    }
    if (!profile) return
    const status = profile.account_status
    if (status === 'deactivated' || status === 'rejected') {
      return void navigate({ to: '/account-blocked' })
    }
    if (!isApproved(role)) navigate({ to: '/pending-approval' })
  }, [loading, user, role, profile, navigate])

  if (!profileReady) return <Loading />
  if (!isApproved(role)) return <Loading />
  if (profile.account_status !== 'active') return <Loading />
  return <>{children}</>
}

/** LEADERSHIP+ only. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, user, role, profile } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (loading) return
    if (!user) navigate({ to: '/login' })
    // Wait for the profile: until it loads, `role` is the 'PENDING' fallback
    // and would bounce real admins to /dashboard.
    else if (profile && !isAdmin(role)) navigate({ to: '/dashboard' })
  }, [loading, user, role, profile, navigate])

  if (loading || !user || !profile || !isAdmin(role)) return <Loading />
  return <>{children}</>
}

/** OWNER only - used inside admin pages. Renders a notice instead of redirecting. */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  if (!isOwner(role))
    return (
      <div className="bg-panel border border-line p-8 text-center">
        <div className="text-sm font-semibold text-[#b4690e] mb-1">Owner only</div>
        <p className="text-sm text-ink-soft">This area is restricted to the org owner.</p>
      </div>
    )
  return <>{children}</>
}
