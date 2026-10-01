import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildRecord, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/attendance')({
  component: AttendancePage,
})

function AttendancePage() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<BuildRecord[]>([])
  const [names, setNames] = useState<Record<string, string>>({})

  async function load() {
    const [{ data, error }, { data: p }] = await Promise.all([
      supabase.from('build_records').select('*').order('check_in', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, display_name'),
    ])
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as BuildRecord[]) || [])
    setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-'])))
  }
  useEffect(() => {
    load()
  }, [])

  async function correctMinutes(r: BuildRecord, minutes: number) {
    const { error } = await supabase.rpc('build_action', {
      payload: { action: 'correct', id: r.id, check_in: r.check_in, check_out: r.check_out },
    })
    if (error) return flash(error.message, true)
    flash('Record updated')
    load()
  }

  async function closeOpen(r: BuildRecord) {
    const { error } = await supabase.rpc('build_action', {
      payload: { action: 'check_out', id: r.id },
    })
    if (error) return flash(error.message, true)
    flash('Closed')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Build attendance</span>
        <button onClick={load} className={btnGhost}>
          Refresh
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Member', 'Check-in', 'Status', 'Minutes', ''].map((h) => (
              <th
                key={h}
                className="py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="py-2 px-5">{names[r.member_id] || r.member_id.slice(0, 8)}</td>
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(r.check_in)}</td>
              <td className="py-2 px-5">
                {r.check_out ? (
                  <Badge label="closed" tone="APPROVED" />
                ) : (
                  <div className="flex items-center gap-1">
                    <Badge label="open" tone="accent" />
                    {new Date(r.check_in).getTime() < Date.now() - 12 * 60 * 60 * 1000 && (
                      <Badge label="stale" tone="REJECTED" />
                    )}
                  </div>
                )}
              </td>
              <td className="py-2 px-5">
                <span className="text-xs font-mono text-ink-soft">
                  {r.credited_minutes != null ? `${r.credited_minutes} min (${hoursFromMinutes(r.credited_minutes)}h)` : '-'}
                </span>
              </td>
              <td className="py-2 px-5 text-right">
                {!r.check_out && (
                  <button
                    onClick={() => closeOpen(r)}
                    className="text-xs font-mono uppercase border border-line px-2 py-1 hover:bg-canvas"
                  >
                    Close
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-ink-soft text-sm">
                No check-ins.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
