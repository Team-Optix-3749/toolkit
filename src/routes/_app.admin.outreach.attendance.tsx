import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { OutreachCheckin, OutreachEvent, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/attendance')({
  component: OutreachAttendance,
})

function OutreachAttendance() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<OutreachCheckin[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [titles, setTitles] = useState<Record<string, string>>({})

  async function load() {
    const [{ data, error }, { data: p }, { data: e }] = await Promise.all([
      supabase.from('outreach_checkins').select('*').order('checked_in_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('outreach_events').select('id, title'),
    ])
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as OutreachCheckin[]) || [])
    setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '—'])))
    setTitles(Object.fromEntries(((e as OutreachEvent[]) || []).map((x) => [x.id, x.title])))
  }
  useEffect(() => {
    load()
  }, [])

  async function setMinutes(r: OutreachCheckin, minutes: number) {
    const { error } = await supabase.from('outreach_checkins').update({ minutes_logged: minutes }).eq('id', r.id)
    if (error) return flash(error.message, true)
    flash('Minutes updated')
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this check-in?')) return
    const { error } = await supabase.from('outreach_checkins').delete().eq('id', id)
    if (error) return flash(error.message, true)
    flash('Removed')
    load()
  }

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
            {['Member', 'Event', 'Checked in', 'Minutes', ''].map((h) => (
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
              <td className="py-2 px-5">{r.event_id ? titles[r.event_id] ?? '—' : '—'}</td>
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(r.checked_in_at)}</td>
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
                <button onClick={() => remove(r.id)} className="text-ink-soft hover:text-[#c0392b] px-1" title="Remove">
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-ink-soft text-sm">No check-ins.</td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
