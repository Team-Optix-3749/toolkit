import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { OutreachCheckin, OutreachEvent } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/history')({
  component: OutreachHistory,
})

function OutreachHistory() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<OutreachCheckin[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})

  async function load() {
    const [{ data, error }, { data: e }] = await Promise.all([
      supabase.from('outreach_checkins').select('*').eq('user_id', user!.id).order('checked_in_at', { ascending: false }),
      supabase.from('outreach_events').select('id, title'),
    ])
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as OutreachCheckin[]) || [])
    setTitles(Object.fromEntries(((e as OutreachEvent[]) || []).map((x) => [x.id, x.title])))
  }
  useEffect(() => {
    load()
  }, [])

  const totalH = useMemo(
    () => hoursFromMinutes(rows.reduce((s, r) => s + (r.minutes_logged || 0), 0)),
    [rows],
  )

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Outreach history: {totalH} h total</span>
        <button onClick={load} className={btnGhost}>
          Refresh
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Event', 'Checked in', 'Method', 'Hours'].map((h) => (
              <th key={h} className={`py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line ${h === 'Hours' ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="py-2 px-5">{r.event_id ? titles[r.event_id] ?? '-' : '-'}</td>
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(r.checked_in_at)}</td>
              <td className="py-2 px-5 font-mono text-xs uppercase text-ink-soft">{r.method}</td>
              <td className="py-2 px-5 text-right font-mono tabular-nums">
                {r.minutes_logged != null ? hoursFromMinutes(r.minutes_logged) : '-'}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-ink-soft text-sm">No outreach check-ins yet.</td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
