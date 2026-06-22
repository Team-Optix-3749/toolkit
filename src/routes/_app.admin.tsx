import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router'
import { RequireAdmin } from '~/components/Guards'

const ADMIN_NAV: [string, string][] = [
  ['/admin/members', 'Members'],
  ['/admin/build/schedule', 'Build'],
  ['/admin/outreach/events', 'Outreach'],
  ['/admin/opi', 'OPI'],
  ['/admin/purchases', 'Purchases'],
  ['/admin/reports/hours', 'Reports'],
  ['/admin/settings', 'Settings'],
]

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <RequireAdmin>
      <div className="hidden sm:flex items-center gap-1 mb-3 flex-wrap">
        <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft mr-2">
          Admin
        </span>
        {ADMIN_NAV.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className={`px-2.5 h-7 inline-flex items-center text-[11px] font-mono uppercase tracking-wide border ${
              pathname.startsWith(to)
                ? 'border-accent text-accent bg-accent-soft'
                : 'border-line text-ink-soft hover:text-ink bg-panel'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Outlet />
    </RequireAdmin>
  )
}

export const Route = createFileRoute('/_app/admin')({
  component: AdminLayout,
})
