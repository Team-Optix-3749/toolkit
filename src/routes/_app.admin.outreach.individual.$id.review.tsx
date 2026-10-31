import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import {individualCredit,individualOutreachAction} from '~/lib/actions'
import {fmtDate,fmtDateTime,hoursFromMinutes} from '~/lib/format'
import {PrivateAttachment} from '~/components/PrivateAttachment'
import {Badge} from '~/components/Badge'
import type {IndividualOutreach,IndividualCredit} from '~/lib/types'
import {card,cardHead,cardTitle,input,label,btn,btnGhost} from '~/lib/ui'
export const Route=createFileRoute('/_app/admin/outreach/individual/$id/review')({component:Review})
function Review(){
 const {id}=Route.useParams()
 const [request,setRequest]=useState<IndividualOutreach|null>(null)
 const [summary,setSummary]=useState<IndividualCredit|null>(null)
 const [credit,setCredit]=useState('')
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 async function load(){
  setLoading(true);setError('')
  const {data,error}=await supabase.from('individual_outreach').select('*').eq('id',id).maybeSingle()
  if(error||!data){setError(error?.message??'Request not found');setLoading(false);return}
  const row=data as IndividualOutreach;setRequest(row);setCredit(String(Number(row.approved_minutes??row.claimed_minutes)/60))
  const totals=await individualCredit({season_id:row.season_id,member_id:row.user_id})
  if(totals.error)setError(totals.error.message);else setSummary(totals.data)
  setLoading(false)
 }
 useEffect(()=>{void load()},[id])
 async function decide(action:'approve'|'reject'){
  const minutes=Number(credit)*60
  if(action==='approve'&&(!Number.isFinite(minutes)||minutes<0||minutes>Number(request!.claimed_minutes))){setError('Approved hours must be between zero and claimed hours.');return}
  setBusy(true);setError('')
  const {error}=await individualOutreachAction(action==='approve'?{action,id,approved_minutes:minutes}:{action,id})
  setBusy(false);if(error){setError(error.message);return}await load()
 }
 return <div className="space-y-5">{error&&<div role="alert"><p>{error}</p><button onClick={()=>void load()}>Retry request</button></div>}{loading&&<p role="status">Loading request…</p>}{request&&<>
  <section className={card}><div className={cardHead}><span className={cardTitle}>{request.event_name}</span><Badge label={request.status} tone={request.status}/></div><div className="p-5 space-y-3 text-sm"><p>{request.full_name} · {fmtDate(request.event_date)} · submitted {fmtDateTime(request.created_at)}</p><p className="whitespace-pre-wrap">{request.what_you_did}</p><p className="whitespace-pre-wrap">{request.impact}</p><p>People impacted: {request.people_impacted??'Not recorded'}</p><p>Claimed hours: {hoursFromMinutes(request.claimed_minutes).toFixed(2)}</p><p>Approved uncapped hours: {request.approved_minutes===null?'Not approved':hoursFromMinutes(request.approved_minutes).toFixed(2)}</p>
  {summary&&<dl className="grid sm:grid-cols-2 gap-2"><dt>Season raw approved individual hours</dt><dd>{hoursFromMinutes(summary.raw_approved_minutes).toFixed(2)}</dd><dt>Season cap</dt><dd>{hoursFromMinutes(summary.cap_minutes).toFixed(2)}</dd><dt>Counted individual hours</dt><dd>{hoursFromMinutes(summary.counted_individual_minutes).toFixed(2)}</dd><dt>Official outreach total including uncapped events</dt><dd>{hoursFromMinutes(summary.official_outreach_minutes).toFixed(2)}</dd></dl>}
  {request.status==='PENDING'&&<div className="space-y-3"><p>Approve the uncapped amount earned. The seasonal cap is applied dynamically to totals, not to this request.</p><label htmlFor="approved-hours" className={label}>Approved hours</label><input id="approved-hours" type="number" min="0" step="any" max={Number(request.claimed_minutes)/60} value={credit} onChange={event=>setCredit(event.target.value)} className={input}/><div className="flex gap-3"><button disabled={busy} className={btn} onClick={()=>void decide('approve')}>Approve</button><button disabled={busy} className={btnGhost} onClick={()=>void decide('reject')}>Reject</button></div></div>}
  </div></section><section className={card}><div className={cardHead}><span className={cardTitle}>Visual proof</span></div><div className="p-5 space-y-4">{request.proof_urls.map((reference,index)=><PrivateAttachment key={reference} bucket="outreach-proofs" reference={reference} label={`Proof ${index+1}`}/>)}{!request.proof_urls.length&&<p>No historical proof attached.</p>}</div></section>
 </>}</div>
}
