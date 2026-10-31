import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '~/lib/auth'
import { isApproved } from '~/lib/rbac'
import { AuthShell } from './login'

export const Route = createFileRoute('/pending-approval')({
  component: PendingPage,
})

function PendingPage() {
  const { loading, user, role, profile, profileError, refresh, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user) navigate({ to: '/login' })
    else if (profile?.account_status === 'deactivated' || profile?.account_status === 'rejected') {
      navigate({ to: '/account-blocked' })
    } else if (profile?.verified && isApproved(role)) navigate({ to: '/dashboard' })
  }, [loading, user, role, profile, navigate])

  return (
    <AuthShell title="Awaiting approval">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Your account is pending team admission. Verify your email, then an account manager can
          approve ordinary membership. Account type does not grant administrative permissions.
        </p>
        <p className="text-sm text-ink-soft">Signed in as {user?.email}.</p>
        {profileError && <p role="alert" className="text-sm text-red-400">{profileError}</p>}
        <div className="flex gap-3">
          <button onClick={() => refresh()} className="h-9 px-4 text-sm font-medium border border-white/10 bg-white/5 rounded-lg hover:bg-white/10 inline-flex items-center justify-center transition-all">
            Check again
          </button>
          <button onClick={() => signOut()} className="h-9 px-4 text-sm text-ink-soft hover:text-ink rounded-lg inline-flex items-center justify-center transition-all">
            Sign out
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
