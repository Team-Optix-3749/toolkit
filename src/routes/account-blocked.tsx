import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { AuthShell } from './login'

export const Route = createFileRoute('/account-blocked')({
  component: AccountBlockedPage,
})

function AccountBlockedPage() {
  const { profile, signOut } = useAuth()
  const status = profile?.account_status

  const isRejected = status === 'rejected'

  return (
    <AuthShell title={isRejected ? 'Account not approved' : 'Account deactivated'}>
      <div className="space-y-4">
        {isRejected ? (
          <p className="text-sm text-ink-soft">
            Your account request was not approved. If you believe this is a mistake,
            reach out to a team leader.
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            Your account has been deactivated. If you think this is an error,
            contact a team leader to have it reactivated.
          </p>
        )}
        <button
          onClick={() => signOut()}
          className="h-9 px-4 text-sm border border-line bg-panel hover:bg-canvas w-full"
        >
          Sign out
        </button>
      </div>
    </AuthShell>
  )
}
