import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { ROLES, isOwner } from '~/lib/rbac'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/members/')({
  component: MembersPage,
})

type Row = {
  id: string
  display_name: string | null
  grade: string | null
  role: string
}

function MembersPage() {
  const { role: myRole } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, grade, role')
      .order('display_name', { ascending: true })
    if (error) return setMsg(error.message)
    setRows((data as Row[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function setRole(id: string, role: string) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    setMsg(error ? error.message : 'Role updated')
    if (!error) load()
  }

  // Only OWNER can mint OWNER/OFFICER; leadership can assign up to LEADERSHIP.
  const assignable = isOwner(myRole) ? ROLES : ROLES.filter((r) => r !== 'OWNER' && r !== 'OFFICER')

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Members ({rows.length})</span>
        <div className="flex items-center gap-3">
          {msg && <span className="text-[11px] text-ink-soft">{msg}</span>}
          <Link to="/admin/members/pending" className="text-[11px] font-mono uppercase text-accent hover:underline">
            Pending →
          </Link>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Name', 'Grade', 'Role', ''].map((h) => (
              <th key={h} className="py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-line">
              <td className="py-2 px-5">
                <Link to="/admin/members/$id" params={{ id: m.id }} className="hover:underline">
                  {m.display_name || '—'}
                </Link>
              </td>
              <td className="py-2 px-5 text-ink-soft">{m.grade || '—'}</td>
              <td className="py-2 px-5">
                <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 border border-line text-ink-soft">
                  {m.role}
                </span>
              </td>
              <td className="py-2 px-5 text-right">
                <select
                  className="h-8 border border-line bg-panel text-xs px-2"
                  value={m.role}
                  onChange={(e) => setRole(m.id, e.target.value)}
                >
                  {assignable.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-ink-soft text-sm">
                No members.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
