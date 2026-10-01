import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
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
  const [s, setS] = useState<Stats>(ZERO)
  const [loading, setLoading] = useState(true)
  const [recentOpis, setRecentOpis] = useState<Opi[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<OutreachEvent[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<BuildSession[]>([])
  const [recentMembers, setRecentMembers] = useState<Pick<ProfileRow, 'id' | 'display_name' | 'role'>[]>([])

  useEffect(() => {
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
    load()
  }, [])

  const needsAttention = s.pending + s.openOpis + s.openTasks + s.pendingPurchases + s.pendingIndividual

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin overview</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/build/schedule/new" className={btnGhost}>+ Session</Link>
          <Link to="/admin/outreach/events/new" className={btnGhost}>+ Event</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line">
        <Stat label="Active members" value={s.members} loading={loading} />
        <Stat label="Checked in now" value={s.activeCheckins} loading={loading} accent />
        <Stat label="Upcoming events" value={s.upcomingOutreach} loading={loading} />
        <Stat label="Needs attention" value={needsAttention} loading={loading} warn={needsAttention > 0} />
      </div>

      {/* Action queue */}
      {!loading && needsAttention > 0 && (
        <section className="border border-[#e67e22]/30 bg-[#e67e22]/5">
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
          <div className="divide-y divide-line">
            {recentOpis.map((o) => (
              <Link key={o.id} to="/admin/opi/$id/review" params={{ id: o.id }} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-canvas group">
                <div className="min-w-0">
                  <div className="text-sm truncate group-hover:text-ink">{o.title}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{fmtDateTime(o.created_at)}</div>
                </div>
                <Badge label={o.status.replace('_', ' ')} tone={o.status} />
              </Link>
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
          <div className="divide-y divide-line">
            {upcomingEvents.map((ev) => (
              <Link key={ev.id} to="/outreach/events/$id" params={{ id: ev.id }} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-canvas group">
                <div className="min-w-0">
                  <div className="text-sm truncate group-hover:text-ink">{ev.title}</div>
                  {ev.location && <div className="text-xs text-ink-soft mt-0.5">{ev.location}</div>}
                </div>
                <span className="text-xs font-mono text-ink-soft whitespace-nowrap">{fmtDateTime(ev.starts_at)}</span>
              </Link>
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
          <div className="divide-y divide-line">
            {upcomingSessions.map((sess) => (
              <div key={sess.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">{sess.title}</div>
                </div>
                <span className="text-xs font-mono text-ink-soft whitespace-nowrap">{fmtDateTime(sess.opens_at)}</span>
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
          <div className="divide-y divide-line">
            {recentMembers.map((m) => (
              <Link key={m.id} to="/admin/members/$id" params={{ id: m.id }} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-canvas group">
                <span className="text-sm truncate group-hover:text-ink">{m.display_name || m.id.slice(0, 8)}</span>
                <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 border border-line text-ink-soft">{m.role}</span>
              </Link>
            ))}
            {recentMembers.length === 0 && <Empty text="No members yet." />}
          </div>
        </section>
      </div>

      {/* Quick links footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line">
        <QuickLink to="/admin/build/qr" label="QR code display" />
        <QuickLink to="/admin/build/zones" label="Locations" />
        <QuickLink to="/admin/build/attendance" label="Live attendance" />
        <QuickLink to="/admin/reports/hours" label="Hours report" />
        <QuickLink to="/admin/reports/opi" label="OPI analytics" />
        <QuickLink to="/admin/reports/purchases" label="Purchase report" />
        <QuickLink to="/admin/outreach/attendance" label="Outreach log" />
        <QuickLink to="/admin/purchases" label="Purchases" />
        <QuickLink to="/admin/settings" label="Settings" />
      </div>
    </div>
  )
}

function Stat({ label, value, loading, accent, warn }: {
  label: string; value: number; loading: boolean; accent?: boolean; warn?: boolean
}) {
  return (
    <div className="bg-panel px-4 py-4">
      <div className={`font-mono text-2xl tabular-nums ${warn ? 'text-[#e67e22]' : accent ? 'text-accent' : ''}`}>
        {loading ? '—' : value}
      </div>
      <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{label}</div>
    </div>
  )
}

function QueueRow({ to, label, count }: { to: string; label: string; count: number }) {
  return (
    <Link to={to} className="flex items-center justify-between px-5 py-3 hover:bg-[#e67e22]/10 group">
      <span className="text-sm">{label}</span>
      <span className="text-xs font-mono font-medium px-2 py-0.5 bg-[#e67e22]/15 text-[#e67e22] border border-[#e67e22]/30">
        {count}
      </span>
    </Link>
  )
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="bg-panel px-4 py-3 text-sm text-ink-soft hover:text-ink hover:bg-canvas">
      {label}
    </Link>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-6 text-center text-ink-soft text-sm">{text}</div>
}
