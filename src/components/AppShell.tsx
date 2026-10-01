import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '~/lib/auth'
import { isAdmin, ROLE_LABEL, type Role } from '~/lib/rbac'
import { ThemeToggle } from './ThemeToggle'

const NAV: [string, string][] = [
  ['/dashboard', 'Dashboard'],
  ['/build', 'Build'],
  ['/outreach', 'Outreach'],
  ['/tasks', 'Tasks'],
  ['/opi', 'OPI'],
  ['/purchases', 'Purchases'],
  ['/hours', 'Hours'],
]

const ADMIN_NAV: [string, string][] = [
  ['/admin/members', 'Members'],
  ['/admin/build/schedule', 'Build schedule'],
  ['/admin/outreach/events', 'Outreach events'],
  ['/admin/outreach/individual', 'Individual outreach'],
  ['/admin/opi', 'OPI review'],
  ['/admin/purchases', 'Purchases'],
  ['/admin/reports/hours', 'Reports'],
  ['/admin/settings', 'Settings'],
]

// Primary destinations for the mobile bottom tab bar (native-app style).
const TABS: [string, string, ReactNode][] = [
  ['/dashboard', 'Home', <HomeIcon key="h" />],
  ['/build', 'Build', <BuildIcon key="b" />],
  ['/outreach', 'Outreach', <OutreachIcon key="o" />],
  ['/hours', 'Hours', <HoursIcon key="t" />],
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

  const tabCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-tight transition-colors ${
      active ? 'text-accent' : 'text-ink-soft'
    }`

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="bg-brand text-white sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-[52px] flex items-center gap-3">
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

          {/* Mobile: notifications + theme toggle on the right */}
          <div className="ml-auto flex items-center gap-1 sm:hidden">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="h-9 w-9 grid place-items-center text-white/80 hover:bg-white/10"
            >
              <BellIcon />
            </Link>
            <ThemeToggle className="h-8 w-8 grid place-items-center border border-white/20 text-white/70 hover:bg-white/10 text-sm" />
          </div>
        </div>
      </header>

      {/* Desktop horizontal nav */}
      <nav className="hidden sm:block bg-panel border-b border-line sticky top-[52px] z-30">
        <div className="max-w-6xl mx-auto px-5 flex gap-1">
          {topItems.map(([to, label]) => (
            <Link key={to} to={to} className={topLinkCls(pathname.startsWith(to))}>
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-4 sm:space-y-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:pb-6">
        {children}
      </main>

      {/* Mobile bottom tab bar (native-app style) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-panel border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-14">
          {TABS.map(([to, label, icon]) => {
            const active = pathname.startsWith(to)
            return (
              <Link key={to} to={to} className={tabCls(active)}>
                {icon}
                <span>{label}</span>
              </Link>
            )
          })}
          <button type="button" onClick={() => setOpen(true)} className={tabCls(open)}>
            <MenuIcon />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile drawer (full menu, opened from the More tab) */}
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
          <div className="px-4 flex items-center gap-2.5 bg-brand text-white shrink-0 pt-[env(safe-area-inset-top)]">
            <div className="h-[52px] flex items-center gap-2.5 w-full">
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

          <div className="p-3 border-t border-line shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
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

/* ---- Inline icons (20px, stroke = currentColor) ---- */
const svg = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function HomeIcon() {
  return (
    <svg {...svg}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  )
}
function BuildIcon() {
  return (
    <svg {...svg}>
      <path d="M14.7 6.3a3.6 3.6 0 0 0-4.9 4.9L3 18v3h3l6.8-6.8a3.6 3.6 0 0 0 4.9-4.9l-2.4 2.4-2-2 2.4-2.4z" />
    </svg>
  )
}
function OutreachIcon() {
  return (
    <svg {...svg}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l8 4.5V5.5L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M18 8.5a4 4 0 0 1 0 7" />
    </svg>
  )
}
function HoursIcon() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}
function MenuIcon() {
  return (
    <svg {...svg}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}
function BellIcon() {
  return (
    <svg {...svg} width={20} height={20}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 1.5 6 1.5 6H4.5S6 14 6 9z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  )
}
