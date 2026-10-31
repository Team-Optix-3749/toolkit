import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import {useAuth} from '~/lib/auth'
import {fmtDateTime} from '~/lib/format'
import {PrivateAttachment} from '~/components/PrivateAttachment'
import {MutationFeedback} from '~/components/MutationFeedback'
import type {Purchase} from '~/lib/types'
import {card,cardHead,cardTitle,input,textarea,label,btn} from '~/lib/ui'
export const Route=createFileRoute('/_app/purchases/$id')({component:PurchaseDetail})
function PurchaseDetail(){
 const {id}=Route.useParams(),{user}=useAuth();const [request,setRequest]=useState<Purchase|null>(null),[description,setDescription]=useState(''),[amount,setAmount]=useState(''),[kind,setKind]=useState('purchase'),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 async function load(){setLoading(true);const {data,error}=await supabase.from('purchases').select('*').eq('id',id).maybeSingle();if(error||!data)setError(error?.message??'Request unavailable');else{setRequest(data as Purchase);setDescription(data.description);setAmount(String(data.amount));setKind(data.kind)}setLoading(false)}
 useEffect(()=>{void load()},[id])
 async function save(){setBusy(true);setError('');const {error}=await supabase.rpc('purchase_action',{payload:{action:'edit_pending',id,description,kind,amount:Number(amount)}});setBusy(false);if(error){setError(error.message);return}setMessage('Pending request updated.');await load()}
 return <section className={card}><div className={cardHead}><h1 className={cardTitle}>Purchase request</h1><span>{request?.status}</span></div><div className="p-5 space-y-4"><MutationFeedback error={error} success={message}/>{loading&&<p role="status">Loading request…</p>}{request&&<><p>Submitted {fmtDateTime(request.created_at)} · {request.kind} · ${Number(request.amount).toFixed(2)}</p><p className="whitespace-pre-wrap">{request.description}</p>{request.receipt_url&&<PrivateAttachment bucket="receipts" reference={request.receipt_url} label="Receipt"/>}{request.user_id===user!.id&&request.status==='PENDING'&&<div className="border-t border-line pt-4 space-y-3"><h2>Edit pending request</h2><label className={label}>Kind<select className={input} value={kind} onChange={e=>setKind(e.target.value)}><option value="purchase">Purchase</option><option value="reimbursement">Reimbursement</option></select></label><label className={label}>Description<textarea className={textarea} value={description} onChange={e=>setDescription(e.target.value)}/></label><label className={label}>Amount<input type="number" min="0.01" step="0.01" className={input} value={amount} onChange={e=>setAmount(e.target.value)}/></label><button disabled={busy} className={btn} onClick={()=>void save()}>Save pending request</button></div>}</>}</div></section>
}
