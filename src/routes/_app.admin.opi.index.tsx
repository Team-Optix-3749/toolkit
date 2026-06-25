import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { OpiInitiative, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/opi/')({
  component: OpiQueue,
})

const FILTERS = ['ALL', 'PENDING', 'IN_REVIEW', 'APPROVED', 'EXECUTED', 'REJECTED']

function OpiQueue() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<OpiInitiative[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('ALL')

  async function load() {
    const { data, error } = await supabase.from('opi_initiatives').select('*').order('created_at', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    const list = (data as OpiInitiative[]) || []
    setRows(list)
    const ids = [...new Set(list.map((r) => r.user_id))]
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
      setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-'])))
    }
  }
  useEffect(() => {
    load()
  }, [])

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
          <Link key={r.id} to="/admin/opi/$id/review" params={{ id: r.id }} className="px-5 py-3 flex items-center gap-3 hover:bg-canvas">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-ink-soft font-mono">
                {names[r.user_id] || 'member'} · {fmtDate(r.created_at)}
              </div>
            </div>
            <Badge label={r.status.replace('_', ' ')} tone={r.status} />
          </Link>
        ))}
        {shown.length === 0 && <div className="px-5 py-8 text-center text-ink-soft text-sm">Nothing here.</div>}
      </div>
      {Toast}
    </section>
  )
}
