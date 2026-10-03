import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle } from '~/lib/ui'

type Row = { id: string; [k: string]: unknown }

type Props = {
  title: string
  table: string
  select: string
  orderBy?: string
  ascending?: boolean
  renderRow: (row: Row) => { primary: string; secondary?: string | null; tag?: string | null }
  searchFields?: string[]
}

/**
 * Owner-only table with hard-delete per row via the `owner_delete_row` RPC.
 */
export function OwnerTable({
  title,
  table,
  select,
  orderBy = 'created_at',
  ascending = false,
  renderRow,
  searchFields = [],
}: Props) {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from(table).select(select).order(orderBy, { ascending })
    setLoading(false)
    if (error) return flash(error.message, true)
    setRows((data as Row[]) || [])
  }
  useEffect(() => { load() }, [table])

  async function hardDelete(id: string) {
    setBusy(true)
    const { error } = await supabase.rpc('owner_delete_row', { table_name: table, row_id: id })
    setBusy(false)
    setConfirmId(null)
    if (error) return flash('Delete failed: ' + error.message, true)
    flash('Row deleted')
    load()
  }

  const filtered = q
    ? rows.filter((r) =>
        searchFields.some((f) =>
          String(r[f] ?? '').toLowerCase().includes(q.toLowerCase()),
        ),
      )
    : rows

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>{title} ({filtered.length})</span>
        {searchFields.length > 0 && (
          <input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 px-3 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-accent focus:ring-1 focus:ring-accent w-48"
          />
        )}
      </div>
      <div className="divide-y divide-white/4">
        {loading && (
          <div className="px-5 py-6 text-center text-ink-soft text-sm">Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-5 py-6 text-center text-ink-soft text-sm">No rows.</div>
        )}
        {filtered.map((row) => {
          const r = renderRow(row)
          const confirming = confirmId === row.id
          return (
            <div key={row.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    {r.primary}
                    {r.tag && (
                      <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 border border-white/10 rounded text-ink-soft">
                        {r.tag}
                      </span>
                    )}
                  </div>
                  {r.secondary && (
                    <div className="text-xs text-ink-soft mt-0.5 truncate">{r.secondary}</div>
                  )}
                  <div className="text-[10px] font-mono text-ink-soft/70 mt-0.5">{row.id.slice(0, 8)}</div>
                </div>
                {confirming ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#f07070] font-medium whitespace-nowrap">Delete forever?</span>
                    <button
                      onClick={() => hardDelete(row.id)}
                      disabled={busy}
                      className="h-8 px-3 text-xs font-mono uppercase tracking-wide border border-[#c0392b]/40 text-[#f07070] bg-[#c0392b]/15 rounded-lg hover:bg-[#c0392b]/25 disabled:opacity-40 inline-flex items-center transition-all"
                    >
                      {busy ? '…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="h-8 px-3 text-xs border border-white/10 rounded-lg text-ink-soft hover:bg-white/10 inline-flex items-center transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(row.id)}
                    className="shrink-0 h-8 px-3 text-xs font-mono uppercase tracking-wide border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10 rounded-lg hover:bg-[#c0392b]/20 inline-flex items-center transition-all"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {Toast}
    </section>
  )
}
