import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState,useCallback} from 'react'
import {supabase} from '~/lib/supabase'
import {useAuth} from '~/lib/auth'
import {fmtDateTime,hoursFromMinutes} from '~/lib/format'
import type {BuildSession,BuildRecord} from '~/lib/types'
import {card,cardHead,cardTitle,input,label,btn,btnGhost} from '~/lib/ui'
import {BuildQrScanner} from '~/components/BuildQrScanner'
export const Route=createFileRoute('/_app/build/check-in')({component:CheckIn,validateSearch:(s:Record<string,unknown>):{session_id?:string;token?:string}=>({session_id:typeof s.session_id==='string'?s.session_id:undefined,token:typeof s.token==='string'?s.token:undefined})})
function CheckIn(){
 const search=Route.useSearch();const {user}=useAuth()
 const [sessions,setSessions]=useState<BuildSession[]>([]),[sessionId,setSessionId]=useState(search.session_id??''),[token,setToken]=useState(search.token??'')
 const [record,setRecord]=useState<BuildRecord|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [scanning,setScanning]=useState(false)
 const scanned=useCallback((value:string,session:string)=>{setToken(value);setSessionId(session);setScanning(false);setMessage('QR scanned. Confirm check-in to validate its current token.')},[])
 async function load(){
  const [s,r]=await Promise.all([supabase.from('build_sessions').select('*').eq('cancelled',false).lte('opens_at',new Date().toISOString()).gt('closes_at',new Date().toISOString()).order('opens_at'),supabase.from('build_records').select('*').eq('member_id',user!.id).is('check_out',null)])
  if(s.error||r.error){setError((s.error||r.error)!.message);return}
  setSessions(s.data as BuildSession[]);setSessionId(value=>value||s.data[0]?.id||'');setRecord((r.data as BuildRecord[])[0]??null)
 }
 useEffect(()=>{void load()},[user?.id])
 async function checkIn(method:'qr'|'gps'){
  setBusy(true);setError('');setMessage('')
  try{
   const payload:Record<string,unknown>={action:'check_in',session_id:sessionId,method}
   if(method==='qr')payload.token=token
   else{
    if(!navigator.geolocation) throw new Error('Geolocation unavailable; use QR')
    const {promise,resolve,reject}=Promise.withResolvers<GeolocationPosition>()
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000})
    const position=await promise
    payload.latitude=position.coords.latitude;payload.longitude=position.coords.longitude
   }
   const {data,error}=await supabase.rpc('build_action',{payload});if(error)throw error
   setRecord(data as BuildRecord);setMessage(data.already_active?'Your existing active session is shown. No duplicate record was created.':'Checked in. Official credit begins only after checkout.')
   await load()
  }catch(cause){setError(cause&&typeof cause==='object'&&'message'in cause?String(cause.message):'Check-in failed. No success is assumed.')}finally{setBusy(false)}
 }
 async function checkout(){
  setBusy(true);setError('')
  const {data,error}=await supabase.rpc('build_action',{payload:{action:'check_out',id:record!.id}})
  setBusy(false);if(error){setError(error.message);return}setMessage(`Checked out: ${hoursFromMinutes(data.credited_minutes).toFixed(2)} hours`);await load()
 }
 return <section className={card}><div className={cardHead}><h1 className={cardTitle}>Build check-in</h1></div><div className="p-5 space-y-4">
  {record?<div><p>Active session: {sessions.find(s=>s.id===record.session_id)?.title??record.session_id}</p><p>Checked in {fmtDateTime(record.check_in)}. Reserved until configured session close; zero official credit while open.</p><button disabled={busy} onClick={()=>void checkout()} className={btn}>Check out</button></div>:<p>No active build record.</p>}
  <label className={label} htmlFor="build-session">Open session</label><select id="build-session" value={sessionId} onChange={e=>setSessionId(e.target.value)} className={input}><option value="">Choose session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.title} · closes {fmtDateTime(s.closes_at)}</option>)}</select>
  <label className={label} htmlFor="build-token">Rotating QR token (manual entry)</label><input id="build-token" value={token} onChange={e=>setToken(e.target.value)} className={input}/>
  <p className="text-sm text-ink-soft">Scan the displayed QR with your device camera to open this page with its token, or paste it manually. Tokens rotate and expire within 45 seconds.</p>
  <button className={btnGhost} onClick={()=>setScanning(value=>!value)}>{scanning?'Close camera':'Scan QR with camera'}</button>{scanning&&<BuildQrScanner onToken={scanned}/>}
  <div className="flex flex-wrap gap-3"><button disabled={busy||!sessionId||!token} onClick={()=>void checkIn('qr')} className={btn}>Check in with QR</button><button disabled={busy||!sessionId} onClick={()=>void checkIn('gps')} className={btnGhost}>Check in with GPS</button><button onClick={()=>void load()} className={btnGhost}>Refresh</button></div>
  <p className="text-sm text-ink-soft">GPS is a user-provided proximity claim, not anti-spoofing proof. It works only for a configured location; QR remains available otherwise. There is no 180-minute browser cutoff.</p>
  {error&&<p role="alert" className="text-danger">{error}</p>}{message&&<p role="status">{message}</p>}
 </div></section>
}
