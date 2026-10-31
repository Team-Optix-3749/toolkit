import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { fmtDateTime, fmtDate } from '~/lib/format'
import { isOverdue } from '~/lib/time'
import { Badge } from '~/components/Badge'
import type { BuildRecord, BuildSession, Notification, Opi, Task, OutreachEvent } from '~/lib/types'
import { taskOverviews } from '~/lib/task-overviews'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})

type Summary = { build_hours: number; outreach_hours: number }
type Targets = { build: number; outreach: number }

function Dashboard() {
  const { user, profile } = useAuth()
  const [summary, setSummary] = useState<Summary>({ build_hours: 0, outreach_hours: 0 })
  const [targets, setTargets] = useState<Targets>({ build: 0, outreach: 0 })
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [opis, setOpis] = useState<Opi[]>([])
  const [activeCheckin, setActiveCheckin] = useState<BuildRecord | null>(null)
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [reviewTasks, setReviewTasks] = useState<Task[]>([])
  const [upcomingOutreach, setUpcomingOutreach] = useState<OutreachEvent[]>([])
  const [hoursError,setHoursError]=useState('')
  const [seasonId,setSeasonId]=useState('')
  const [loading, setLoading] = useState(true)
  const [panelErrors,setPanelErrors]=useState<string[]>([])

  useEffect(() => {
    const uid = user!.id
    ;(async () => {
      const [
        totals,
        { data: season,error:seasonError },
        { data: sched,error:scheduleError },
        { data: n,error:notificationError },
        { data: o,error:opiError },
        { data: checkin,error:buildError },
        { data: outreach,error:outreachError },
      ] = await Promise.all([
        supabase.rpc('season_hours',{payload:{}}),
        supabase.from('seasons').select('outreach_target, build_target').eq('is_current', true).maybeSingle(),
        supabase.from('build_sessions').select('*').gte('opens_at', new Date().toISOString()).order('opens_at').limit(10),
        supabase.from('notifications').select('*').eq('user_id', uid).is('read_at', null).order('created_at', { ascending: false }).limit(5),
        supabase.from('opis').select('*').eq('submitter_id', uid).order('created_at', { ascending: false }),
        supabase.from('build_records').select('*').eq('member_id', uid).is('check_out', null).order('check_in', { ascending: false }).limit(1),
        supabase.from('outreach_events').select('*').gte('starts_at', new Date().toISOString()).eq('cancelled', false).order('starts_at').limit(5),
      ])
      setPanelErrors([seasonError,scheduleError,notificationError,opiError,buildError,outreachError].filter(Boolean).map(error=>error!.message))
      if(totals.error)setHoursError(totals.error.message)
      else if(!totals.data.season)setHoursError('Season setup is required.')
      else {const row=totals.data.members.find((member:{id:string})=>member.id===uid);setSummary({build_hours:Number(row?.build_minutes??0)/60,outreach_hours:Number(row?.outreach_minutes??0)/60});setSeasonId(totals.data.season.id)}
      if (season) setTargets({ outreach: Number((season as { outreach_target: number }).outreach_target) || 0, build: Number((season as { build_target: number }).build_target) || 0 })
      setSessions((sched as BuildSession[]) || [])
      setNotifs((n as Notification[]) || [])
      setOpis((o as Opi[]) || [])
      setActiveCheckin((checkin as BuildRecord[])?.[0] ?? null)
      setUpcomingOutreach((outreach as OutreachEvent[]) || [])

      const overview = await taskOverviews()
      setMyTasks(overview.filter(task=>task.is_assignee&&['assigned','in_progress','changes_requested'].includes(task.status)))
      setReviewTasks(overview.filter(task=>task.is_reviewer&&['submitted','resubmitted'].includes(task.status)))

      setLoading(false)
    })().catch(cause=>{setHoursError(cause instanceof Error?cause.message:String(cause));setLoading(false)})
  }, [])

  const pendingOpi = opis.filter((o) => o.status === 'SUBMITTED' || o.status === 'RESUBMITTED' || o.status === 'CHANGES_REQUESTED')
  const overdueTasks = myTasks.filter(task => isOverdue(task.deadline,task.status))
  const firstName = profile?.display_name?.split(' ')[0] || 'there'

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Hey, {firstName}</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/build/check-in" className={btnGhost}>Check in</Link>
          <Link to="/opi/new" className={btnGhost}>+ OPI</Link>
        </div>
      </div>

      {panelErrors.length>0&&<div role="alert">Some dashboard panels could not be loaded: {panelErrors.join('; ')}. Empty panels below are not proof of no activity. Reload to retry.</div>}
      {/* Active check-in */}
      {activeCheckin && (
        <section className="bg-lime/10 border border-lime/30 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime" />
            </span>
            <div>
              <div className="text-sm font-semibold text-lime">Checked in</div>
              <div className="text-xs text-ink-soft">Since {fmtDateTime(activeCheckin.check_in)}</div>
            </div>
          </div>
          <Link to="/build/check-in" className={btn}>Check out</Link>
        </section>
      )}

      {/* Hours */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {hoursError?<p role="alert">{hoursError}</p>:<><Link to="/hours" search={{type:'build',season:seasonId}}><HoursTile label="Build hrs" value={summary.build_hours} target={targets.build} loading={loading}/></Link><Link to="/hours" search={{type:'outreach',season:seasonId}}><HoursTile label="Outreach hrs" value={summary.outreach_hours} target={targets.outreach} loading={loading}/></Link></>}
        <div className="bg-panel backdrop-blur-xl border border-white/8 rounded-2xl px-4 py-4">
          {loading ? <div className="skeleton h-7 w-8 mb-1" /> : <div className="font-mono text-2xl tabular-nums">{pendingOpi.length}</div>}
          <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">Open OPIs</div>
        </div>
      </div>

      {/* Alerts — only show if there's something actionable */}
      {!loading && (overdueTasks.length > 0 || reviewTasks.length > 0 || pendingOpi.some(o => o.status === 'CHANGES_REQUESTED')) && (
        <div className="border border-[#e67e22]/30 bg-[#e67e22]/5 rounded-2xl divide-y divide-[#e67e22]/10 overflow-hidden">
          {overdueTasks.length > 0 && (
            <Link to="/tasks" className="flex items-center justify-between px-5 py-3 hover:bg-[#e67e22]/10">
              <span className="text-sm">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</span>
              <span className="text-xs font-mono text-danger">{overdueTasks.length}</span>
            </Link>
          )}
          {reviewTasks.length > 0 && (
            <Link to="/tasks" className="flex items-center justify-between px-5 py-3 hover:bg-[#e67e22]/10">
              <span className="text-sm">{reviewTasks.length} task{reviewTasks.length > 1 ? 's' : ''} awaiting your review</span>
              <span className="text-xs font-mono text-[#e67e22]">{reviewTasks.length}</span>
            </Link>
          )}
          {pendingOpi.some(o => o.status === 'CHANGES_REQUESTED') && (
            <Link to="/opi" className="flex items-center justify-between px-5 py-3 hover:bg-[#e67e22]/10">
              <span className="text-sm">OPI needs changes</span>
            </Link>
          )}
        </div>
      )}

      {/* Tasks + Outreach */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>My tasks</span>
            <Link to="/tasks" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-white/4">
            {myTasks.slice(0, 5).map((t) => {
              const overdue = isOverdue(t.deadline,t.status)
              return (
                <Link key={t.id} to="/tasks/$id" params={{ id: t.id }} className="px-5 py-2.5 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors duration-150">
                  <span className={`text-sm truncate ${overdue ? 'text-danger font-medium' : ''}`}>{t.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.deadline && (
                      <span className={`text-xs font-mono ${overdue ? 'text-danger' : 'text-ink-soft'}`}>
                        {fmtDate(t.deadline)}
                      </span>
                    )}
                    <Badge label={t.status.replace('_', ' ')} tone={t.status} />
                  </div>
                </Link>
              )
            })}
            {myTasks.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No active tasks.</div>}
          </div>
        </section>

        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Upcoming outreach</span>
            <Link to="/outreach" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-white/4">
            {upcomingOutreach.slice(0, 5).map((ev) => (
              <Link key={ev.id} to="/outreach/events/$id" params={{ id: ev.id }} className="px-5 py-2.5 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors duration-150">
                <span className="text-sm truncate">{ev.title}</span>
                <span className="text-xs font-mono text-ink-soft whitespace-nowrap">{fmtDateTime(ev.starts_at)}</span>
              </Link>
            ))}
            {upcomingOutreach.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No upcoming events.</div>}
          </div>
        </section>
      </div>

      {/* Sessions + OPIs */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Upcoming sessions</span>
            <Link to="/build" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-white/4">
            {sessions.slice(0, 5).map((s) => (
              <div key={s.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-sm truncate">{s.title}</span>
                <span className="text-xs font-mono text-ink-soft whitespace-nowrap">{fmtDateTime(s.opens_at)}</span>
              </div>
            ))}
            {sessions.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">Nothing scheduled.</div>}
          </div>
        </section>

        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>My OPIs</span>
            <Link to="/opi" className="text-[11px] font-mono uppercase text-accent hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-white/4">
            {opis.slice(0, 5).map((o) => (
              <Link key={o.id} to="/opi/$id" params={{ id: o.id }} className="px-5 py-2.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors duration-150">
                <span className="text-sm truncate">{o.title}</span>
                <Badge label={o.status.replace('_', ' ')} tone={o.status} />
              </Link>
            ))}
            {opis.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No initiatives submitted.</div>}
          </div>
        </section>
      </div>

      {/* Notifications */}
      {notifs.length > 0 && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Notifications</span>
            <Link to="/notifications" className="text-[11px] font-mono uppercase text-accent hover:underline">View</Link>
          </div>
          <div className="divide-y divide-white/4">
            {notifs.map((n) => (
              <div key={n.id} className="px-5 py-2.5">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-ink-soft mt-0.5">{n.body}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function HoursTile({ label, value, target, loading }: {
  label: string; value: number; target: number; loading: boolean
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="bg-panel backdrop-blur-xl border border-white/8 rounded-2xl px-4 py-4">
      {loading ? (
        <>
          <div className="skeleton h-7 w-14 mb-1" />
          <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{label}</div>
          <div className="mt-2 skeleton h-1 w-full rounded-full" />
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl tabular-nums">{Number(value).toFixed(2)}</span>
            {target > 0 && (
              <span className="text-xs font-mono text-ink-soft">/ {target}</span>
            )}
          </div>
          <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{label}</div>
          {target > 0 && (
            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-lime' : 'bg-ink-soft/40'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
