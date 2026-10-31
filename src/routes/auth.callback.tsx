import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '~/lib/auth'
import { isApproved } from '~/lib/rbac'
import { pendingInvitation, rememberInvitation } from '~/lib/invitation'
import { AuthShell } from './login'
export const Route = createFileRoute('/auth/callback')({component:CallbackPage})
function CallbackPage(){
  const {loading,user,role,profile,profileError,refresh}=useAuth()
  const navigate=useNavigate()
  const [providerError]=useState(()=>{
    const query=new URLSearchParams(window.location.search)
    const hash=new URLSearchParams(window.location.hash.slice(1))
    return query.get('error_description') || hash.get('error_description') || query.get('error') || hash.get('error') || ''
  })
  useEffect(()=>{
    const code=pendingInvitation();rememberInvitation(code)
    if(loading || providerError || profileError)return
    if(!user)return
    if(!profile)return
    if(profile.account_status!=='active'){void navigate({to:'/account-blocked'});return}
    if(!profile.verified){void navigate({to:'/resend-verification'});return}
    if(code && !isApproved(role)){void navigate({to:'/invite',search:{code}});return}
    void navigate({to:isApproved(role)?'/dashboard':'/pending-approval'})
  },[loading,user,role,profile,providerError,profileError,navigate])
  return <AuthShell title="Complete sign-in"><div className="space-y-4">
    {providerError || profileError ? <><p role="alert">{providerError || profileError}</p><p>Your account has not been admitted by this failed sign-in.</p><button onClick={()=>void refresh()}>Retry account loading</button><Link to="/login">Retry sign-in</Link></> : !loading && !user ? <><p role="alert">Sign-in did not establish a session. Try again; your invitation is retained.</p><Link to="/login">Retry sign-in</Link></> : <p role="status">Completing sign-in…</p>}
  </div></AuthShell>
}
