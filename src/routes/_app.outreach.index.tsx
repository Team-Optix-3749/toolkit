import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { individualCredit } from '~/lib/actions'
import { fmtDate, fmtDateTime, hoursFromMinutes } from '~/lib/format'
import { eventState } from '~/lib/outreach'
import { Badge } from '~/components/Badge'
import { can } from '~/lib/rbac'
import type { OutreachEvent, IndividualOutreach, IndividualCredit, Season } from '~/lib/types'
import { card, cardHead, cardTitle, btn, input, label } from '~/lib/ui'
export const Route = createFileRoute('/_app/outreach/')({component:OutreachHome})
function OutreachHome(){
  const {user,profile}=useAuth()
  const [events,setEvents]=useState<OutreachEvent[]>([])
  const [submissions,setSubmissions]=useState<IndividualOutreach[]>([])
  const [seasons,setSeasons]=useState<Season[]>([])
  const [seasonId,setSeasonId]=useState('')
  const [credit,setCredit]=useState<IndividualCredit|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let active=true
    void supabase.from('seasons').select('*').order('created_at',{ascending:false}).then(({data,error})=>{
      if(!active)return
      if(error){setError(error.message);setLoading(false);return}
      const list=data as Season[];setSeasons(list);setSeasonId(list.find(s=>s.is_current)?.id ?? '')
      if(!list.length)setLoading(false)
    })
    return ()=>{active=false}
  },[attempt])
  useEffect(()=>{
    if(!seasonId)return
    let active=true;setLoading(true);setError('')
    void Promise.all([
      supabase.from('outreach_events').select('*').eq('season_id',seasonId).order('starts_at'),
      supabase.from('individual_outreach').select('*').eq('season_id',seasonId).eq('user_id',user!.id).order('created_at',{ascending:false}),
      individualCredit({season_id:seasonId}),
    ]).then(([events,submissions,summary])=>{
      if(!active)return
      const failure=events.error || submissions.error || summary.error
      if(failure)setError(failure.message)
      else {setEvents(events.data as OutreachEvent[]);setSubmissions(submissions.data as IndividualOutreach[]);setCredit(summary.data)}
      setLoading(false)
    })
    return ()=>{active=false}
  },[seasonId,user?.id,attempt])
  return <div className="space-y-5">
    <div><label className={label} htmlFor="outreach-season">Season</label><select id="outreach-season" value={seasonId} onChange={event=>setSeasonId(event.target.value)} className={input}>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_current?' (current)':''}</option>)}</select></div>
    {!seasons.length && !loading && <p>Season setup is required before outreach can be recorded.</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={()=>setAttempt(value=>value+1)}>Retry outreach</button></div>}
    {loading && <p role="status">Loading outreach…</p>}
    <section className={card}><div className={cardHead}><span className={cardTitle}>Outreach events</span><Link to="/outreach/history">My attendance history</Link></div><div className="divide-y divide-line">{events.map(event=><div key={event.id} className="p-5 flex justify-between gap-3"><div><Link to="/outreach/events/$id" params={{id:event.id}} className="font-medium">{event.title}</Link><p className="text-sm text-ink-soft">{fmtDateTime(event.starts_at)} · {event.location}</p></div><Badge label={eventState(event)} /></div>)}{!loading&&!events.length&&<p className="p-5">No events in this season.</p>}</div></section>
    <section className={card}><div className={cardHead}><span className={cardTitle}>Individual outreach credit</span><div className="flex flex-wrap gap-4">{can(profile,'manage_outreach_attendance')&&<Link to="/admin/outreach/individual">Review queue</Link>}<Link to="/outreach/log" className={btn}>Submit hours</Link></div></div><div className="p-5 space-y-3">
      {credit&&<dl className="grid sm:grid-cols-2 gap-2 text-sm"><dt>Raw approved individual hours</dt><dd>{hoursFromMinutes(credit.raw_approved_minutes).toFixed(2)}</dd><dt>Individual cap</dt><dd>{hoursFromMinutes(credit.cap_minutes).toFixed(2)}</dd><dt>Counted individual hours</dt><dd>{hoursFromMinutes(credit.counted_individual_minutes).toFixed(2)}</dd><dt>Event outreach hours (uncapped)</dt><dd>{hoursFromMinutes(credit.event_minutes).toFixed(2)}</dd><dt>Official outreach total</dt><dd>{hoursFromMinutes(credit.official_outreach_minutes).toFixed(2)}</dd></dl>}
      {submissions.map(row=><div key={row.id} className="flex flex-wrap justify-between gap-3 border-t border-line py-3"><div>{row.event_name}<p className="text-sm text-ink-soft">{fmtDate(row.event_date)} · claimed {hoursFromMinutes(row.claimed_minutes).toFixed(2)} h · approved {hoursFromMinutes(row.approved_minutes).toFixed(2)} h</p></div><Badge label={row.status} tone={row.status}/></div>)}
      {!loading&&!submissions.length&&<p>No individual submissions in this season.</p>}
    </div></section>
  </div>
}
