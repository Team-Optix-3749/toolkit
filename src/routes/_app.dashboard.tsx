import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildRecord, BuildSession, Notification, Opi, Task, OutreachEvent } from '~/lib/types'
import { card, cardHead, cardTitle, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})

type Summary = { build_hours: number; outreach_hours: number; total_hours: number }

function Dashboard() {
  const { user, profile } = useAuth()
  const [summary, setSummary] = useState<Summary>({ build_hours: 0, outreach_hours: 0, total_hours: 0 })
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [opis, setOpis] = useState<Opi[]>([])
  const [activeCheckin, setActiveCheckin] = useState<BuildRecord | null>(null)
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [reviewTasks, setReviewTasks] = useState<Task[]>([])
  const [upcomingOutreach, setUpcomingOutreach] = useState<OutreachEvent[]>([])

  useEffect(() => {
    const uid = user!.id
    ;(async () => {
      const [
        { data: s },
        { data: sched },
        { data: n },
        { data: o },
        { data: checkin },
        { data: assignedIds },
        { data: reviewerIds },
        { data: outreach },
      ] = await Promise.all([
        supabase.from('hours_summary').select('build_hours, outreach_hours, total_hours').eq('user_id', uid).maybeSingle(),
        supabase.from('build_sessions').select('*').gte('opens_at', new Date().toISOString()).order('opens_at').limit(10),
        supabase.from('notifications').select('*').eq('user_id', uid).is('read_at', null).order('created_at', { ascending: false }).limit(5),
        supabase.from('opis').select('*').eq('submitter_id', uid).order('created_at', { ascending: false }),
        supabase.from('build_records').select('*').eq('member_id', uid).is('check_out', null).order('check_in', { ascending: false }).limit(1),
        supabase.from('task_assignees').select('task_id').eq('user_id', uid),
        supabase.from('task_reviewers').select('task_id').eq('user_id', uid),
        supabase.from('outreach_events').select('*').gte('starts_at', new Date().toISOString()).eq('cancelled', false).order('starts_at').limit(5),
      ])
      if (s) setSummary(s as Summary)
      setSessions((sched as BuildSession[]) || [])
      setNotifs((n as Notification[]) || [])
      setOpis((o as Opi[]) || [])
      setActiveCheckin((checkin as BuildRecord[])?.[0] ?? null)
      setUpcomingOutreach((outreach as OutreachEvent[]) || [])

      const assignedTaskIds = (assignedIds as { task_id: string }[] || []).map(r => r.task_id)
      const reviewerTaskIds = (reviewerIds as { task_id: string }[] || []).map(r => r.task_id)

      if (assignedTaskIds.length > 0) {
        const { data: tasks } = await supabase
          .from('tasks').select('*')
          .in('id', assignedTaskIds)
          .in('status', ['assigned', 'in_progress', 'changes_requested'])
          .order('deadline', { ascending: true, nullsFirst: false })
        setMyTasks((tasks as Task[]) || [])
      }

      if (reviewerTaskIds.length > 0) {
        const { data: tasks } = await supabase
          .from('tasks').select('*')
          .in('id', reviewerTaskIds)
          .in('status', ['submitted', 'resubmitted'])
        setReviewTasks((tasks as Task[]) || [])
      }
    })()
  }, [])

  const pendingOpi = opis.filter((o) => o.status === 'SUBMITTED' || o.status === 'RESUBMITTED' || o.status === 'CHANGES_REQUESTED')
  const overdueTasks = myTasks.filter(t => t.deadline && new Date(t.deadline) < new Date())

  const tiles: [string, number][] = [
    ['Build hrs', summary.build_hours],
    ['Outreach hrs', summary.outreach_hours],
    ['Total hrs', summary.total_hours],
    ['Open OPIs', pendingOpi.length],
  ]

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-ink-soft mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {activeCheckin && (
        <section className="bg-lime/10 border border-lime/30 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-lime">You're checked in to a build session</div>
            <div className="text-xs text-ink-soft mt-0.5">
              Since {fmtDateTime(activeCheckin.check_in)}
            </div>
          </div>
          <Link to="/build/check-in" className={btn}>
            Check out
          </Link>
        </section>
      )}

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
            <span className={cardTitle}>My tasks</span>
            <Link to="/tasks" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-line">
            {overdueTasks.length > 0 && (
              <div className="px-5 py-2 bg-danger/5 text-xs font-mono uppercase text-danger tracking-wide">
                {overdueTasks.length} overdue
              </div>
            )}
            {myTasks.slice(0, 5).map((t) => {
              const overdue = t.deadline && new Date(t.deadline) < new Date()
              return (
                <div key={t.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${overdue ? 'text-danger font-medium' : ''}`}>{t.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.deadline && (
                      <span className={`text-xs font-mono ${overdue ? 'text-danger' : 'text-ink-soft'}`}>
                        {new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <Badge label={t.status.replace('_', ' ')} tone={t.status} />
                  </div>
                </div>
              )
            })}
            {myTasks.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No active tasks.</div>}
          </div>
        </section>

        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Awaiting my review</span>
            <Link to="/tasks" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-line">
            {reviewTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-sm truncate">{t.title}</span>
                <Badge label={t.status.replace('_', ' ')} tone={t.status} />
              </div>
            ))}
            {reviewTasks.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">Nothing to review.</div>}
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Upcoming outreach</span>
            <Link to="/outreach" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-line">
            {upcomingOutreach.slice(0, 5).map((ev) => (
              <Link key={ev.id} to="/outreach/events/$id" params={{ id: ev.id }} className="px-5 py-2.5 flex items-center justify-between hover:bg-canvas">
                <span className="text-sm">{ev.title}</span>
                <span className="text-xs font-mono text-ink-soft">{fmtDateTime(ev.starts_at)}</span>
              </Link>
            ))}
            {upcomingOutreach.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No upcoming events.</div>}
          </div>
        </section>

        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Upcoming sessions</span>
            <Link to="/build" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-line">
            {sessions.slice(0, 5).map((s) => (
              <div key={s.id} className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-sm">{s.title}</span>
                <span className="text-xs font-mono text-ink-soft">{fmtDateTime(s.opens_at)}</span>
              </div>
            ))}
            {sessions.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">Nothing scheduled.</div>}
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
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
      </div>
    </>
  )
}
