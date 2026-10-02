import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { Opi, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/opi/')({
  component: OpiQueue,
})

const FILTERS = ['ALL', 'SUBMITTED', 'CHANGES_REQUESTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED']

function OpiQueue() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Opi[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('ALL')

  async function load() {
    const { data, error } = await supabase.from('opis').select('*').order('created_at', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    const list = (data as Opi[]) || []
    setRows(list)
    const ids = [...new Set(list.map((r) => r.submitter_id))]
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
      setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-'])))
    }
  }
  useEffect(() => {
    load()
  }, [])

  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function deleteOpi(id: string) {
    const { error } = await supabase.from('opis').delete().eq('id', id)
    setConfirmId(null)
    if (error) return flash('Delete failed: ' + error.message, true)
    flash('OPI deleted')
    load()
  }

  const shown = useMemo(() => (filter === 'ALL' ? rows : rows.filter((r) => r.status === filter)), [rows, filter])

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>OPI review queue</span>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] font-mono uppercase px-2 py-1 border ${
                filter === f ? 'border-accent text-accent bg-accent-soft' : 'border-line text-ink-soft hover:text-ink'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-line">
        {shown.map((r) => (
          <div key={r.id} className="px-5 py-3 flex items-center gap-3 group">
            <Link to="/admin/opi/$id/review" params={{ id: r.id }} className="flex-1 min-w-0 hover:opacity-80">
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-ink-soft font-mono">
                {names[r.submitter_id] || 'member'} · {fmtDate(r.created_at ?? '')}
              </div>
            </Link>
            <Badge label={r.status.replace('_', ' ')} tone={r.status} />
            {confirmId === r.id ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#c0392b]">Delete?</span>
                <button
                  onClick={() => deleteOpi(r.id)}
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
                onClick={() => setConfirmId(r.id)}
                className="w-7 h-7 flex items-center justify-center text-ink-soft hover:text-[#c0392b] hover:bg-[#fbeeec] border border-transparent hover:border-[#e3a9a1] opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {shown.length === 0 && <div className="px-5 py-8 text-center text-ink-soft text-sm">Nothing here.</div>}
      </div>
      {Toast}
    </section>
  )
}
