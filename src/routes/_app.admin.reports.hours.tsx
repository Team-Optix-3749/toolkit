import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { downloadCsv } from '~/lib/csv'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/reports/hours')({
  component: HoursReport,
})

type Row = {
  user_id: string
  display_name: string | null
  build_hours: number
  outreach_hours: number
  total_hours: number
}

function HoursReport() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])

  async function load() {
    const { data, error } = await supabase.from('hours_summary').select('*').order('total_hours', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as Row[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          build: a.build + Number(r.build_hours || 0),
          outreach: a.outreach + Number(r.outreach_hours || 0),
        }),
        { build: 0, outreach: 0 },
      ),
    [rows],
  )

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>
          Team hours · {Math.round(totals.build * 10) / 10} build / {Math.round(totals.outreach * 10) / 10} outreach
        </span>
        <button
          onClick={() =>
            downloadCsv(
              'hours-report.csv',
              rows.map((r) => ({
                member: r.display_name ?? r.user_id,
                build_hours: r.build_hours,
                outreach_hours: r.outreach_hours,
                total_hours: r.total_hours,
              })),
            )
          }
          className={btnGhost}
        >
          Export CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Member', 'Build', 'Outreach', 'Total'].map((h, i) => (
              <th key={h} className={`py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line ${i ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} className="border-b border-line">
              <td className="py-2 px-5">{r.display_name || r.user_id.slice(0, 8)}</td>
              <td className="py-2 px-5 text-right font-mono tabular-nums">{r.build_hours}</td>
              <td className="py-2 px-5 text-right font-mono tabular-nums">{r.outreach_hours}</td>
              <td className="py-2 px-5 text-right font-mono tabular-nums font-semibold">{r.total_hours}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-ink-soft text-sm">No data.</td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
