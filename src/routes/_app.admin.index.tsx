import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { accountAction, accountDirectory as loadAccountDirectory } from '~/lib/actions'
import { useAuth } from '~/lib/auth'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import { can, isAdmin, isOwner, ROLE_LABEL } from '~/lib/rbac'
import type { Permission, ProfileRow, Opi, OutreachEvent, BuildSession } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/')({ component: AdminDashboard })
type Counts = { members: number; pending: number; activeCheckins: number; upcomingOutreach: number; openOpis: number; openTasks: number; pendingPurchases: number; pendingIndividual: number }
const EMPTY: Counts = { members: 0, pending: 0, activeCheckins: 0, upcomingOutreach: 0, openOpis: 0, openTasks: 0, pendingPurchases: 0, pendingIndividual: 0 }

function AdminDashboard() {
  const { profile, role } = useAuth()
  const accounts = can(profile, 'manage_accounts')
  const accountDirectory = accounts || isAdmin(role)
  const build = can(profile, 'manage_build_hours')
  const events = can(profile, 'manage_outreach_events')
  const opis = can(profile, 'manage_opis')
  const tasks = can(profile, 'manage_tasks')
  const purchases = can(profile, 'manage_purchases')
  const individual = can(profile, 'manage_outreach_attendance')
  const [counts, setCounts] = useState<Counts>(EMPTY)
  const [recentOpis, setRecentOpis] = useState<Opi[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<OutreachEvent[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<BuildSession[]>([])
  const [members, setMembers] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState<{ action: 'deactivate' | 'cancel_event' | 'cancel_session'; id: string } | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    const now = new Date().toISOString()
    try {
      const directory = accountDirectory ? await loadAccountDirectory() : { data: [], error: null }
      if (directory.error) throw directory.error
      const people = directory.data ?? []
      setMembers(people.filter(person => person.account_status === 'active' && person.role !== 'PENDING').slice(0, 8))
      const next: Counts = { ...EMPTY, members: people.filter(person => person.account_status === 'active' && person.role !== 'PENDING').length, pending: accounts ? people.filter(person => person.role === 'PENDING' && person.account_status === 'active').length : 0 }
      if (build) {
        const [rows, active] = await Promise.all([
          supabase.from('build_sessions').select('*').eq('cancelled', false).gte('opens_at', now).order('opens_at').limit(5),
          supabase.from('build_records').select('id', { count: 'exact', head: true }).is('check_out', null),
        ])
        if (rows.error) throw rows.error
        if (active.error) throw active.error
        setUpcomingSessions((rows.data ?? []) as BuildSession[])
        next.activeCheckins = active.count ?? 0
      }
      if (events) {
        const result = await supabase.from('outreach_events').select('*', { count: 'exact' }).eq('cancelled', false).gte('starts_at', now).order('starts_at').limit(5)
        if (result.error) throw result.error
        setUpcomingEvents((result.data ?? []) as OutreachEvent[])
        next.upcomingOutreach = result.count ?? 0
      }
      if (opis) {
        const result = await supabase.from('opis').select('*', { count: 'exact' }).in('status', ['SUBMITTED', 'RESUBMITTED']).order('created_at', { ascending: false }).limit(5)
        if (result.error) throw result.error
        setRecentOpis((result.data ?? []) as Opi[])
        next.openOpis = result.count ?? 0
      }
      if (tasks) {
        const result = await supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'resubmitted'])
        if (result.error) throw result.error
        next.openTasks = result.count ?? 0
      }
      if (purchases) {
        const result = await supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('status', 'PENDING')
        if (result.error) throw result.error
        next.pendingPurchases = result.count ?? 0
      }
      if (individual) {
        const result = await supabase.from('individual_outreach').select('id', { count: 'exact', head: true }).eq('status', 'PENDING')
        if (result.error) throw result.error
        next.pendingIndividual = result.count ?? 0
      }
      setCounts(next)
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [accountDirectory, accounts, build, events, opis, tasks, purchases, individual])

  async function act() {
    if (!confirm || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = confirm.action === 'deactivate'
        ? await accountAction({ action: 'deactivate', id: confirm.id })
        : confirm.action === 'cancel_event'
          ? await supabase.rpc('outreach_action', { payload: { action: 'cancel', id: confirm.id } })
          : await supabase.rpc('build_action', { payload: { action: 'cancel', id: confirm.id } })
      if (result.error) throw result.error
      if (confirm.action === 'deactivate' && profile?.id === confirm.id) {
        window.location.assign(`${import.meta.env.BASE_URL}dashboard`)
        return
      }
      setMessage(confirm.action === 'deactivate' ? 'Account deactivated; sessions revoked and history retained.' : 'Cancelled; retained records are preserved.')
      setConfirm(null)
      await load()
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setBusy(false) }
  }
  const queue = [
    ...(accounts ? [{ to: '/admin/members/pending', label: 'Pending member approvals', count: counts.pending }] : []),
    ...(opis ? [{ to: '/admin/opi', label: 'OPIs awaiting review', count: counts.openOpis }] : []),
    ...(tasks ? [{ to: '/tasks', label: 'Tasks awaiting review', count: counts.openTasks }] : []),
    ...(purchases ? [{ to: '/admin/purchases', label: 'Purchases pending approval', count: counts.pendingPurchases }] : []),
    ...(individual ? [{ to: '/admin/outreach/individual', label: 'Individual outreach pending', count: counts.pendingIndividual }] : []),
  ]
  const links: { to: string; label: string; permission?: Permission; president?: boolean }[] = [
    { to: '/admin/build/qr', label: 'QR code', permission: 'manage_build_hours' },
    { to: '/admin/build/zones', label: 'Locations', permission: 'manage_build_hours' },
    { to: '/admin/build/attendance', label: 'Build attendance', permission: 'manage_build_hours' },
    { to: '/admin/reports/hours', label: 'Hours report', permission: 'export_records' },
    { to: '/admin/reports/opi', label: 'OPI analytics', permission: 'export_records' },
    { to: '/admin/reports/purchases', label: 'Purchase report', permission: 'export_records' },
    { to: '/admin/outreach/attendance', label: 'Outreach log', permission: 'manage_outreach_attendance' },
    { to: '/admin/purchases', label: 'Purchases', permission: 'manage_purchases' },
    { to: '/admin/settings', label: 'Settings', president: true },
  ]
  return <div className="space-y-5">
    <div className="flex items-end justify-between gap-4 flex-wrap"><div><h1 className="text-xl font-semibold">Hey, {profile?.display_name?.split(' ')[0] || 'Admin'}</h1><p className="text-sm text-ink-soft">Your authorized administration workflows</p></div><div className="flex gap-2">{build && <Link to="/admin/build/schedule/new" className={btnGhost}>+ Session</Link>}{events && <Link to="/admin/outreach/events/new" className={btnGhost}>+ Event</Link>}</div></div>
    {error && <div role="alert" className="text-sm text-red-400">{error} <button disabled={busy} onClick={load} className={btnGhost}>Retry load</button></div>}
    {message && <p role="status" className="text-sm text-accent">{message}</p>}
    {confirm && <section className={card}><div className="p-5 space-y-3"><h2 className="font-semibold">{confirm.action === 'deactivate' ? 'Deactivate account?' : 'Cancel this item?'}</h2><p className="text-sm text-ink-soft">{confirm.action === 'deactivate' ? 'Access is revoked immediately. Reactivation requires a fresh sign-in.' : 'Operational records are retained.'}</p><button disabled={busy} onClick={act} className={btn}>{busy ? 'Working…' : 'Confirm'}</button> <button disabled={busy} onClick={() => setConfirm(null)} className={btnGhost}>Back</button></div></section>}
    {isOwner(role) && <Link to="/owner" className={`${card} block p-5 border-accent/20`}><strong className="text-accent">President console</strong><p className="text-sm text-ink-soft">Browse retained records and use authorized domain actions.</p></Link>}
    {loading ? <p className="p-5 text-sm text-ink-soft">Loading administration overview…</p> : !error && <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{accountDirectory && <Stat label="Active members" value={counts.members} />}{build && <Stat label="Checked in now" value={counts.activeCheckins} />}{events && <Stat label="Upcoming events" value={counts.upcomingOutreach} />}<Stat label="Needs attention" value={queue.reduce((sum, row) => sum + row.count, 0)} /></div>
      {queue.some(row => row.count > 0) && <section className={card}><div className={cardHead}><span className={cardTitle}>Action required</span></div>{queue.filter(row => row.count > 0).map(row => <Link key={row.to} to={row.to} className="flex justify-between px-5 py-3 hover:bg-white/5 text-sm"><span>{row.label}</span><span className="font-mono text-accent">{row.count}</span></Link>)}</section>}
      <div className="grid lg:grid-cols-2 gap-5">
        {opis && <section className={card}><PanelHead title="Open OPIs" to="/admin/opi" /><div className="divide-y divide-line">{recentOpis.map(opi => <Link key={opi.id} to="/admin/opi/$id/review" params={{ id: opi.id }} className="flex justify-between p-5 text-sm hover:bg-white/5"><span>{opi.title}<span className="block text-xs text-ink-soft">{fmtDateTime(opi.created_at)}</span></span><Badge label={opi.status.replaceAll('_', ' ')} tone={opi.status} /></Link>)}{!recentOpis.length && <Empty text="No OPIs need review." />}</div></section>}
        {events && <section className={card}><PanelHead title="Upcoming outreach" to="/admin/outreach/events" /><div className="divide-y divide-line">{upcomingEvents.map(event => <div key={event.id} className="p-5 flex items-center justify-between gap-3"><Link to="/outreach/events/$id" params={{ id: event.id }} className="text-sm">{event.title}<span className="block text-xs text-ink-soft">{event.location} · {fmtDateTime(event.starts_at)}</span></Link><button disabled={busy} onClick={() => setConfirm({ action: 'cancel_event', id: event.id })} className={btnGhost}>Cancel event</button></div>)}{!upcomingEvents.length && <Empty text="No upcoming events." />}</div></section>}
        {build && <section className={card}><PanelHead title="Upcoming sessions" to="/admin/build/schedule" /><div className="divide-y divide-line">{upcomingSessions.map(session => <div key={session.id} className="p-5 flex items-center justify-between gap-3"><span className="text-sm">{session.title}<span className="block text-xs text-ink-soft">{fmtDateTime(session.opens_at)}</span></span><button disabled={busy} onClick={() => setConfirm({ action: 'cancel_session', id: session.id })} className={btnGhost}>Cancel session</button></div>)}{!upcomingSessions.length && <Empty text="No upcoming sessions." />}</div></section>}
        {accountDirectory && <section className={card}><PanelHead title="Accounts" to="/admin/members" /><div className="divide-y divide-line">{members.map(member => <div key={member.id} className="p-5 flex flex-wrap items-center gap-3"><Link to="/admin/members/$id" params={{ id: member.id }} className="text-sm flex-1">{member.display_name || 'Unnamed account'}<span className="block text-xs text-ink-soft">{member.account_type} · {member.verified ? 'Verified' : 'Not verified'}</span></Link><Badge label={ROLE_LABEL[member.role] ?? member.role} tone={member.role} />{accounts && member.role === 'MEMBER' && <button disabled={busy} onClick={() => setConfirm({ action: 'deactivate', id: member.id })} className={btnGhost}>Deactivate</button>}</div>)}{!members.length && <Empty text="No admitted active accounts." />}</div></section>}
      </div>
    </>}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{accountDirectory && <Link to="/admin/members" className={`${card} p-4 text-sm`}>Accounts</Link>}{links.filter(link => link.president ? isOwner(role) : link.permission && can(profile, link.permission)).map(link => <Link key={link.to} to={link.to} className={`${card} p-4 text-sm text-ink-soft hover:text-ink`}>{link.label}</Link>)}</div>
  </div>
}
function PanelHead({ title, to }: { title: string; to: string }) { return <div className={cardHead}><span className={cardTitle}>{title}</span><Link to={to} className="text-xs text-accent">View all →</Link></div> }
function Stat({ label, value }: { label: string; value: number }) { return <div className={`${card} p-4`}><div className="font-mono text-2xl">{value}</div><div className="text-xs text-ink-soft mt-1">{label}</div></div> }
function Empty({ text }: { text: string }) { return <p className="p-5 text-sm text-ink-soft">{text}</p> }
