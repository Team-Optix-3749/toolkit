import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { accountAction, accountDirectory } from '~/lib/actions'
import { useAuth } from '~/lib/auth'
import { can, isAdmin, isOwner, ROLE_LABEL } from '~/lib/rbac'
import { PERMISSIONS, PERMISSION_LABELS, type Permission, type AccountDirectoryRow, type AccountAction } from '~/lib/types'
import { Badge } from '~/components/Badge'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

import {ConfirmDialog} from '~/components/ConfirmDialog'
import {MutationFeedback} from '~/components/MutationFeedback'
export const Route = createFileRoute('/_app/admin/members/$id')({ component: MemberDetail })
type Account = AccountDirectoryRow
type Action = 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'set_permissions' | 'make_administrator' | 'remove_administrator' | 'transfer_presidency'
type Summary = { build_minutes: number; outreach_minutes: number }
const ACTION_LABEL: Record<Action, string> = {
  approve: 'Approve as Member', reject: 'Reject prospective account', deactivate: 'Deactivate account', reactivate: 'Reactivate account',
  set_permissions: 'Save permissions', make_administrator: 'Make administrator', remove_administrator: 'Remove administrator', transfer_presidency: 'Transfer Presidency',
}

function MemberDetail() {
  const { id } = Route.useParams()
  const { profile, role: myRole, refresh } = useAuth()
  const allowed = can(profile, 'manage_accounts') || isAdmin(myRole)
  const [p, setP] = useState<Account | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [administratorRole, setAdministratorRole] = useState<'LEADERSHIP' | 'OFFICER'>('LEADERSHIP')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmAction, setConfirmAction] = useState<Action | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    setSummaryError('')
    setSummary(null)
    try {
      const { data, error } = await accountDirectory()
      if (error) throw error
      const row = (data ?? []).find(account => account.id === id) ?? null
      setP(row)
      setPermissions(PERMISSIONS.filter(permission => row?.permissions.includes(permission)))
      if (row && can(profile, 'manage_accounts')) {
        const result = await supabase.rpc('season_hours',{payload:{include_inactive:true}})
        if (result.error) setSummaryError(result.error.message)
        else setSummary(result.data.members.find((member:{id:string})=>member.id===id)??null)
      }
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setLoading(false) }
  }
  useEffect(() => { setP(null); if (allowed) void load(); else setLoading(false) }, [id, allowed])

  async function act(action: Action) {
    if (busy || !p) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const payload: AccountAction = action === 'set_permissions' ? { action, id, permissions }
        : action === 'make_administrator' ? { action, id, role: administratorRole } : { action, id }
      const { error } = await accountAction(payload)
      if (error) throw error
      setConfirmAction(null)
      if (action === 'transfer_presidency' || (action === 'deactivate' && profile?.id === id)) {
        window.location.assign(`${import.meta.env.BASE_URL}dashboard`)
        return
      }
      if (action === 'reject') { setP(null); setMessage('Prospective identity rejected and deleted.'); return }
      if (profile?.id === id) await refresh()
      setMessage(`${ACTION_LABEL[action]} succeeded.${action === 'reactivate' ? ' A fresh sign-in is required; old sessions remain invalid.' : ''}`)
      await load()
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setBusy(false) }
  }

  if (!allowed) return <p role="alert">Account administration access is required.</p>
  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading account…</p>
  if (!p) return <section className={card}><div className="p-5 space-y-3"><p role={error ? 'alert' : 'status'}>{error || message || 'Account not found or unavailable.'}</p><button onClick={load} className={btnGhost}>Retry</button> <Link to="/admin/members" className={btnGhost}>Accounts</Link></div></section>

  const ordinary = p.role === 'PENDING' || p.role === 'MEMBER'
  const active = p.account_status === 'active'
  const admitted = p.role !== 'PENDING'
  const canManageOrdinary = can(profile, 'manage_accounts') && ordinary
  const canEditPermissions = isAdmin(myRole) && active && p.role !== 'OWNER'
  const canPromote = isOwner(myRole) && active && p.verified && p.account_type === 'member' && p.role === 'MEMBER'
  const canRemoveAdministrator = isOwner(myRole) && active && (p.role === 'LEADERSHIP' || p.role === 'OFFICER')
  const canTransfer = isOwner(myRole) && active && p.verified && admitted && p.account_type === 'member' && p.role !== 'OWNER'
  const statusActions: Action[] = canManageOrdinary ? p.role === 'PENDING'
    ? active ? [...(p.verified ? ['approve' as const] : []), 'reject'] : []
    : active ? ['deactivate'] : p.account_status === 'deactivated' ? ['reactivate'] : [] : []

  return <div className="space-y-5">
    <MutationFeedback error={error} success={message}/>
    <section className={card}>
      <div className={cardHead}><span className={cardTitle}>{p.display_name || 'Unnamed account'}</span><Badge label={ROLE_LABEL[p.role] ?? p.role} tone={p.role} /></div>
      <div className="p-5 space-y-2 text-sm">
        <p>Account type: <strong className="capitalize">{p.account_type}</strong> · {p.verified ? 'Verified email' : 'Email not verified'} · {p.account_status}</p>
        {p.email && <p>Email: {p.email}</p>}
        {p.grade && <p>Grade: {p.grade}</p>}{p.department && <p>Department: {p.department}</p>}
        {p.displayed_role && <p>Displayed role: {p.displayed_role} (cosmetic only)</p>}
        {summary && <div className="grid grid-cols-2 gap-3 py-3">{([['Build', summary.build_minutes], ['Outreach', summary.outreach_minutes]] as const).map(([name, value]) => <div key={name}><strong className="font-mono text-xl">{(Number(value)/60).toFixed(2)}</strong><p className="text-xs text-ink-soft">Current-season {name} hrs</p></div>)}</div>}
        {summaryError && <p role="alert">Hours could not be loaded: {summaryError}</p>}
      </div>
    </section>
    {error && <p role="alert" className="text-sm text-red-400">{error} <button disabled={busy} onClick={load} className={btnGhost}>Retry load</button></p>}
    {message && <p role="status" className="text-sm text-accent">{message}</p>}
    <section className={card}>
      <div className={cardHead}><span className={cardTitle}>Independent permissions</span></div>
      <div className="p-5 space-y-3">
        {p.role === 'OWNER' ? <p className="text-sm text-ink-soft">The President alone has all permissions implicitly.</p> : <>
          <p className="text-sm text-ink-soft">Titles and cosmetic displayed roles do not grant domain access. Only student administrators may assign these permissions to active non-President accounts. Approval always starts ordinary membership with no grants.</p>
          <fieldset disabled={busy || !canEditPermissions} className="grid sm:grid-cols-2 gap-1"><legend className="sr-only">Configurable permissions</legend>{PERMISSIONS.map(permission => <label key={permission} className="flex items-center gap-2 text-sm px-2 py-2"><input type="checkbox" checked={permissions.includes(permission)} onChange={() => setPermissions(previous => previous.includes(permission) ? previous.filter(value => value !== permission) : [...previous, permission])} className="accent-accent" />{PERMISSION_LABELS[permission]}</label>)}</fieldset>
          {canEditPermissions && <button disabled={busy} onClick={() => act('set_permissions')} className={btn}>{busy ? 'Saving…' : 'Save permissions'}</button>}
        </>}
      </div>
    </section>
    <section className={card}>
      <div className={cardHead}><span className={cardTitle}>Account actions</span></div>
      <div className="p-5 space-y-4">
        {p.role === 'PENDING' && !p.verified && <p className="text-sm text-ink-soft">Email verification is required before approval.</p>}
        {p.account_type === 'mentor' && <p className="text-sm text-ink-soft">Mentor accounts cannot become student administrators or President.</p>}
        {!ordinary && <p className="text-sm text-ink-soft">Account managers cannot deactivate or reactivate administrators. The President must remove administrator status first.</p>}
        {canPromote && <div><label className={label} htmlFor="administrator-role">Student administrator role</label><select id="administrator-role" disabled={busy} value={administratorRole} onChange={event => setAdministratorRole(event.target.value === 'OFFICER' ? 'OFFICER' : 'LEADERSHIP')} className={input}><option value="LEADERSHIP">Leadership</option><option value="OFFICER">Officer</option></select></div>}
        <div className="flex flex-wrap gap-2">{[...statusActions, ...(canPromote ? ['make_administrator' as const] : []), ...(canRemoveAdministrator ? ['remove_administrator' as const] : []), ...(canTransfer ? ['transfer_presidency' as const] : [])].map(action => <button key={action} disabled={busy} onClick={() => setConfirmAction(action)} className={btnGhost}>{ACTION_LABEL[action]}</button>)}</div>
        <ConfirmDialog open={!!confirmAction} title={confirmAction?`${ACTION_LABEL[confirmAction]}?`:'Confirm account action'} description={confirmAction==='deactivate'?'Access is revoked immediately; retained history remains.':confirmAction==='transfer_presidency'?'This member becomes sole President; your independently assigned permissions are retained as Officer.':'This changes account admission or authority. Independent domain grants remain separate.'} busy={busy} onCancel={()=>setConfirmAction(null)} onConfirm={()=>{if(confirmAction)void act(confirmAction)}}/>
      </div>
    </section>
  </div>
}
