import { useEffect, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { isApproved, hasAdminAccess, isOwner } from '~/lib/rbac'

function Loading() {
  return <div className="min-h-dvh grid place-items-center bg-canvas text-ink-soft font-mono text-sm" role="status">Loading…</div>
}
function ProfileFailure() {
  const { profileError, refresh, signOut } = useAuth()
  return <main className="min-h-dvh grid place-items-center bg-canvas p-6"><section className="max-w-md space-y-4"><h1 className="text-xl">Account access unavailable</h1><p role="alert">{profileError ?? 'Your account could not be loaded.'}</p><div className="flex gap-4"><button onClick={() => void refresh()}>Retry</button><button onClick={() => void signOut()}>Sign out</button></div></section></main>
}
export function RequireApproved({ children }: { children: ReactNode }) {
  const { loading, user, role, profile, profileError } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (loading) return
    if (!user) { void navigate({to:'/login'}); return }
    if (!profile) return
    if (profile.account_status !== 'active') { void navigate({to:'/account-blocked'}); return }
    if (!profile.verified) { void navigate({to:'/resend-verification'}); return }
    if (!isApproved(role)) void navigate({to:'/pending-approval'})
  }, [loading,user,role,profile,navigate])
  if (!loading && user && (!profile || profileError)) return <ProfileFailure />
  if (loading || !user || !profile || !profile.verified || profile.account_status !== 'active' || !isApproved(role)) return <Loading />
  return <>{children}</>
}
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, profile } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { if (!loading && profile && !hasAdminAccess(profile)) void navigate({to:'/dashboard'}) }, [loading,profile,navigate])
  return <RequireApproved>{hasAdminAccess(profile) ? children : <Loading />}</RequireApproved>
}
export function RequireOwner({ children }: { children: ReactNode }) {
  const { loading, profile, role } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { if (!loading && profile && !isOwner(role)) void navigate({to:'/dashboard'}) }, [loading,profile,role,navigate])
  return <RequireApproved>{isOwner(role) ? children : <Loading />}</RequireApproved>
}
