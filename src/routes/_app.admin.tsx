import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { RequireAdmin } from '~/components/Guards'

const ADMIN_NAV: [string, string][] = [
  ['/admin', 'Dashboard'],
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
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (to: string) =>
    to === '/admin' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(to)

  const currentLabel = ADMIN_NAV.find(([to]) => isActive(to))?.[1] ?? 'Admin'

  return (
    <RequireAdmin>
      {/* Desktop nav */}
      <div className="hidden sm:flex items-center gap-1 mb-3 flex-wrap">
        <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft mr-2">
          Admin
        </span>
        {ADMIN_NAV.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            activeOptions={to === '/admin' ? { exact: true } : undefined}
            className={`px-2.5 h-7 inline-flex items-center text-[11px] font-mono uppercase tracking-wide border ${
              isActive(to)
                ? 'border-accent text-accent bg-accent-soft'
                : 'border-line text-ink-soft hover:text-ink bg-panel'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden mb-3">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full h-10 px-4 flex items-center justify-between border border-line bg-panel text-sm"
        >
          <span className="text-[11px] font-mono uppercase tracking-[0.08em]">
            Admin / {currentLabel}
          </span>
          <svg
            className={`w-4 h-4 text-ink-soft transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {mobileOpen && (
          <div className="border border-t-0 border-line bg-panel divide-y divide-line">
            {ADMIN_NAV.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2.5 text-sm ${
                  isActive(to) ? 'text-accent bg-accent-soft' : 'text-ink-soft hover:text-ink hover:bg-canvas'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Outlet />
    </RequireAdmin>
  )
}

export const Route = createFileRoute('/_app/admin')({
  component: AdminLayout,
})
