import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '~/lib/auth'
import { isAdmin, isOwner, ROLE_LABEL, type Role } from '~/lib/rbac'
import type { Permission } from '~/lib/types'
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

type AdminItem = [string, string, Permission | null]
const ADMIN_NAV: AdminItem[] = [
  ['/admin/members', 'Members', 'manage_accounts'],
  ['/admin/build/schedule', 'Build schedule', 'manage_build_hours'],
  ['/admin/build/attendance', 'Build attendance', 'manage_build_hours'],
  ['/admin/outreach/events', 'Outreach events', 'manage_outreach_events'],
  ['/admin/outreach/individual', 'Individual outreach', 'manage_outreach_attendance'],
  ['/admin/opi', 'OPI review', 'manage_opis'],
  ['/admin/purchases', 'Purchases', null],
  ['/admin/reports/hours', 'Reports', 'export_records'],
  ['/admin/settings', 'Settings', null],
]

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
  const owner = isOwner(role)
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])

  const perms = profile?.permissions ?? []
  const hasPerm = (p: Permission | null) => p === null || perms.includes(p)
  const visibleAdmin = admin ? ADMIN_NAV.filter(([, , p]) => hasPerm(p)) : []
  const topItems: [string, string][] = [...NAV]
  if (visibleAdmin.length > 0) topItems.push(['/admin', 'Admin'])
  if (owner) topItems.push(['/owner', 'Owner'])

  const topLinkCls = (active: boolean) =>
    `px-3 py-1 h-8 my-1 inline-flex items-center text-[12px] font-mono uppercase tracking-[0.08em] rounded-lg whitespace-nowrap transition-all duration-150 ${
      active ? 'bg-white/10 text-ink' : 'text-ink-soft hover:text-ink hover:bg-white/5'
    }`

  const drawerLinkCls = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium rounded-lg mx-2 transition-all duration-150 ${
      active
        ? 'text-ink bg-white/10'
        : 'text-ink-soft hover:text-ink hover:bg-white/5'
    }`

  const tabCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-tight transition-all duration-150 ${
      active ? 'text-accent' : 'text-ink-soft active:scale-95'
    }`

  return (
    <div className="min-h-dvh bg-canvas text-ink bg-ambient">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Header — glass */}
      <header role="banner" className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="bg-panel backdrop-blur-xl border-b border-white/6">
          <div className="max-w-6xl mx-auto px-4 sm:px-5 h-[52px] flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-accent rounded-lg grid place-items-center font-mono font-semibold text-[13px] text-[#06080b]">
                O
              </div>
              <span className="font-semibold tracking-tight">Optix</span>
            </Link>

            {/* Desktop actions */}
            <div className="ml-auto hidden sm:flex items-center gap-3">
              <Link to="/notifications" className="text-ink-soft hover:text-ink transition-colors" title="Notifications">
                <BellIcon />
              </Link>
              <span className="font-mono text-[11px] text-ink-soft uppercase tracking-wide">
                {ROLE_LABEL[role as Role] ?? role}
              </span>
              <Link to="/profile" className="font-mono text-xs text-ink-soft hover:text-ink transition-colors">
                {profile?.display_name || 'profile'}
              </Link>
              <ThemeToggle className="h-8 w-8 grid place-items-center border border-white/10 rounded-lg text-ink-soft hover:text-ink hover:bg-white/10 text-sm transition-all" />
              <button
                onClick={() => signOut()}
                className="border border-white/10 hover:bg-white/10 rounded-lg text-[11px] font-mono uppercase tracking-[0.08em] px-3 py-1.5 transition-all"
              >
                Sign out
              </button>
            </div>

            {/* Mobile */}
            <div className="ml-auto flex items-center gap-1 sm:hidden">
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="h-9 w-9 grid place-items-center text-ink-soft hover:text-ink hover:bg-white/10 rounded-lg transition-all"
              >
                <BellIcon />
              </Link>
              <ThemeToggle className="h-8 w-8 grid place-items-center border border-white/10 rounded-lg text-ink-soft hover:bg-white/10 text-sm transition-all" />
            </div>
          </div>
        </div>
      </header>

      {/* Desktop nav — glass */}
      <nav aria-label="Main navigation" className="hidden sm:block sticky top-[52px] z-30">
        <div className="bg-panel/50 backdrop-blur-lg border-b border-white/[0.04]">
          <div className="max-w-6xl mx-auto px-5 flex gap-1">
            {topItems.map(([to, label]) => {
              const active = pathname.startsWith(to)
              const isOwnerLink = to === '/owner'
              const cls = isOwnerLink
                ? `px-3 py-1 h-8 my-1 inline-flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-[0.08em] rounded-lg whitespace-nowrap transition-all duration-150 ${
                    active
                      ? 'bg-accent/15 text-accent border border-accent/25'
                      : 'text-accent/70 hover:text-accent hover:bg-accent/5 border border-transparent'
                  }`
                : topLinkCls(active)
              return (
                <Link key={to} to={to} className={cls}>
                  {isOwnerLink && <span className="w-1 h-1 rounded-full bg-accent" />}
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-4 sm:space-y-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:pb-6">
        {children}
      </main>

      {/* Mobile bottom tab bar — glass */}
      <nav aria-label="Tab bar" className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-panel backdrop-blur-xl border-t border-white/6 pb-[env(safe-area-inset-bottom)]">
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

      {/* Mobile drawer — glass */}
      <div
        className={`sm:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[82%] bg-panel backdrop-blur-xl border-r border-white/8 flex flex-col transition-transform duration-200 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="px-4 flex items-center gap-2.5 border-b border-white/6 shrink-0 pt-[env(safe-area-inset-top)]">
            <div className="h-[52px] flex items-center gap-2.5 w-full">
              <div className="w-7 h-7 bg-accent rounded-lg grid place-items-center font-mono font-semibold text-[13px] text-[#06080b]">
                O
              </div>
              <span className="font-semibold tracking-tight">Optix</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="ml-auto h-9 w-9 grid place-items-center text-ink-soft hover:text-ink hover:bg-white/10 rounded-lg text-xl transition-all"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-white/6">
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

            {visibleAdmin.length > 0 && (
              <>
                <div className="px-4 pt-4 pb-1 text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft">
                  Admin
                </div>
                {visibleAdmin.map(([to, label]) => (
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

            {owner && (
              <>
                <div className="px-4 pt-4 pb-1 text-[11px] font-mono uppercase tracking-[0.08em] text-accent flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent" />
                  Owner
                </div>
                {(['/owner', '/owner/members', '/owner/opis', '/owner/purchases', '/owner/events', '/owner/tasks'] as const).map((to) => {
                  const label = to === '/owner' ? 'Console' : to.replace('/owner/', '').replace(/^./, (c) => c.toUpperCase())
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`block ${drawerLinkCls(pathname === to || (to !== '/owner' && pathname.startsWith(to)))}`}
                    >
                      {label}
                    </Link>
                  )
                })}
              </>
            )}
          </nav>

          <div className="p-3 border-t border-white/6 shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <button
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="w-full h-10 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all"
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
