import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { accountDirectory } from '~/lib/actions'
import { useAuth } from '~/lib/auth'
import { can, isAdmin, ROLE_LABEL } from '~/lib/rbac'
import type { AccountDirectoryRow } from '~/lib/types'
import { Badge } from '~/components/Badge'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/members/')({ component: MembersPage })
type Row = AccountDirectoryRow

function MembersPage() {
  const { profile, role } = useAuth()
  const allowed = can(profile, 'manage_accounts') || isAdmin(role)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await accountDirectory()
      if (error) throw error
      setRows((data ?? []).sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? '')))
    } catch (error) {
      setError(error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (allowed) void load(); else setLoading(false) }, [allowed])
  if (!allowed) return <p role="alert">Account administration access is required.</p>

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Accounts ({rows.length})</span>
        {can(profile, 'manage_accounts') && <Link to="/admin/members/pending" className="text-xs text-accent hover:underline">Pending approval →</Link>}
      </div>
      {error && <div role="alert" className="p-5 text-sm text-red-400">{error} <button onClick={load} className={btnGhost}>Retry</button></div>}
      {loading ? <p className="p-5 text-sm text-ink-soft">Loading accounts…</p> : !error && (
        <div role="region" aria-label="Account directory" tabIndex={0} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{['Name', 'Grade', 'Account type', 'Role', 'Verified', 'Status', 'Permissions', 'Actions'].map(h => <th key={h} className="py-3 px-4 text-left text-xs font-mono text-ink-soft">{h}</th>)}</tr></thead>
            <tbody>{rows.map(m => <tr key={m.id} className="border-t border-line">
              <td className="p-4">{m.display_name || 'Unnamed account'}</td>
              <td className="p-4">{m.grade || '—'}</td>
              <td className="p-4 capitalize">{m.account_type}</td>
              <td className="p-4"><Badge label={ROLE_LABEL[m.role] ?? m.role} tone={m.role} /></td>
              <td className="p-4">{m.verified ? 'Verified' : 'Not verified'}</td>
              <td className="p-4">{m.account_status}</td>
              <td className="p-4">{m.role === 'OWNER' ? 'All (President)' : m.permissions.length}</td>
              <td className="p-4"><Link to="/admin/members/$id" params={{ id: m.id }} className={btnGhost}>View / manage</Link></td>
            </tr>)}</tbody>
          </table>
          {!rows.length && <p className="p-5 text-sm text-ink-soft">No accounts available.</p>}
        </div>
      )}
    </section>
  )
}
