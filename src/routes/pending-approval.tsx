import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '~/lib/auth'
import { isApproved } from '~/lib/rbac'
import { AuthShell } from './login'

export const Route = createFileRoute('/pending-approval')({
  component: PendingPage,
})

function PendingPage() {
  const { loading, user, role, profile, refresh, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user) navigate({ to: '/login' })
    else if (profile?.account_status === 'deactivated' || profile?.account_status === 'rejected') {
      navigate({ to: '/account-blocked' })
    } else if (isApproved(role)) navigate({ to: '/dashboard' })
  }, [loading, user, role, profile, navigate])

  return (
    <AuthShell title="Awaiting approval">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Your account is created and currently <strong>Pending</strong>. A team leader needs to
          approve you and assign a role before you can access the app.
        </p>
        <p className="text-sm text-ink-soft">Signed in as {user?.email}.</p>
        <div className="flex gap-3">
          <button onClick={() => refresh()} className="h-9 px-4 text-sm border border-line bg-panel hover:bg-canvas">
            Check again
          </button>
          <button onClick={() => signOut()} className="h-9 px-4 text-sm text-ink-soft hover:text-ink">
            Sign out
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
