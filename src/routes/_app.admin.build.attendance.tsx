import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import {fmtDateTime,hoursFromMinutes} from '~/lib/format'
import {teamInput,teamDateTime} from '~/lib/time'
import {TeamDateTimeInput,type TimeDisambiguation} from '~/components/TeamDateTimeInput'
import type {BuildRecord,BuildSession} from '~/lib/types'
import {card,cardHead,cardTitle,label,input,btn,btnGhost} from '~/lib/ui'
export const Route=createFileRoute('/_app/admin/build/attendance')({component:Attendance})
function Attendance(){
 const [rows,setRows]=useState<BuildRecord[]>([]),[sessions,setSessions]=useState<BuildSession[]>([]),[people,setPeople]=useState<{id:string;display_name:string}[]>([])
 const [id,setId]=useState(''),[sessionId,setSessionId]=useState(''),[memberId,setMemberId]=useState(''),[arrival,setArrival]=useState(teamInput()),[departure,setDeparture]=useState(teamInput())
 const [arrivalChoice,setArrivalChoice]=useState<TimeDisambiguation>('reject'),[departureChoice,setDepartureChoice]=useState<TimeDisambiguation>('reject')
 const [override,setOverride]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function load(){
  const [r,s,p]=await Promise.all([supabase.from('build_records').select('*').order('check_in',{ascending:false}),supabase.from('build_sessions').select('*').order('opens_at',{ascending:false}),supabase.from('historical_profiles').select('id,display_name').order('display_name')])
  if(r.error||s.error||p.error){setError((r.error||s.error||p.error)!.message);return}setRows(r.data as BuildRecord[]);setSessions(s.data as BuildSession[]);setPeople(p.data as {id:string;display_name:string}[])
 }
 useEffect(()=>{void load()},[])
 async function save(){
  setBusy(true);setError('');setMessage('')
  try{const payload={action:id?'correct':'add_record',...(id?{id}:{session_id:sessionId,member_id:memberId}),check_in:teamDateTime(arrival,arrivalChoice),check_out:teamDateTime(departure,departureChoice),credit_override:override};const {error}=await supabase.rpc('build_action',{payload});if(error)throw error;setId('');setMessage('Actual timestamps saved. Credit recalculated by the server.');await load()}catch(cause){setError(cause&&typeof cause==='object'&&'message'in cause?String(cause.message):String(cause))}finally{setBusy(false)}
 }
 return <section className={card}><div className={cardHead}><h1 className={cardTitle}>Build attendance</h1><button onClick={()=>void load()} className={btnGhost}>Refresh</button></div><div className="p-5 space-y-4"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Member</th><th>Check-in</th><th>Checkout</th><th>Hours</th><th>Method</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-line"><td>{people.find(p=>p.id===row.member_id)?.display_name??row.member_id}</td><td>{fmtDateTime(row.check_in)}</td><td>{row.check_out?fmtDateTime(row.check_out):'Open — reserved, zero credit'}</td><td>{hoursFromMinutes(row.credited_minutes).toFixed(2)}</td><td>{row.checkout_method}{row.automatically_closed?' · automatically closed':''}</td><td><button className={btnGhost} onClick={()=>{setId(row.id);setSessionId(row.session_id??'');setMemberId(row.member_id);setArrival(teamInput(row.check_in));setDeparture(teamInput(row.check_out??undefined));setOverride(row.credit_override===true)}}>Correct timestamps</button></td></tr>)}</tbody></table></div>
 <h2>{id?'Correct record':'Add missing attendance'}</h2><label className={label}>Session<select disabled={!!id} className={input} value={sessionId} onChange={e=>setSessionId(e.target.value)}><option value="">Choose session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label className={label}>Member<select disabled={!!id} className={input} value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">Choose member</option>{people.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
 <TeamDateTimeInput label="Actual check-in" value={arrival} onChange={setArrival} disambiguation={arrivalChoice} onDisambiguationChange={setArrivalChoice}/><TeamDateTimeInput label="Actual checkout" value={departure} onChange={setDeparture} disambiguation={departureChoice} onDisambiguationChange={setDepartureChoice}/><label className="flex gap-2"><input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/>Explicitly restore credit for a cancelled-session record (overlap rules still apply)</label><button className={btn} disabled={busy||!sessionId||!memberId} onClick={()=>void save()}>Save actual timestamps</button>{id&&<button className={btnGhost} onClick={()=>setId('')}>Add another record</button>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</div></section>
}
