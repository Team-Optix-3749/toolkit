import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '~/lib/auth'
import { isApproved } from '~/lib/rbac'

export const Route = createFileRoute('/auth/callback')({
  component: CallbackPage,
})

// OAuth providers redirect here. supabase-js (detectSessionInUrl) consumes the
// hash/code automatically; once a session exists we route by role.
function CallbackPage() {
  const { loading, user, role } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user) navigate({ to: '/login' })
    else navigate({ to: isApproved(role) ? '/dashboard' : '/pending-approval' })
  }, [loading, user, role, navigate])

  return (
    <div className="min-h-screen grid place-items-center bg-canvas text-ink-soft font-mono text-sm">
      Completing sign-in…
    </div>
  )
}
