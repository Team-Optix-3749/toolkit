import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import {card,cardHead,cardTitle,btnGhost} from '~/lib/ui'
export const Route=createFileRoute('/_app/admin/cron-jobs')({component:Scheduler})
function Scheduler(){
 const [state,setState]=useState('loading'),[error,setError]=useState('')
 async function load(){const {data,error}=await supabase.rpc('build_scheduler_status');if(error){setError(error.message);setState('unknown')}else{setError('');setState(data.state)}}
 useEffect(()=>{void load()},[])
 return <section className={card}><div className={cardHead}><h1 className={cardTitle}>Build automatic checkout</h1><button className={btnGhost} onClick={()=>void load()}>Refresh</button></div><div className="p-5 space-y-3"><p>auto-checkout · once per minute · {state}</p><p>Due records close at the configured session close, not scheduler execution time. No member browser is required. Admission and checkout also settle overdue records.</p>{state==='unavailable'&&<p>Supabase Cron is unavailable in this database.</p>}{state==='missing'&&<p>The required auto-checkout job is missing.</p>}{state==='inactive'&&<p>The auto-checkout job is inactive.</p>}{error&&<p role="alert">{error}</p>}</div></section>
}
