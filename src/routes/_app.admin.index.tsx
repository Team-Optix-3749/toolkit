import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import { isOwner } from '~/lib/rbac'
import type { Opi, OutreachEvent, BuildSession, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/')({
  component: AdminDashboard,
})

type Stats = {
  members: number
  pending: number
  activeCheckins: number
  upcomingOutreach: number
  openOpis: number
  openTasks: number
  pendingPurchases: number
  pendingIndividual: number
}

const ZERO: Stats = {
  members: 0,
  pending: 0,
  activeCheckins: 0,
  upcomingOutreach: 0,
  openOpis: 0,
  openTasks: 0,
  pendingPurchases: 0,
  pendingIndividual: 0,
}

function AdminDashboard() {
  const { profile, role } = useAuth()
  const owner = isOwner(role)
  const { flash, Toast } = useToast()
  const [s, setS] = useState<Stats>(ZERO)
  const [loading, setLoading] = useState(true)
  const [recentOpis, setRecentOpis] = useState<Opi[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<OutreachEvent[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<BuildSession[]>([])
  const [recentMembers, setRecentMembers] = useState<Pick<ProfileRow, 'id' | 'display_name' | 'role'>[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function load() {
    const now = new Date().toISOString()
    const [
      members, pending, checkins, outreach, opis, tasks, purchases, individual,
      opiRows, eventRows, sessionRows, memberRows,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'active').neq('role', 'PENDING'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'PENDING').eq('account_status', 'active'),
      supabase.from('build_records').select('id', { count: 'exact', head: true }).is('check_out', null),
      supabase.from('outreach_events').select('id', { count: 'exact', head: true }).eq('cancelled', false).gte('starts_at', now),
      supabase.from('opis').select('id', { count: 'exact', head: true }).in('status', ['SUBMITTED', 'RESUBMITTED']),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'resubmitted']),
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('individual_outreach').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('opis').select('*').in('status', ['SUBMITTED', 'RESUBMITTED', 'CHANGES_REQUESTED']).order('created_at', { ascending: false }).limit(5),
      supabase.from('outreach_events').select('*').eq('cancelled', false).gte('starts_at', now).order('starts_at').limit(5),
      supabase.from('build_sessions').select('*').eq('cancelled', false).gte('opens_at', now).order('opens_at').limit(5),
      supabase.from('profiles').select('id, display_name, role').eq('account_status', 'active').neq('role', 'PENDING').order('created_at', { ascending: false }).limit(8),
    ])

    setS({
      members: members.count ?? 0,
      pending: pending.count ?? 0,
      activeCheckins: checkins.count ?? 0,
      upcomingOutreach: outreach.count ?? 0,
      openOpis: opis.count ?? 0,
      openTasks: tasks.count ?? 0,
      pendingPurchases: purchases.count ?? 0,
      pendingIndividual: individual.count ?? 0,
    })
    setRecentOpis((opiRows.data as Opi[]) || [])
    setUpcomingEvents((eventRows.data as OutreachEvent[]) || [])
    setUpcomingSessions((sessionRows.data as BuildSession[]) || [])
    setRecentMembers((memberRows.data as Pick<ProfileRow, 'id' | 'display_name' | 'role'>[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function cancelSession(id: string) {
    const { error } = await supabase.rpc('build_action', { payload: { action: 'cancel', id } })
    setConfirmId(null)
    if (error) return flash('Cancel failed: ' + error.message, true)
    flash('Session cancelled')
    load()
  }

  async function cancelEvent(id: string) {
    const { error } = await supabase.rpc('outreach_action', { payload: { action: 'cancel', id } })
    setConfirmId(null)
    if (error) return flash('Cancel failed: ' + error.message, true)
    flash('Event cancelled')
    load()
  }

  async function rejectOpi(id: string) {
    const { error } = await supabase.rpc('opi_action', {
      payload: { action: 'reject', id, feedback: 'Rejected from admin dashboard' },
    })
    setConfirmId(null)
    if (error) return flash('Reject failed: ' + error.message, true)
    flash('OPI rejected')
    load()
  }

  async function deactivateMember(id: string) {
    const { error } = await supabase.from('profiles').update({ account_status: 'deactivated' }).eq('id', id)
    setConfirmId(null)
    if (error) return flash('Deactivate failed: ' + error.message, true)
    flash('Member deactivated')
    load()
  }

  const needsAttention = s.pending + s.openOpis + s.openTasks + s.pendingPurchases + s.pendingIndividual
  const firstName = profile?.display_name?.split(' ')[0] || 'Admin'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Hey, {firstName}</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/build/schedule/new" className={btnGhost}>+ Session</Link>
          <Link to="/admin/outreach/events/new" className={btnGhost}>+ Event</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Active members" value={s.members} loading={loading} />
        <Stat label="Checked in now" value={s.activeCheckins} loading={loading} accent />
        <Stat label="Upcoming events" value={s.upcomingOutreach} loading={loading} />
        <Stat label="Needs attention" value={needsAttention} loading={loading} warn={needsAttention > 0} />
      </div>

      {/* Owner shortcut */}
      {owner && (
        <Link
          to="/owner"
          className="flex items-center justify-between gap-3 bg-panel backdrop-blur-xl border border-accent/20 rounded-2xl px-5 py-3.5 hover:bg-accent/5 hover:border-accent/30 transition-all duration-150 shadow-[0_2px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(180,245,78,0.08)]"
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <div>
              <div className="text-sm font-semibold text-accent">Owner console</div>
              <div className="text-xs text-ink-soft mt-0.5">Full read/write access to every record · hard-delete rows</div>
            </div>
          </div>
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* Action queue */}
      {!loading && needsAttention > 0 && (
        <section className="border border-[#e67e22]/30 bg-[#e67e22]/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[#e67e22]/20">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#e67e22]">
              Action required
            </span>
          </div>
          <div className="divide-y divide-[#e67e22]/10">
            {s.pending > 0 && <QueueRow to="/admin/members/pending" label="Pending member approvals" count={s.pending} />}
            {s.openOpis > 0 && <QueueRow to="/admin/opi" label="OPIs awaiting review" count={s.openOpis} />}
            {s.openTasks > 0 && <QueueRow to="/admin/members" label="Tasks awaiting review" count={s.openTasks} />}
            {s.pendingPurchases > 0 && <QueueRow to="/admin/purchases" label="Purchases pending approval" count={s.pendingPurchases} />}
            {s.pendingIndividual > 0 && <QueueRow to="/admin/outreach/individual" label="Individual outreach pending" count={s.pendingIndividual} />}
          </div>
        </section>
      )}

      {/* Two-column content grid */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* OPIs needing review */}
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Open OPIs</span>
            <Link to="/admin/opi" className="text-[11px] font-mono uppercase text-accent hover:underline">All OPIs</Link>
          </div>
          <div className="divide-y divide-white/4">
            {recentOpis.map((o) => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3 group transition-colors duration-150 hover:bg-white/[0.03]">
                <Link to="/admin/opi/$id/review" params={{ id: o.id }} className="min-w-0 flex-1">
                  <div className="text-sm truncate group-hover:text-ink">{o.title}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{fmtDateTime(o.created_at)}</div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge label={o.status.replace('_', ' ')} tone={o.status} />
                  {confirmId === `opi-${o.id}` ? (
                    <ConfirmInline
                      onConfirm={() => rejectOpi(o.id)}
                      onCancel={() => setConfirmId(null)}
                      label="Reject?"
                    />
                  ) : (
                    <RemoveBtn onClick={() => setConfirmId(`opi-${o.id}`)} />
                  )}
                </div>
              </div>
            ))}
            {recentOpis.length === 0 && <Empty text="No OPIs need review." />}
          </div>
        </section>

        {/* Upcoming outreach */}
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Upcoming outreach</span>
            <Link to="/admin/outreach/events" className="text-[11px] font-mono uppercase text-accent hover:underline">All events</Link>
          </div>
          <div className="divide-y divide-white/4">
            {upcomingEvents.map((ev) => (
              <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3 group transition-colors duration-150 hover:bg-white/[0.03]">
                <Link to="/outreach/events/$id" params={{ id: ev.id }} className="min-w-0 flex-1">
                  <div className="text-sm truncate group-hover:text-ink">{ev.title}</div>
                  {ev.location && <div className="text-xs text-ink-soft mt-0.5">{ev.location}</div>}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-ink-soft whitespace-nowrap hidden sm:inline">{fmtDateTime(ev.starts_at)}</span>
                  {confirmId === `ev-${ev.id}` ? (
                    <ConfirmInline
                      onConfirm={() => cancelEvent(ev.id)}
                      onCancel={() => setConfirmId(null)}
                      label="Cancel?"
                    />
                  ) : (
                    <RemoveBtn onClick={() => setConfirmId(`ev-${ev.id}`)} />
                  )}
                </div>
              </div>
            ))}
            {upcomingEvents.length === 0 && <Empty text="No upcoming events." />}
          </div>
        </section>

        {/* Upcoming build sessions */}
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Upcoming sessions</span>
            <Link to="/admin/build/schedule" className="text-[11px] font-mono uppercase text-accent hover:underline">Schedule</Link>
          </div>
          <div className="divide-y divide-white/4">
            {upcomingSessions.map((sess) => (
              <div key={sess.id} className="px-5 py-3 flex items-center justify-between gap-3 group transition-colors duration-150 hover:bg-white/[0.03]">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{sess.title}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-ink-soft whitespace-nowrap hidden sm:inline">{fmtDateTime(sess.opens_at)}</span>
                  {confirmId === `sess-${sess.id}` ? (
                    <ConfirmInline
                      onConfirm={() => cancelSession(sess.id)}
                      onCancel={() => setConfirmId(null)}
                      label="Cancel?"
                    />
                  ) : (
                    <RemoveBtn onClick={() => setConfirmId(`sess-${sess.id}`)} />
                  )}
                </div>
              </div>
            ))}
            {upcomingSessions.length === 0 && <Empty text="No upcoming sessions." />}
          </div>
        </section>

        {/* Recent members */}
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Recent members</span>
            <Link to="/admin/members" className="text-[11px] font-mono uppercase text-accent hover:underline">All members</Link>
          </div>
          <div className="divide-y divide-white/4">
            {recentMembers.map((m) => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3 group transition-colors duration-150 hover:bg-white/[0.03]">
                <Link to="/admin/members/$id" params={{ id: m.id }} className="text-sm truncate group-hover:text-ink flex-1 min-w-0">
                  {m.display_name || m.id.slice(0, 8)}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono uppercase px-2 py-0.5 border border-white/10 rounded-md text-ink-soft">{m.role}</span>
                  {confirmId === `mem-${m.id}` ? (
                    <ConfirmInline
                      onConfirm={() => deactivateMember(m.id)}
                      onCancel={() => setConfirmId(null)}
                      label="Deactivate?"
                    />
                  ) : (
                    <RemoveBtn onClick={() => setConfirmId(`mem-${m.id}`)} />
                  )}
                </div>
              </div>
            ))}
            {recentMembers.length === 0 && <Empty text="No members yet." />}
          </div>
        </section>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <QuickLink to="/admin/build/qr" label="QR code" />
        <QuickLink to="/admin/build/zones" label="Locations" />
        <QuickLink to="/admin/build/attendance" label="Live attendance" />
        <QuickLink to="/admin/reports/hours" label="Hours report" />
        <QuickLink to="/admin/reports/opi" label="OPI analytics" />
        <QuickLink to="/admin/reports/purchases" label="Purchase report" />
        <QuickLink to="/admin/outreach/attendance" label="Outreach log" />
        <QuickLink to="/admin/purchases" label="Purchases" />
        <QuickLink to="/admin/settings" label="Settings" />
      </div>

      {Toast}
    </div>
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); onClick() }}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-soft hover:text-[#c0392b] hover:bg-[#c0392b]/10 border border-transparent hover:border-[#c0392b]/20 opacity-0 group-hover:opacity-100 transition-all"
      title="Remove"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

function ConfirmInline({ onConfirm, onCancel, label }: { onConfirm: () => void; onCancel: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[#c0392b]">{label}</span>
      <button
        onClick={(e) => { e.preventDefault(); onConfirm() }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs border border-[#c0392b]/30 text-[#c0392b] bg-[#c0392b]/10 hover:bg-[#c0392b]/20 transition-all"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.preventDefault(); onCancel() }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs border border-white/10 text-ink-soft hover:bg-white/10 transition-all"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function Stat({ label, value, loading, accent, warn }: {
  label: string; value: number; loading: boolean; accent?: boolean; warn?: boolean
}) {
  return (
    <div className="bg-panel backdrop-blur-xl border border-white/8 rounded-2xl px-4 py-4">
      {loading ? (
        <div className="skeleton h-7 w-10 mb-1" />
      ) : (
        <div className={`font-mono text-2xl tabular-nums ${warn ? 'text-[#e67e22]' : accent ? 'text-accent' : ''}`}>
          {value}
        </div>
      )}
      <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{label}</div>
    </div>
  )
}

function QueueRow({ to, label, count }: { to: string; label: string; count: number }) {
  return (
    <Link to={to} className="flex items-center justify-between px-5 py-3 hover:bg-[#e67e22]/10 transition-colors duration-150 group">
      <span className="text-sm">{label}</span>
      <span className="text-xs font-mono font-medium px-2 py-0.5 bg-[#e67e22]/15 text-[#e67e22] border border-[#e67e22]/30 rounded-md">
        {count}
      </span>
    </Link>
  )
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="bg-panel backdrop-blur-xl border border-white/8 rounded-xl px-4 py-3 text-sm text-ink-soft hover:text-ink hover:bg-white/10 hover:border-white/12 active:scale-[0.98] transition-all duration-150">
      {label}
    </Link>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-6 text-center text-ink-soft text-sm">{text}</div>
}
