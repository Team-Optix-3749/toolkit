import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RequireApproved } from '~/components/Guards'
import { AppShell } from '~/components/AppShell'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <RequireApproved>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireApproved>
  )
}
