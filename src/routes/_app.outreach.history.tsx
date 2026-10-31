import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import {useAuth} from '~/lib/auth'
import {individualCredit} from '~/lib/actions'
import {fmtDateTime,hoursFromMinutes} from '~/lib/format'
import {eventState} from '~/lib/outreach'
import type {Season,OutreachEvent,OutreachAttendance,IndividualCredit} from '~/lib/types'
import {card,cardHead,cardTitle,input,label} from '~/lib/ui'
export const Route=createFileRoute('/_app/outreach/history')({component:OutreachHistory})
function OutreachHistory(){
  const {user}=useAuth()
  const [seasons,setSeasons]=useState<Season[]>([])
  const [seasonId,setSeasonId]=useState('')
  const [rows,setRows]=useState<OutreachAttendance[]>([])
  const [events,setEvents]=useState<Record<string,OutreachEvent>>({})
  const [credit,setCredit]=useState<IndividualCredit|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let active=true
    void supabase.from('seasons').select('*').order('created_at',{ascending:false}).then(({data,error})=>{
      if(!active)return
      if(error){setError(error.message);setLoading(false);return}
      const list=data as Season[];setSeasons(list);setSeasonId(list.find(row=>row.is_current)?.id??'');if(!list.length)setLoading(false)
    });return()=>{active=false}
  },[attempt])
  useEffect(()=>{
    if(!seasonId)return
    let active=true;setLoading(true);setError('')
    void Promise.all([supabase.from('outreach_events').select('*').eq('season_id',seasonId),individualCredit({season_id:seasonId})]).then(async([parents,summary])=>{
      if(!active)return
      if(parents.error||summary.error){setError((parents.error||summary.error)!.message);setLoading(false);return}
      const eventRows=parents.data as OutreachEvent[];setEvents(Object.fromEntries(eventRows.map(row=>[row.id,row])));setCredit(summary.data)
      if(!eventRows.length){setRows([]);setLoading(false);return}
      const attendance=await supabase.from('outreach_attendance').select('*').eq('member_id',user!.id).in('event_id',eventRows.map(row=>row.id)).order('arrival',{ascending:false})
      if(!active)return
      if(attendance.error)setError(attendance.error.message);else setRows(attendance.data as OutreachAttendance[])
      setLoading(false)
    });return()=>{active=false}
  },[seasonId,user?.id,attempt])
  return <section className={card}><div className={cardHead}><span className={cardTitle}>My outreach history</span></div><div className="p-5 space-y-4">
    <label className={label} htmlFor="history-season">Season</label><select id="history-season" className={input} value={seasonId} onChange={event=>setSeasonId(event.target.value)}>{seasons.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
    {!seasons.length&&!loading&&<p>Season setup is required.</p>}{error&&<div role="alert">{error}<button onClick={()=>setAttempt(value=>value+1)}>Retry history</button></div>}{loading&&<p role="status">Loading history…</p>}
    {credit&&<dl className="grid sm:grid-cols-2 gap-2 text-sm"><dt>Event minutes (uncapped)</dt><dd>{credit.event_minutes}</dd><dt>Raw approved individual hours</dt><dd>{hoursFromMinutes(credit.raw_approved_minutes).toFixed(2)}</dd><dt>Individual cap hours</dt><dd>{hoursFromMinutes(credit.cap_minutes).toFixed(2)}</dd><dt>Counted individual hours</dt><dd>{hoursFromMinutes(credit.counted_individual_minutes).toFixed(2)}</dd><dt>Official outreach hours</dt><dd>{hoursFromMinutes(credit.official_outreach_minutes).toFixed(2)}</dd></dl>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Event</th><th className="text-left p-2">Arrival</th><th className="text-left p-2">Departure</th><th className="text-right p-2">Credit hours</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-line"><td className="p-2">{events[row.event_id]?.title}<p className="text-xs text-ink-soft">{events[row.event_id]&&eventState(events[row.event_id])}</p></td><td className="p-2">{fmtDateTime(row.arrival)}</td><td className="p-2">{row.departure?fmtDateTime(row.departure):'Present — no credit until departure'}</td><td className="p-2 text-right">{hoursFromMinutes(row.credited_minutes).toFixed(2)}</td></tr>)}</tbody></table>{!loading&&!rows.length&&<p>No event attendance in this season.</p>}</div>
  </div></section>
}
