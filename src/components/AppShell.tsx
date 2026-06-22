import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '~/lib/auth'
import { isAdmin, ROLE_LABEL, type Role } from '~/lib/rbac'
import { ThemeToggle } from './ThemeToggle'

const NAV: [string, string][] = [
  ['/dashboard', 'Dashboard'],
  ['/build', 'Build'],
  ['/outreach', 'Outreach'],
  ['/opi', 'OPI'],
  ['/purchases', 'Purchases'],
  ['/hours', 'Hours'],
]

const ADMIN_NAV: [string, string][] = [
  ['/admin/members', 'Members'],
  ['/admin/build/schedule', 'Build schedule'],
  ['/admin/outreach/events', 'Outreach events'],
  ['/admin/opi', 'OPI review'],
  ['/admin/purchases', 'Purchases'],
  ['/admin/reports/hours', 'Reports'],
  ['/admin/settings', 'Settings'],
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const admin = isAdmin(role)
  const [open, setOpen] = useState(false)

  // Close the drawer on navigation.
  useEffect(() => setOpen(false), [pathname])

  const topItems = admin ? [...NAV, ['/admin/members', 'Admin'] as [string, string]] : NAV

  const topLinkCls = (active: boolean) =>
    `px-3 h-9 inline-flex items-center text-[12px] font-mono uppercase tracking-[0.08em] border-b-2 whitespace-nowrap ${
      active ? 'border-accent text-ink' : 'border-transparent text-ink-soft hover:text-ink'
    }`

  const drawerLinkCls = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium border-l-2 ${
      active
        ? 'border-accent text-ink bg-accent-soft'
        : 'border-transparent text-ink-soft hover:text-ink hover:bg-canvas'
    }`

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="bg-brand text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-[52px] flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="sm:hidden h-9 w-9 -ml-1 grid place-items-center text-white/90 hover:bg-white/10 text-xl"
          >
            ☰
          </button>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent grid place-items-center font-mono font-semibold text-[13px]">
              O
            </div>
            <span className="font-semibold tracking-tight">Optix</span>
          </Link>

          {/* Desktop actions */}
          <div className="ml-auto hidden sm:flex items-center gap-3">
            <Link to="/notifications" className="text-white/70 hover:text-white" title="Notifications">
              <span className="text-lg leading-none">◔</span>
            </Link>
            <span className="font-mono text-[11px] text-white/55 uppercase tracking-wide">
              {ROLE_LABEL[role as Role] ?? role}
            </span>
            <Link to="/profile" className="font-mono text-xs text-white/70 hover:text-white">
              {profile?.display_name || 'profile'}
            </Link>
            <ThemeToggle className="h-8 w-8 grid place-items-center border border-white/20 text-white/70 hover:text-white hover:bg-white/10 text-sm" />
            <button
              onClick={() => signOut()}
              className="border border-white/20 hover:bg-white/10 text-[11px] font-mono uppercase tracking-[0.08em] px-3 py-1.5"
            >
              Sign out
            </button>
          </div>

          {/* Mobile: just the theme toggle on the right */}
          <ThemeToggle className="sm:hidden ml-auto h-8 w-8 grid place-items-center border border-white/20 text-white/70 hover:bg-white/10 text-sm" />
        </div>
      </header>

      {/* Desktop horizontal nav */}
      <nav className="hidden sm:block bg-panel border-b border-line">
        <div className="max-w-6xl mx-auto px-5 flex gap-1">
          {topItems.map(([to, label]) => (
            <Link key={to} to={to} className={topLinkCls(pathname.startsWith(to))}>
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-4 sm:space-y-5">
        {children}
      </main>

      {/* Mobile drawer */}
      <div
        className={`sm:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[82%] bg-panel border-r border-line flex flex-col transition-transform duration-200 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-[52px] px-4 flex items-center gap-2.5 bg-brand text-white shrink-0">
            <div className="w-7 h-7 bg-accent grid place-items-center font-mono font-semibold text-[13px]">
              O
            </div>
            <span className="font-semibold tracking-tight">Optix</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="ml-auto h-9 w-9 grid place-items-center text-white/80 hover:bg-white/10 text-xl"
            >
              ✕
            </button>
          </div>

          <div className="px-4 py-3 border-b border-line">
            <div className="text-sm font-medium">{profile?.display_name || 'Member'}</div>
            <div className="text-[11px] font-mono uppercase tracking-wide text-ink-soft">
              {ROLE_LABEL[role as Role] ?? role}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} className={`block ${drawerLinkCls(pathname.startsWith(to))}`}>
                {label}
              </Link>
            ))}
            <Link
              to="/notifications"
              className={`block ${drawerLinkCls(pathname.startsWith('/notifications'))}`}
            >
              Notifications
            </Link>
            <Link to="/profile" className={`block ${drawerLinkCls(pathname.startsWith('/profile'))}`}>
              Profile
            </Link>

            {admin && (
              <>
                <div className="px-4 pt-4 pb-1 text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft">
                  Admin
                </div>
                {ADMIN_NAV.map(([to, label]) => (
                  <Link
                    key={to}
                    to={to}
                    className={`block ${drawerLinkCls(pathname.startsWith(to))}`}
                  >
                    {label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className="p-3 border-t border-line shrink-0">
            <button
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="w-full h-10 border border-line bg-panel hover:bg-canvas text-sm font-medium"
            >
              Sign out
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
