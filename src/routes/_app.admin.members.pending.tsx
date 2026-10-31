import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { accountAction, accountDirectory } from '~/lib/actions'
import { useAuth } from '~/lib/auth'
import { can } from '~/lib/rbac'
import type { AccountDirectoryRow } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/members/pending')({ component: PendingMembers })
type Row = AccountDirectoryRow

function PendingMembers() {
  const { profile } = useAuth()
  const allowed = can(profile, 'manage_accounts')
  const [rows, setRows] = useState<Row[]>([])
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await accountDirectory()
      if (error) throw error
      setRows((data ?? []).filter(row => row.role === 'PENDING' && row.account_status === 'active'))
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (allowed) void load(); else setLoading(false) }, [allowed])

  async function act(action: 'approve' | 'reject', id: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error } = await accountAction({ action, id })
      if (error) throw error
      setRejectId(null)
      setMessage(action === 'approve' ? 'Account admitted as Member with no assigned permissions.' : 'Prospective identity rejected and deleted.')
      await load()
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setBusy(false) }
  }
  if (!allowed) return <p role="alert">Manage accounts permission is required.</p>
  return <section className={card}>
    <div className={cardHead}><span className={cardTitle}>Pending approval ({rows.length})</span></div>
    {error && <div role="alert" className="p-5 text-sm text-red-400">{error} <button disabled={busy} onClick={load} className={btnGhost}>Retry load</button></div>}
    {message && <p role="status" className="px-5 py-3 text-sm text-accent">{message}</p>}
    <p className="px-5 py-3 text-sm text-ink-soft">Approval requires verified email. Every new admission is a Member with no configurable permissions, including mentors.</p>
    {loading ? <p className="p-5 text-sm text-ink-soft">Loading prospective accounts…</p> : <div className="divide-y divide-line">
      {rows.map(m => <div key={m.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
        <div className="flex-1"><Link to="/admin/members/$id" params={{ id: m.id }} className="text-sm hover:text-accent">{m.display_name || 'Unnamed account'}</Link><p className="text-xs text-ink-soft">{m.account_type} · {m.verified ? 'Verified' : 'Email not verified'}{m.email ? ` · ${m.email}` : ''}</p></div>
        {rejectId === m.id ? <div className="space-y-2"><p className="text-sm">Reject and delete this prospective identity? This cannot be undone.</p><button disabled={busy} onClick={() => act('reject', m.id)} className={btn}>Confirm rejection</button> <button disabled={busy} onClick={() => setRejectId(null)} className={btnGhost}>Cancel</button></div> : <>
          <button disabled={busy || !m.verified} onClick={() => act('approve', m.id)} className={btn}>Approve as Member</button>
          <button disabled={busy} onClick={() => setRejectId(m.id)} className={btnGhost}>Reject</button>
        </>}
      </div>)}
      {!rows.length && !error && <p className="p-5 text-sm text-ink-soft">No pending accounts.</p>}
    </div>}
  </section>
}
