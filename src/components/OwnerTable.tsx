import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '~/lib/supabase'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

type Row = { id: string; [k: string]: unknown }
type Props = {
  title: string
  table: string
  select: string
  orderBy?: string
  ascending?: boolean
  renderRow: (row: Row) => { primary: string; secondary?: string | null; tag?: string | null }
  renderLink: (row: Row) => ReactNode
  searchFields?: string[]
}

/** Read-only President browsing; domain screens own all consequential actions. */
export function OwnerTable({ title, table, select, orderBy = 'created_at', ascending = false, renderRow, renderLink, searchFields = [] }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.from(table).select(select).order(orderBy, { ascending })
      if (error) throw error
      // The selected columns are supplied by each domain table's typed render contract.
      setRows((data as unknown as Row[]) ?? [])
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [table, select, orderBy, ascending])
  const filtered = q ? rows.filter(row => searchFields.some(field => String(row[field] ?? '').toLowerCase().includes(q.toLowerCase()))) : rows
  return <section className={card}>
    <div className={cardHead}><span className={cardTitle}>{title} ({rows.length})</span><span className="text-xs text-ink-soft">Retained records · read-only</span></div>
    <div className="px-5 py-3"><label className="sr-only" htmlFor={`owner-search-${table}`}>Search {title}</label><input id={`owner-search-${table}`} value={q} onChange={event => setQ(event.target.value)} placeholder="Search…" className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm" /></div>
    {error && <div role="alert" className="p-5 text-sm text-red-400">{error} <button onClick={load} className={btnGhost}>Retry</button></div>}
    {loading ? <p className="p-5 text-sm text-ink-soft">Loading…</p> : !error && <div className="divide-y divide-line">{filtered.map(row => {
      const content = renderRow(row)
      return <div key={row.id} className="px-5 py-4 flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-medium">{content.primary}</div>{content.secondary && <p className="text-xs text-ink-soft mt-1">{content.secondary}</p>}</div>{content.tag && <span className="text-xs font-mono text-ink-soft">{content.tag.replaceAll('_', ' ')}</span>}{renderLink(row)}</div>
    })}{!filtered.length && <p className="p-5 text-sm text-ink-soft">{rows.length ? 'No matching records.' : 'No records.'}</p>}</div>}
  </section>
}
