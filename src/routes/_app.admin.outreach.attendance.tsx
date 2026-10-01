import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { OutreachAttendance, OutreachEvent, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/attendance')({
  component: OutreachAttendancePage,
})

function OutreachAttendancePage() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<OutreachAttendance[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [titles, setTitles] = useState<Record<string, string>>({})

  async function load() {
    const [{ data, error }, { data: p }, { data: e }] = await Promise.all([
      supabase.from('outreach_attendance').select('*').order('arrival', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('outreach_events').select('id, title'),
    ])
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as OutreachAttendance[]) || [])
    setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-'])))
    setTitles(Object.fromEntries(((e as OutreachEvent[]) || []).map((x) => [x.id, x.title])))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Outreach attendance</span>
        <button onClick={load} className={btnGhost}>
          Refresh
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Member', 'Event', 'Arrival', 'Departure', 'Minutes'].map((h) => (
              <th key={h} className="py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="py-2 px-5">{names[r.member_id] || r.member_id.slice(0, 8)}</td>
              <td className="py-2 px-5">{r.event_id ? titles[r.event_id] ?? '-' : '-'}</td>
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(r.arrival)}</td>
              <td className="py-2 px-5 font-mono text-ink-soft">{r.departure ? fmtDateTime(r.departure) : '-'}</td>
              <td className="py-2 px-5">
                <span className="text-xs font-mono text-ink-soft">
                  {r.credited_minutes != null ? `${r.credited_minutes} min (${hoursFromMinutes(r.credited_minutes)}h)` : '-'}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-ink-soft text-sm">
                No attendance records.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
