import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/members/pending')({
  component: PendingMembers,
})

type Row = { id: string; display_name: string | null }

function PendingMembers() {
  const [rows, setRows] = useState<Row[]>([])
  const [rejectId, setRejectId] = useState<string | null>(null)
  const { flash, Toast } = useToast()

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('role', 'PENDING')
      .eq('account_status', 'active')
      .order('display_name')
    if (error) return flash(error.message, true)
    setRows((data as Row[]) || [])
  }
  useEffect(() => { load() }, [])

  async function approve(id: string, role: string) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) return flash(error.message, true)
    flash('Approved')
    load()
  }

  async function reject(id: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ account_status: 'rejected' })
      .eq('id', id)
    setRejectId(null)
    if (error) return flash(error.message, true)
    flash('Rejected')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Pending approval ({rows.length})</span>
      </div>
      <div className="divide-y divide-line">
        {rows.map((m) => (
          <div key={m.id} className="px-5 py-3 flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-0">{m.display_name || m.id.slice(0, 8)}</span>
            {rejectId === m.id ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-soft">Reject this member?</span>
                <button
                  onClick={() => reject(m.id)}
                  className="h-8 px-3 text-xs font-medium border border-[#c0392b] text-[#c0392b] bg-[#fbeeec] hover:bg-[#f5d5d1]"
                >
                  Yes, reject
                </button>
                <button onClick={() => setRejectId(null)} className={btnGhost}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => approve(m.id, 'MEMBER')} className={btn}>
                  Approve as Member
                </button>
                <button onClick={() => approve(m.id, 'LEADERSHIP')} className={btnGhost}>
                  Leadership
                </button>
                <button
                  onClick={() => setRejectId(m.id)}
                  className="h-8 px-3 text-xs border border-line text-ink-soft hover:text-[#c0392b] hover:border-[#c0392b]"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-5 py-6 text-center text-ink-soft text-sm">No one is waiting for approval.</div>
        )}
      </div>
      {Toast}
    </section>
  )
}
