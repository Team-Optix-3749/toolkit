import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { accountDirectory } from '~/lib/actions'
import { ROLE_LABEL } from '~/lib/rbac'
import type { AccountDirectoryRow } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/owner/members')({ component: OwnerMembers })
function OwnerMembers() {
  const [rows, setRows] = useState<AccountDirectoryRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await accountDirectory()
      if (error) throw error
      setRows((data ?? []).sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? '')))
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const filtered = rows.filter(row => `${row.display_name ?? ''} ${ROLE_LABEL[row.role] ?? row.role} ${row.account_type} ${row.account_status}`.toLowerCase().includes(q.toLowerCase()))
  return <section className={card}>
    <div className={cardHead}><span className={cardTitle}>All accounts ({rows.length})</span><span className="text-xs text-ink-soft">Retained identities · read-only</span></div>
    <div className="p-5"><label className="sr-only" htmlFor="owner-members-search">Search accounts</label><input id="owner-members-search" value={q} onChange={event => setQ(event.target.value)} placeholder="Search accounts…" className="w-full rounded-lg bg-canvas border border-line px-3 py-2 text-sm" /></div>
    {error && <div role="alert" className="p-5 text-sm text-red-400">{error} <button onClick={load} className={btnGhost}>Retry</button></div>}
    {loading ? <p className="p-5 text-sm text-ink-soft">Loading accounts…</p> : !error && <div className="divide-y divide-line">{filtered.map(row => <div key={row.id} className="px-5 py-4 flex flex-wrap items-center gap-3"><div className="flex-1 min-w-0"><p className="text-sm font-medium">{row.display_name || 'Unnamed account'}</p><p className="text-xs text-ink-soft">{ROLE_LABEL[row.role] ?? row.role} · {row.account_type} · {row.account_status} · {row.verified ? 'Verified' : 'Not verified'}</p></div><Link to="/admin/members/$id" params={{ id: row.id }} className={btnGhost}>Account actions →</Link></div>)}{!filtered.length && <p className="p-5 text-sm text-ink-soft">No matching accounts.</p>}</div>}
  </section>
}
