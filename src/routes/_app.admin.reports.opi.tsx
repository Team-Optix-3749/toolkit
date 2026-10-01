import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { downloadCsv } from '~/lib/csv'
import type { OpiInitiative } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/reports/opi')({
  component: OpiReport,
})

const STAGES = ['SUBMITTED', 'CHANGES_REQUESTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED']

function OpiReport() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<OpiInitiative[]>([])

  async function load() {
    const { data, error } = await supabase.from('opi_initiatives').select('*')
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as OpiInitiative[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = Object.fromEntries(STAGES.map((s) => [s, 0]))
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1
    return c
  }, [rows])

  const converted = rows.filter((r) => r.status === 'CONVERTED').length
  const decided = rows.filter((r) => r.status === 'CONVERTED' || r.status === 'APPROVED' || r.status === 'REJECTED').length
  const approvalRate = decided ? Math.round(((converted + rows.filter((r) => r.status === 'APPROVED').length) / decided) * 100) : 0

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>OPI analytics · {rows.length} total · {approvalRate}% approved</span>
        <button
          onClick={() => downloadCsv('opi-report.csv', STAGES.map((s) => ({ status: s, count: counts[s] })))}
          className={btnGhost}
        >
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-line border-b border-line">
        {STAGES.map((s) => (
          <div key={s} className="bg-panel px-4 py-4">
            <div className="font-mono text-2xl tabular-nums">{counts[s]}</div>
            <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{s.replace('_', ' ')}</div>
          </div>
        ))}
      </div>
      {Toast}
    </section>
  )
}
