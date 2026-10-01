import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/hours')({
  component: TeamHours,
})

type Row = {
  user_id: string
  display_name: string | null
  build_hours: number
  outreach_hours: number
}

type SortKey = 'name' | 'outreach' | 'build' | 'outreach_pct' | 'build_pct'

function TeamHours() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [targets, setTargets] = useState<{ outreach: number; build: number }>({ outreach: 0, build: 0 })
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [asc, setAsc] = useState(true)

  async function load() {
    const [{ data: hours, error }, { data: season }] = await Promise.all([
      supabase.from('hours_summary').select('user_id, display_name, build_hours, outreach_hours'),
      supabase.from('seasons').select('outreach_target, build_target').eq('is_current', true).maybeSingle(),
    ])
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((hours as Row[]) || [])
    if (season) setTargets({ outreach: Number(season.outreach_target) || 0, build: Number(season.build_target) || 0 })
  }

  useEffect(() => { load() }, [])

  function toggle(key: SortKey) {
    if (sortBy === key) setAsc(!asc)
    else { setSortBy(key); setAsc(key === 'name') }
  }

  const pct = (val: number, target: number) => target > 0 ? (val / target) * 100 : 0

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case 'name': cmp = (a.display_name ?? '').localeCompare(b.display_name ?? ''); break
      case 'outreach': cmp = a.outreach_hours - b.outreach_hours; break
      case 'build': cmp = a.build_hours - b.build_hours; break
      case 'outreach_pct': cmp = pct(a.outreach_hours, targets.outreach) - pct(b.outreach_hours, targets.outreach); break
      case 'build_pct': cmp = pct(a.build_hours, targets.build) - pct(b.build_hours, targets.build); break
    }
    return asc ? cmp : -cmp
  })

  const fmt = (n: number) => n.toFixed(2)
  const fmtPct = (val: number, target: number) => target > 0 ? `${pct(val, target).toFixed(1)}%` : '—'

  const arrow = (key: SortKey) => sortBy === key ? (asc ? ' ↑' : ' ↓') : ''

  const TH = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      onClick={() => toggle(k)}
      className="px-4 py-2.5 text-left text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft cursor-pointer select-none whitespace-nowrap hover:text-ink"
    >
      {children}{arrow(k)}
    </th>
  )

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Team hours</span>
        <div className="flex items-center gap-2 text-xs text-ink-soft font-mono">
          {targets.outreach > 0 && <span>Outreach target: {targets.outreach}h</span>}
          {targets.build > 0 && <span>Build target: {targets.build}h</span>}
          <button onClick={load} className={btnGhost}>Refresh</button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              <TH k="name">Member</TH>
              <TH k="outreach">Outreach hrs</TH>
              <TH k="build">Build hrs</TH>
              <TH k="outreach_pct">Outreach progress</TH>
              <TH k="build_pct">Build progress</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((r) => (
              <tr key={r.user_id} className="hover:bg-canvas">
                <td className="px-4 py-2.5 font-medium">{r.display_name ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono tabular-nums">{fmt(r.outreach_hours)}</td>
                <td className="px-4 py-2.5 font-mono tabular-nums">{fmt(r.build_hours)}</td>
                <td className="px-4 py-2.5">
                  <ProgressCell value={r.outreach_hours} target={targets.outreach} />
                </td>
                <td className="px-4 py-2.5">
                  <ProgressCell value={r.build_hours} target={targets.build} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked rows */}
      <div className="sm:hidden divide-y divide-line">
        {sorted.map((r) => (
          <div key={r.user_id} className="px-4 py-3 space-y-1.5">
            <div className="font-medium text-sm">{r.display_name ?? '—'}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="text-ink-soft">Outreach</div>
              <div className="font-mono tabular-nums text-right">{fmt(r.outreach_hours)} {fmtPct(r.outreach_hours, targets.outreach) !== '—' && <span className="text-ink-soft">({fmtPct(r.outreach_hours, targets.outreach)})</span>}</div>
              <div className="text-ink-soft">Build</div>
              <div className="font-mono tabular-nums text-right">{fmt(r.build_hours)} {fmtPct(r.build_hours, targets.build) !== '—' && <span className="text-ink-soft">({fmtPct(r.build_hours, targets.build)})</span>}</div>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="px-5 py-8 text-center text-ink-soft text-sm">No hours data yet.</div>
      )}
      {Toast}
    </section>
  )
}

function ProgressCell({ value, target }: { value: number; target: number }) {
  if (target <= 0) return <span className="text-xs text-ink-soft font-mono">—</span>
  const p = Math.min((value / target) * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-line overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${p}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums text-ink-soft w-12 text-right">
        {p.toFixed(1)}%
      </span>
    </div>
  )
}
