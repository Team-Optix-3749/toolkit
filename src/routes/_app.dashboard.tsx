import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { nextOccurrences } from '~/lib/recurrence'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildSession, Notification, OpiInitiative } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})

type Summary = { build_hours: number; outreach_hours: number; total_hours: number }

function Dashboard() {
  const { user, profile } = useAuth()
  const [summary, setSummary] = useState<Summary>({ build_hours: 0, outreach_hours: 0, total_hours: 0 })
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [opis, setOpis] = useState<OpiInitiative[]>([])

  useEffect(() => {
    ;(async () => {
      const [{ data: s }, { data: sched }, { data: n }, { data: o }] = await Promise.all([
        supabase.from('hours_summary').select('build_hours, outreach_hours, total_hours').eq('user_id', user!.id).maybeSingle(),
        supabase.from('build_schedule').select('*'),
        supabase.from('notifications').select('*').eq('user_id', user!.id).is('read_at', null).order('created_at', { ascending: false }).limit(5),
        supabase.from('opi_initiatives').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      ])
      if (s) setSummary(s as Summary)
      setSessions((sched as BuildSession[]) || [])
      setNotifs((n as Notification[]) || [])
      setOpis((o as OpiInitiative[]) || [])
    })()
  }, [])

  const upcoming = useMemo(() => {
    const out: { s: BuildSession; when: Date }[] = []
    for (const s of sessions) for (const d of nextOccurrences(s.starts_at, s.rrule, 2)) out.push({ s, when: d })
    return out.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 5)
  }, [sessions])

  const pendingOpi = opis.filter((o) => o.status === 'SUBMITTED' || o.status === 'RESUBMITTED' || o.status === 'CHANGES_REQUESTED')

  const tiles: [string, number][] = [
    ['Build hrs', summary.build_hours],
    ['Outreach hrs', summary.outreach_hours],
    ['Total hrs', summary.total_hours],
    ['Open OPIs', pendingOpi.length],
  ]

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}.
        </h1>
        <p className="text-sm text-ink-soft mt-0.5">Here's where things stand today.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line">
        {tiles.map(([k, v]) => (
          <div key={k} className="bg-panel px-4 py-4">
            <div className="font-mono text-2xl tabular-nums">{v}</div>
            <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{k}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Upcoming sessions</span>
            <Link to="/build" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-line">
            {upcoming.map(({ s, when }, i) => (
              <div key={s.id + i} className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-sm">{s.title}</span>
                <span className="text-xs font-mono text-ink-soft">{fmtDateTime(when.toISOString())}</span>
              </div>
            ))}
            {upcoming.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">Nothing scheduled.</div>}
          </div>
        </section>

        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Notifications</span>
            <Link to="/notifications" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-line">
            {notifs.map((n) => (
              <div key={n.id} className="px-5 py-2.5">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-ink-soft">{n.body}</div>}
              </div>
            ))}
            {notifs.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No new notifications.</div>}
          </div>
        </section>
      </div>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>My OPI status</span>
          <Link to="/opi" className="text-[11px] font-mono uppercase text-accent hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-line">
          {opis.slice(0, 5).map((o) => (
            <Link key={o.id} to="/opi/$id" params={{ id: o.id }} className="px-5 py-2.5 flex items-center justify-between hover:bg-canvas">
              <span className="text-sm">{o.title}</span>
              <Badge label={o.status.replace('_', ' ')} tone={o.status} />
            </Link>
          ))}
          {opis.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No initiatives submitted.</div>}
        </div>
      </section>
    </>
  )
}
