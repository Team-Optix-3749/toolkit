import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
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

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const items = isAdmin(role) ? [...NAV, ['/admin/members', 'Admin'] as [string, string]] : NAV

  const linkCls = (active: boolean) =>
    `px-3 h-9 inline-flex items-center text-[12px] font-mono uppercase tracking-[0.08em] border-b-2 whitespace-nowrap ${
      active ? 'border-accent text-ink' : 'border-transparent text-ink-soft hover:text-ink'
    }`

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="bg-brand text-white">
        <div className="max-w-6xl mx-auto px-5 h-[52px] flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent grid place-items-center font-mono font-semibold text-[13px]">
              O
            </div>
            <span className="font-semibold tracking-tight">Optix</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/notifications" className="text-white/70 hover:text-white" title="Notifications">
              <span className="text-lg leading-none">◔</span>
            </Link>
            <span className="hidden sm:inline font-mono text-[11px] text-white/55 uppercase tracking-wide">
              {ROLE_LABEL[(role as Role)] ?? role}
            </span>
            <Link to="/profile" className="hidden sm:inline font-mono text-xs text-white/70 hover:text-white">
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
        </div>
      </header>

      <nav className="bg-panel border-b border-line">
        <div className="max-w-6xl mx-auto px-5 flex gap-1 overflow-x-auto">
          {items.map(([to, label]) => (
            <Link key={to} to={to} className={linkCls(pathname.startsWith(to))}>
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-5">{children}</main>
    </div>
  )
}
