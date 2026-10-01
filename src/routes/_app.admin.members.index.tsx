import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { ROLES, isOwner } from '~/lib/rbac'
import { Badge } from '~/components/Badge'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/members/')({
  component: MembersPage,
})

type Row = {
  id: string
  display_name: string | null
  grade: string | null
  role: string
  account_status: string
  permissions: string[] | null
}

function MembersPage() {
  const { role: myRole } = useAuth()
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, grade, role, account_status, permissions')
      .order('display_name', { ascending: true })
    if (error) return flash(error.message, true)
    setRows((data as Row[]) || [])
  }
  useEffect(() => { load() }, [])

  async function setRole(id: string, role: string) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) return flash(error.message, true)
    flash('Role updated')
    load()
  }

  async function deactivate(id: string) {
    const { error } = await supabase.from('profiles').update({ account_status: 'deactivated' }).eq('id', id)
    setConfirmId(null)
    if (error) return flash('Deactivate failed: ' + error.message, true)
    flash('Member deactivated')
    load()
  }

  async function reactivate(id: string) {
    const { error } = await supabase.from('profiles').update({ account_status: 'active' }).eq('id', id)
    setConfirmId(null)
    if (error) return flash('Reactivate failed: ' + error.message, true)
    flash('Member reactivated')
    load()
  }

  const assignable = isOwner(myRole) ? ROLES : ROLES.filter((r) => r !== 'OWNER' && r !== 'OFFICER')

  const active = rows.filter(r => r.account_status === 'active')
  const inactive = rows.filter(r => r.account_status !== 'active')

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Members ({active.length})</span>
        <Link to="/admin/members/pending" className="text-[11px] font-mono uppercase text-accent hover:underline">
          Pending →
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Name', 'Grade', 'Role', 'Perms', ''].map((h) => (
              <th key={h} className="py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              assignable={assignable}
              setRole={setRole}
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              onRemove={deactivate}
            />
          ))}
          {inactive.length > 0 && (
            <tr>
              <td colSpan={5} className="py-3 px-5 text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft bg-canvas border-b border-line">
                Inactive ({inactive.length})
              </td>
            </tr>
          )}
          {inactive.map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              assignable={assignable}
              setRole={setRole}
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              onRemove={reactivate}
              inactive
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-ink-soft text-sm">No members.</td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}

function MemberRow({ m, assignable, setRole, confirmId, setConfirmId, onRemove, inactive }: {
  m: Row
  assignable: readonly string[]
  setRole: (id: string, role: string) => void
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  onRemove: (id: string) => void
  inactive?: boolean
}) {
  const isConfirming = confirmId === m.id
  return (
    <tr className={`border-b border-line group ${inactive ? 'opacity-50' : ''}`}>
      <td className="py-2 px-5">
        <Link to="/admin/members/$id" params={{ id: m.id }} className="hover:underline">
          {m.display_name || '-'}
        </Link>
        {inactive && (
          <Badge label={m.account_status} tone="REJECTED" />
        )}
      </td>
      <td className="py-2 px-5 text-ink-soft">{m.grade || '-'}</td>
      <td className="py-2 px-5">
        <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 border border-line text-ink-soft">
          {m.role}
        </span>
      </td>
      <td className="py-2 px-5 text-ink-soft font-mono text-xs">
        {(m.permissions?.length ?? 0) > 0 ? m.permissions!.length : '-'}
      </td>
      <td className="py-2 px-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <select
            className="h-8 border border-line bg-panel text-xs px-2"
            value={m.role}
            onChange={(e) => setRole(m.id, e.target.value)}
          >
            {assignable.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {isConfirming ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#c0392b] whitespace-nowrap">{inactive ? 'Reactivate?' : 'Remove?'}</span>
              <button
                onClick={() => onRemove(m.id)}
                className="w-6 h-6 flex items-center justify-center text-xs border border-[#c0392b] text-[#c0392b] bg-[#fbeeec] hover:bg-[#f5d5d1]"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="w-6 h-6 flex items-center justify-center text-xs border border-line text-ink-soft hover:bg-canvas"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmId(m.id)}
              className="w-7 h-7 flex items-center justify-center text-ink-soft hover:text-[#c0392b] hover:bg-[#fbeeec] border border-transparent hover:border-[#e3a9a1] opacity-0 group-hover:opacity-100 transition-opacity"
              title={inactive ? 'Reactivate' : 'Remove'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {inactive ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l3-3m0 0l3-3m-3 3l-3-3m3 3l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                )}
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
