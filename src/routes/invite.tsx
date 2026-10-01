import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { isApproved } from '~/lib/rbac'
import { btn } from '~/lib/ui'
import { AuthShell } from './login'

export const Route = createFileRoute('/invite')({
  component: InvitePage,
  validateSearch: (s: Record<string, unknown>) => ({
    code: (s.code as string) || '',
  }),
})

type InviteState = 'loading' | 'valid' | 'invalid' | 'used'

function InvitePage() {
  const { code } = Route.useSearch()
  const { user, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<InviteState>('loading')

  useEffect(() => {
    if (!code) {
      setState('invalid')
      return
    }
    supabase
      .from('invitations')
      .select('id, code, expires_at, revoked')
      .eq('code', code)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.revoked || new Date(data.expires_at) < new Date()) {
          setState('invalid')
        } else {
          setState('valid')
        }
      })
  }, [code])

  useEffect(() => {
    if (authLoading) return
    if (user && isApproved(role)) {
      setState('used')
    }
  }, [authLoading, user, role])

  if (state === 'loading') {
    return (
      <AuthShell title="Invitation">
        <p className="text-sm text-ink-soft">Verifying invite…</p>
      </AuthShell>
    )
  }

  if (state === 'invalid') {
    return (
      <AuthShell title="Invalid invitation">
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            This invitation link is invalid, expired, or has been revoked.
            Ask a team leader for a new one.
          </p>
          <Link to="/login" className="text-sm text-accent font-medium hover:underline">
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (state === 'used') {
    return (
      <AuthShell title="You're in!">
        <div className="space-y-4">
          <p className="text-sm text-[#1a7f4b]">
            You already have an approved account.
          </p>
          <button onClick={() => navigate({ to: '/dashboard' })} className={`w-full ${btn}`}>
            Go to dashboard
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="You're invited!">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          You've been invited to join <strong>Team Optix 3749</strong>'s toolkit.
          Create an account or sign in to get started.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/signup"
            search={{ code }}
            className={`${btn} text-center`}
          >
            Sign up
          </Link>
          <Link
            to="/login"
            className="h-10 px-6 border border-line bg-panel text-sm font-medium hover:bg-canvas inline-flex items-center justify-center"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
