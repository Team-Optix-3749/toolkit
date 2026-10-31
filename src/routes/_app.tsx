import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RequireApproved } from '~/components/Guards'
import { AppShell } from '~/components/AppShell'
import { useAuth } from '~/lib/auth'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const { identityEpoch } = useAuth()
  return (
    <RequireApproved>
      <AppShell key={identityEpoch}>
        <Outlet />
      </AppShell>
    </RequireApproved>
  )
}
