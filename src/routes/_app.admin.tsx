import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { RequireAdmin } from '~/components/Guards'

type AdminItem = { to: string; label: string; icon: React.ReactNode }

const ADMIN_NAV: AdminItem[] = [
  { to: '/admin', label: 'Overview', icon: <HomeIcon /> },
  { to: '/admin/members', label: 'Members', icon: <PeopleIcon /> },
  { to: '/admin/build/schedule', label: 'Build', icon: <WrenchIcon /> },
  { to: '/admin/outreach/events', label: 'Outreach', icon: <MegaphoneIcon /> },
  { to: '/admin/opi', label: 'OPI', icon: <SparkIcon /> },
  { to: '/admin/purchases', label: 'Purchases', icon: <CartIcon /> },
  { to: '/admin/reports/hours', label: 'Reports', icon: <ChartIcon /> },
  { to: '/admin/settings', label: 'Settings', icon: <GearIcon /> },
]

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isActive = (to: string) =>
    to === '/admin' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(to)

  const current = ADMIN_NAV.find(({ to }) => isActive(to)) ?? ADMIN_NAV[0]

  useEffect(() => {
    if (!mobileOpen) return
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [mobileOpen])

  return (
    <RequireAdmin>
      {/* Desktop sub-nav — scrollable glass pill rail */}
      <div className="hidden sm:block mb-5">
        <div className="relative">
          <div className="flex items-center gap-1.5 overflow-x-auto bg-panel backdrop-blur-xl border border-white/8 rounded-2xl p-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
            {ADMIN_NAV.map(({ to, label, icon }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  activeOptions={to === '/admin' ? { exact: true } : undefined}
                  className={`shrink-0 h-9 px-3.5 inline-flex items-center gap-2 text-[12px] font-medium rounded-xl transition-all duration-150 ${
                    active
                      ? 'bg-accent/15 text-accent border border-accent/25 shadow-[inset_0_1px_0_rgba(180,245,78,0.1)]'
                      : 'text-ink-soft hover:text-ink hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span className={active ? 'text-accent' : 'text-ink-soft'}>{icon}</span>
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile dropdown — glass button + animated panel */}
      <div className="sm:hidden mb-4 relative" ref={dropdownRef}>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full h-11 px-4 flex items-center justify-between bg-panel backdrop-blur-xl border border-white/8 rounded-xl text-sm transition-all duration-150 hover:border-white/12"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-accent">{current.icon}</span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-soft">
                Admin
              </span>
              <span className="font-medium">{current.label}</span>
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-ink-soft transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {mobileOpen && (
          <div className="absolute inset-x-0 top-full mt-2 z-30 bg-panel backdrop-blur-xl border border-white/8 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
            {ADMIN_NAV.map(({ to, label, icon }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-150 ${
                    active
                      ? 'text-accent bg-accent/10'
                      : 'text-ink-soft hover:text-ink hover:bg-white/5'
                  }`}
                >
                  <span className={active ? 'text-accent' : 'text-ink-soft'}>{icon}</span>
                  {label}
                </Link>
              )
            })}
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

/* ---- Minimal 16px line icons ---- */
const sv = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function HomeIcon() { return <svg {...sv}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg> }
function PeopleIcon() { return <svg {...sv}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 10a3 3 0 0 0 0-6" /><path d="M21 20c0-2.5-2-4.5-5-5" /></svg> }
function WrenchIcon() { return <svg {...sv}><path d="M14.7 6.3a3.6 3.6 0 0 0-4.9 4.9L3 18v3h3l6.8-6.8a3.6 3.6 0 0 0 4.9-4.9l-2.4 2.4-2-2z" /></svg> }
function MegaphoneIcon() { return <svg {...sv}><path d="M3 11v2a1 1 0 0 0 1 1h2l8 4.5V5.5L6 10H4a1 1 0 0 0-1 1z" /><path d="M18 8.5a4 4 0 0 1 0 7" /></svg> }
function SparkIcon() { return <svg {...sv}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8" /></svg> }
function CartIcon() { return <svg {...sv}><path d="M3 4h2l2.5 11h11l2-8H6" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg> }
function ChartIcon() { return <svg {...sv}><path d="M3 20h18" /><path d="M6 16V9M11 16V5M16 16v-5M21 16V3" /></svg> }
function GearIcon() { return <svg {...sv}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg> }
