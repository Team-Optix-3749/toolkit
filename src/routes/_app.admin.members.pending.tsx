import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/members/pending')({
  component: PendingMembers,
})

type Row = { id: string; display_name: string | null }

function PendingMembers() {
  const [rows, setRows] = useState<Row[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('role', 'PENDING')
      .order('display_name')
    if (error) return setMsg(error.message)
    setRows((data as Row[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function approve(id: string, role: string) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    setMsg(error ? error.message : 'Approved')
    if (!error) load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Pending approval ({rows.length})</span>
        {msg && <span className="text-[11px] text-ink-soft">{msg}</span>}
      </div>
      <div className="divide-y divide-line">
        {rows.map((m) => (
          <div key={m.id} className="px-5 py-3 flex items-center gap-3">
            <span className="flex-1">{m.display_name || m.id.slice(0, 8)}</span>
            <button onClick={() => approve(m.id, 'MEMBER')} className="h-8 px-3 text-xs font-medium bg-brand text-white hover:bg-black">
              Approve as Member
            </button>
            <button onClick={() => approve(m.id, 'LEADERSHIP')} className="h-8 px-3 text-xs border border-line bg-panel hover:bg-canvas">
              Leadership
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-5 py-6 text-center text-ink-soft text-sm">No one is waiting for approval.</div>
        )}
      </div>
    </section>
  )
}
