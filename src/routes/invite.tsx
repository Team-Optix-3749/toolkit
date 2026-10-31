import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { rememberInvitation, pendingInvitation, clearInvitation } from '~/lib/invitation'
import { btn } from '~/lib/ui'
import { AuthShell } from './login'

export const Route = createFileRoute('/invite')({ component: InvitePage, validateSearch:(search:Record<string,unknown>)=>({code:typeof search.code==='string'?search.code:''}) })
function InvitePage() {
  const search=Route.useSearch()
  const code=search.code || pendingInvitation()
  const { user,profile,refresh }=useAuth()
  const [state,setState]=useState('loading')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    rememberInvitation(code)
    let active=true
    void supabase.rpc('invitation_action',{payload:{action:'inspect',code}}).then(({data,error})=>{
      if(!active)return
      if(error){setError(error.message);setState('error')}else setState(data.state)
    })
    return ()=>{active=false}
  },[code,attempt])
  async function redeem(){
    setBusy(true);setError('')
    const {data,error}=await supabase.rpc('invitation_action',{payload:{action:'redeem',code}})
    setBusy(false)
    if(error){setError(error.message);return}
    setState(data.state)
    if(data.state==='admitted'){clearInvitation();await refresh()}
  }
  return <AuthShell title="Team invitation"><div className="space-y-4">
    {state==='loading' ? <p role="status">Checking invitation…</p> : state==='expired' ? <p>This invitation has expired. Ask for a new link.</p> : state==='invalid' ? <p>This invitation is invalid or revoked. Ask for a new link.</p> : state==='admitted' ? <><p>Membership admitted. No administrative permissions were assigned.</p><Link to="/dashboard" className={btn}>Open Toolkit</Link></> : state==='valid' ? <>
      <p>This reusable invitation admits verified ordinary membership.</p>
      {!user ? <div className="flex gap-4"><Link to="/signup" className={btn}>Create account</Link><Link to="/login">Sign in</Link></div> : profile?.role!=='PENDING' ? <><p>Your account is already admitted or unavailable for invitation admission.</p><Link to="/dashboard">Open Toolkit</Link></> : !profile?.verified ? <Link to="/resend-verification">Verify your email before joining</Link> : <button disabled={busy} onClick={()=>void redeem()} className={btn}>{busy?'Joining…':'Accept invitation'}</button>}
    </> : null}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {(error || state==='error') && <button onClick={()=>{setError('');setAttempt(value=>value+1)}}>Retry invitation</button>}
  </div></AuthShell>
}
