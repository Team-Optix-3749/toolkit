import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { accountDirectory } from '~/lib/actions'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/owner/')({ component: OwnerOverview })
type Counts = { members: number; opis: number; purchases: number; events: number; tasks: number; sessions: number }
function OwnerOverview() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [error, setError] = useState('')
  async function load() {
    setError('')
    setCounts(null)
    try {
      const [m, o, p, e, t, s] = await Promise.all([
        accountDirectory(),
        supabase.from('opis').select('id', { count: 'exact', head: true }),
        supabase.from('purchases').select('id', { count: 'exact', head: true }),
        supabase.from('outreach_events').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('build_sessions').select('id', { count: 'exact', head: true }),
      ])
      for (const result of [m, o, p, e, t, s]) if (result.error) throw result.error
      setCounts({ members: m.data?.length ?? 0, opis: o.count ?? 0, purchases: p.count ?? 0, events: e.count ?? 0, tasks: t.count ?? 0, sessions: s.count ?? 0 })
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
  }
  useEffect(() => { void load() }, [])
  return <div className="space-y-5">
    {error && <div role="alert" className="text-sm text-red-400">{error} <button onClick={load} className={btnGhost}>Retry</button></div>}
    <section className={card}><div className={cardHead}><span className={cardTitle}>Record counts</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line">{(['members', 'opis', 'purchases', 'events', 'tasks', 'sessions'] as const).map(key => <div key={key} className="bg-panel px-5 py-4"><div className="font-mono text-2xl">{counts ? counts[key] : error ? '—' : '…'}</div><p className="text-xs text-ink-soft mt-1 capitalize">{key === 'members' ? 'Accounts' : key === 'opis' ? 'OPIs' : key}</p></div>)}</div></section>
    <section className={card}><div className={cardHead}><span className={cardTitle}>Retained records</span></div><p className="px-5 py-3 text-sm text-ink-soft">Browse all retained identities and operational history. Use domain screens for deactivation, cancellation and review; routine hard deletion is not available.</p><div className="divide-y divide-line">
      <BrowseLink to="/owner/members" label="Accounts" sub="Names and history remain after deactivation." />
      <BrowseLink to="/owner/opis" label="OPIs" sub="Retained submissions, versions and feedback." />
      <BrowseLink to="/owner/purchases" label="Purchases" sub="Requests, receipts and decisions." />
      <BrowseLink to="/owner/events" label="Outreach events" sub="Events and retained attendance." />
      <BrowseLink to="/owner/tasks" label="Tasks" sub="Calendar and list browsing, with links to task details." />
    </div></section>
    <section className={card}><div className={cardHead}><span className={cardTitle}>Administration shortcuts</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line">
      <Shortcut to="/admin/settings" label="Settings" sub="President configuration" />
      <Shortcut to="/admin/cron-jobs" label="Cron jobs" sub="Scheduled task status" />
      <Shortcut to="/admin/reports/hours" label="Hours report" sub="Export records" />
      <Shortcut to="/admin/build/zones" label="Build locations" sub="Locations and QR" />
      <Shortcut to="/admin/members" label="Account actions" sub="Admission, permissions and Presidency" />
      <Shortcut to="/admin" label="Admin dashboard" sub="Authorized workflows" />
    </div></section>
  </div>
}
function BrowseLink({ to, label, sub }: { to: string; label: string; sub: string }) { return <Link to={to} className="flex justify-between px-5 py-4 hover:bg-white/5"><div><div className="text-sm font-medium">{label}</div><p className="text-xs text-ink-soft mt-1">{sub}</p></div><span className="text-accent">→</span></Link> }
function Shortcut({ to, label, sub }: { to: string; label: string; sub: string }) { return <Link to={to} className="bg-panel px-5 py-3 hover:bg-white/5"><div className="text-sm font-medium">{label}</div><p className="text-xs text-ink-soft mt-1">{sub}</p></Link> }
