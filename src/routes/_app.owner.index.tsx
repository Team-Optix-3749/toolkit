import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/owner/')({
  component: OwnerOverview,
})

type Counts = {
  members: number
  opis: number
  purchases: number
  events: number
  tasks: number
  sessions: number
}

function OwnerOverview() {
  const [c, setC] = useState<Counts | null>(null)

  useEffect(() => {
    ;(async () => {
      const [m, o, p, e, t, s] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('opis').select('id', { count: 'exact', head: true }),
        supabase.from('purchases').select('id', { count: 'exact', head: true }),
        supabase.from('outreach_events').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('build_sessions').select('id', { count: 'exact', head: true }),
      ])
      setC({
        members: m.count ?? 0,
        opis: o.count ?? 0,
        purchases: p.count ?? 0,
        events: e.count ?? 0,
        tasks: t.count ?? 0,
        sessions: s.count ?? 0,
      })
    })()
  }, [])

  return (
    <div className="space-y-5">
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Record counts</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/5">
          <StatTile label="Members" value={c?.members} />
          <StatTile label="OPIs" value={c?.opis} />
          <StatTile label="Purchases" value={c?.purchases} />
          <StatTile label="Outreach events" value={c?.events} />
          <StatTile label="Tasks" value={c?.tasks} />
          <StatTile label="Build sessions" value={c?.sessions} />
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Danger zone</span>
          <span className="text-[11px] text-ink-soft">All deletes here are permanent.</span>
        </div>
        <div className="divide-y divide-white/4">
          <DangerLink to="/owner/members" label="Hard-delete a member" sub="Removes every record they created across all tables." />
          <DangerLink to="/owner/opis" label="Delete OPIs" sub="Deletes submissions, versions, and feedback." />
          <DangerLink to="/owner/purchases" label="Delete purchases" sub="Removes approval records and receipts." />
          <DangerLink to="/owner/events" label="Delete outreach events" sub="Removes attendance and leads." />
          <DangerLink to="/owner/tasks" label="Delete tasks" sub="Removes assignees, reviewers, evidence, history." />
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Admin shortcuts</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/5">
          <ShortcutTile to="/admin/settings" label="Settings" sub="Seasons, perms, roles" />
          <ShortcutTile to="/admin/notifications/templates" label="Email templates" sub="System messages" />
          <ShortcutTile to="/admin/cron-jobs" label="Cron jobs" sub="Scheduled tasks" />
          <ShortcutTile to="/admin/reports/hours" label="Hours report" sub="Export CSV" />
          <ShortcutTile to="/admin/build/zones" label="Build zones" sub="Locations & QR" />
          <ShortcutTile to="/admin" label="Admin dashboard" sub="Default admin view" />
        </div>
      </section>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="bg-panel px-5 py-4">
      {value === undefined ? (
        <div className="skeleton h-7 w-14 mb-1" />
      ) : (
        <div className="font-mono text-2xl tabular-nums">{value}</div>
      )}
      <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{label}</div>
    </div>
  )
}

function DangerLink({ to, label, sub }: { to: string; label: string; sub: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[#c0392b]/5 transition-colors duration-150"
    >
      <div>
        <div className="text-sm font-medium group-hover:text-[#f07070] transition-colors">{label}</div>
        <div className="text-xs text-ink-soft mt-0.5">{sub}</div>
      </div>
      <svg className="w-4 h-4 text-ink-soft group-hover:text-[#f07070] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

function ShortcutTile({ to, label, sub }: { to: string; label: string; sub: string }) {
  return (
    <Link to={to} className="bg-panel px-5 py-3 hover:bg-white/5 transition-colors duration-150">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-ink-soft mt-0.5 truncate">{sub}</div>
    </Link>
  )
}
