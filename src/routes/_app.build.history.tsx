import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildRecord } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/history')({
  component: BuildHistory,
})

function BuildHistory() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<BuildRecord[]>([])

  async function load() {
    const { data, error } = await supabase
      .from('build_records')
      .select('*')
      .eq('member_id', user!.id)
      .order('check_in', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as BuildRecord[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  const totalH = useMemo(
    () => hoursFromMinutes(rows.reduce((s, r) => s + (r.credited_minutes || 0), 0)),
    [rows],
  )

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Build history: {totalH} h total</span>
        <button onClick={load} className={btnGhost}>
          Refresh
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Check-in', 'Method', 'Status', 'Hours'].map((h) => (
              <th
                key={h}
                className={`py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line ${
                  h === 'Hours' ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(r.check_in)}</td>
              <td className="py-2 px-5">
                <span className="font-mono text-xs uppercase text-ink-soft">{r.checkout_method}</span>
              </td>
              <td className="py-2 px-5">
                {r.check_out ? <Badge label="closed" tone="APPROVED" /> : <Badge label="open" tone="accent" />}
              </td>
              <td className="py-2 px-5 text-right font-mono tabular-nums">
                {r.credited_minutes != null ? hoursFromMinutes(r.credited_minutes) : '-'}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-ink-soft text-sm">
                No build check-ins yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
