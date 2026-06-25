import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { isApproved, isAdmin, isOwner } from '~/lib/rbac'
import type { ReactNode } from 'react'

function Loading() {
  return (
    <div className="min-h-dvh grid place-items-center bg-canvas text-ink-soft font-mono text-sm">
      Loading…
    </div>
  )
}

/** MEMBER+ only. PENDING users are redirected to the holding page, guests to login. */
export function RequireApproved({ children }: { children: ReactNode }) {
  const { loading, user, role } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (loading) return
    if (!user) navigate({ to: '/login' })
    else if (!isApproved(role)) navigate({ to: '/pending-approval' })
  }, [loading, user, role, navigate])

  if (loading) return <Loading />
  if (!user || !isApproved(role)) return <Loading />
  return <>{children}</>
}

/** LEADERSHIP+ only. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, user, role } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (loading) return
    if (!user) navigate({ to: '/login' })
    else if (!isAdmin(role)) navigate({ to: '/dashboard' })
  }, [loading, user, role, navigate])

  if (loading || !user || !isAdmin(role)) return <Loading />
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
