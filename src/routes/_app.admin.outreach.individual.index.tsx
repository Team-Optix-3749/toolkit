import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { IndividualOutreach, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/individual/')({
  component: IndividualOutreachQueue,
})

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']

function IndividualOutreachQueue() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<IndividualOutreach[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('PENDING')

  async function load() {
    const { data, error } = await supabase
      .from('individual_outreach')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    const list = (data as IndividualOutreach[]) || []
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
  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'PENDING').length, [rows])

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Individual outreach · {pendingCount} pending</span>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] font-mono uppercase px-2 py-1 border ${
                filter === f ? 'border-accent text-accent bg-accent-soft' : 'border-line text-ink-soft hover:text-ink'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Date', 'Member', 'Event', 'Hours', 'Status', ''].map((h) => (
              <th key={h} className={`py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line ${h === 'Hours' ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDate(r.event_date)}</td>
              <td className="py-2 px-5">{names[r.user_id] || r.user_id.slice(0, 8)}</td>
              <td className="py-2 px-5">{r.event_name}</td>
              <td className="py-2 px-5 text-right font-mono tabular-nums">{Number(r.hours)}</td>
              <td className="py-2 px-5"><Badge label={r.status} tone={r.status} /></td>
              <td className="py-2 px-5 text-right">
                <Link to="/admin/outreach/individual/$id/review" params={{ id: r.id }} className="text-[11px] font-mono uppercase text-accent hover:underline">
                  Review
                </Link>
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-ink-soft text-sm">Nothing here.</td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
