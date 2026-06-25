import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes, minutesBetween } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildCheckin, ProfileRow, Zone } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/attendance')({
  component: AttendancePage,
})

function AttendancePage() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<BuildCheckin[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [zones, setZones] = useState<Record<string, string>>({})

  async function load() {
    const [{ data, error }, { data: p }, { data: z }] = await Promise.all([
      supabase.from('build_checkins').select('*').order('checked_in_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('build_zones').select('id, name'),
    ])
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as BuildCheckin[]) || [])
    setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-'])))
    setZones(Object.fromEntries(((z as Zone[]) || []).map((x) => [x.id, x.name])))
  }
  useEffect(() => {
    load()
  }, [])

  async function setMinutes(r: BuildCheckin, minutes: number) {
    const { error } = await supabase.from('build_checkins').update({ minutes_logged: minutes }).eq('id', r.id)
    if (error) return flash(error.message, true)
    flash('Minutes updated')
    load()
  }

  async function closeOpen(r: BuildCheckin) {
    const now = new Date().toISOString()
    const minutes = minutesBetween(r.checked_in_at, now)
    const { error } = await supabase
      .from('build_checkins')
      .update({ checked_out_at: now, minutes_logged: minutes })
      .eq('id', r.id)
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
            {['Member', 'Checked in', 'Zone', 'Status', 'Minutes', ''].map((h) => (
              <th key={h} className="py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="py-2 px-5">{names[r.user_id] || r.user_id.slice(0, 8)}</td>
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(r.checked_in_at)}</td>
              <td className="py-2 px-5">{r.zone_id ? zones[r.zone_id] ?? '-' : '-'}</td>
              <td className="py-2 px-5">
                {r.checked_out_at ? <Badge label="closed" tone="APPROVED" /> : <Badge label="open" tone="accent" />}
              </td>
              <td className="py-2 px-5">
                <input
                  type="number"
                  defaultValue={r.minutes_logged ?? ''}
                  onBlur={(e) => {
                    const v = Number(e.target.value)
                    if (!Number.isNaN(v) && v !== (r.minutes_logged ?? NaN)) setMinutes(r, v)
                  }}
                  className="w-20 h-8 px-2 border border-line text-sm"
                />
                <span className="ml-2 text-xs text-ink-soft font-mono">
                  {r.minutes_logged != null ? `${hoursFromMinutes(r.minutes_logged)}h` : ''}
                </span>
              </td>
              <td className="py-2 px-5 text-right">
                {!r.checked_out_at && (
                  <button onClick={() => closeOpen(r)} className="text-xs font-mono uppercase border border-line px-2 py-1 hover:bg-canvas">
                    Close
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-ink-soft text-sm">No check-ins.</td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
