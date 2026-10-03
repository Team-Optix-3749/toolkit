import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '~/lib/auth'
import { isOwner } from '~/lib/rbac'

const OWNER_NAV: [string, string][] = [
  ['/owner', 'Overview'],
  ['/owner/members', 'Members'],
  ['/owner/opis', 'OPIs'],
  ['/owner/purchases', 'Purchases'],
  ['/owner/events', 'Events'],
  ['/owner/tasks', 'Tasks'],
]

function OwnerLayout() {
  const { role, loading, profile } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (loading || !profile) return
    if (!isOwner(role)) navigate({ to: '/dashboard' })
  }, [loading, profile, role, navigate])

  if (loading || !profile) {
    return (
      <div className="min-h-dvh grid place-items-center text-ink-soft font-mono text-sm">Loading…</div>
    )
  }
  if (!isOwner(role)) return null

  const isActive = (to: string) =>
    to === '/owner' ? pathname === '/owner' || pathname === '/owner/' : pathname.startsWith(to)

  return (
    <>
      {/* Owner banner */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent">
          Owner console
        </span>
        <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft ml-auto">
          God mode · destructive actions enabled
        </span>
      </div>

      {/* Sub-nav */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto bg-panel backdrop-blur-xl border border-accent/15 rounded-2xl p-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(180,245,78,0.06)]">
          {OWNER_NAV.map(([to, label]) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                activeOptions={to === '/owner' ? { exact: true } : undefined}
                className={`shrink-0 h-9 px-4 inline-flex items-center text-[12px] font-medium rounded-xl transition-all duration-150 ${
                  active
                    ? 'bg-accent/15 text-accent border border-accent/25'
                    : 'text-ink-soft hover:text-ink hover:bg-white/5 border border-transparent'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/_app/owner')({
  component: OwnerLayout,
})
