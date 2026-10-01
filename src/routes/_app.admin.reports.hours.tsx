import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { downloadCsv } from '~/lib/csv'
import type { Season } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/reports/hours')({
  component: ExportPage,
})

type Profile = { id: string; display_name: string | null }

function isoLocal(d: Date) {
  const off = d.getTimezoneOffset()
  const sign = off <= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const mm = String(Math.abs(off) % 60).padStart(2, '0')
  return d.toISOString().replace('Z', `${sign}${hh}:${mm}`)
}

function ExportPage() {
  const { flash, Toast } = useToast()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [tab, setTab] = useState<'outreach' | 'build'>('outreach')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from('seasons').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, display_name').neq('role', 'PENDING').order('display_name'),
      ])
      setSeasons((s as Season[]) || [])
      setMembers((m as Profile[]) || [])
    })()
  }, [])

  const nameMap = Object.fromEntries(members.map((m) => [m.id, m.display_name || m.id.slice(0, 8)]))

  async function exportOutreach() {
    setBusy(true)
    let q = supabase.from('outreach_attendance').select('*, outreach_events!inner(title, season_id, cancelled, starts_at)')
    if (seasonId) q = q.eq('outreach_events.season_id', seasonId)
    if (memberId) q = q.eq('member_id', memberId)
    const { data, error } = await q.order('arrival', { ascending: false })
    setBusy(false)
    if (error) return flash(error.message, true)
    if (!data?.length) return flash('No records to export', true)

    const season = (id: string) => seasons.find((s) => s.id === id)?.name ?? id
    const rows = data.map((r: any) => ({
      Season: season(r.outreach_events.season_id),
      Event: r.outreach_events.title,
      'Member name': nameMap[r.member_id] ?? r.member_id,
      Arrival: r.arrival ? isoLocal(new Date(r.arrival)) : '',
      Departure: r.departure ? isoLocal(new Date(r.departure)) : '',
      'Credited minutes': r.credited_minutes ?? '',
      'Attendance status': r.departure ? 'completed' : 'present',
      'Event status': r.outreach_events.cancelled ? 'cancelled' : 'active',
    }))
    downloadCsv('outreach-attendance.csv', rows)
    flash(`Exported ${rows.length} rows`)
  }

  async function exportBuild() {
    setBusy(true)
    let q = supabase.from('build_records').select('*, build_sessions!inner(title, season_id, opens_at, location_id, cancelled)')
    if (seasonId) q = q.eq('build_sessions.season_id', seasonId)
    if (memberId) q = q.eq('member_id', memberId)
    const { data, error } = await q.order('check_in', { ascending: false })
    setBusy(false)
    if (error) return flash(error.message, true)
    if (!data?.length) return flash('No records to export', true)

    const season = (id: string) => seasons.find((s) => s.id === id)?.name ?? id
    const rows = data.map((r: any) => ({
      Season: season(r.build_sessions.season_id),
      'Build session': r.build_sessions.title,
      'Member name': nameMap[r.member_id] ?? r.member_id,
      'Check-in': r.check_in ? isoLocal(new Date(r.check_in)) : '',
      'Check-out': r.check_out ? isoLocal(new Date(r.check_out)) : '',
      'Credited minutes': r.credited_minutes ?? '',
      'Checkout method': r.checkout_method ?? '',
      'Session status': r.build_sessions.cancelled ? 'cancelled' : 'active',
    }))
    downloadCsv('build-attendance.csv', rows)
    flash(`Exported ${rows.length} rows`)
  }

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Export records</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Season</label>
              <select className={input} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
                <option value="">All seasons</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Member</label>
              <select className={input} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">All members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="inline-flex border border-line text-sm">
            {(['outreach', 'build'] as const).map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-9 px-5 uppercase font-mono text-xs ${i ? 'border-l border-line' : ''} ${
                  tab === t ? 'bg-brand text-white' : 'bg-panel hover:bg-canvas'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button onClick={tab === 'outreach' ? exportOutreach : exportBuild} disabled={busy} className={btn}>
            {busy ? 'Exporting…' : `Export ${tab} CSV`}
          </button>
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Quick export: Team hours summary</span>
        </div>
        <div className="p-5">
          <button
            onClick={async () => {
              const { data, error } = await supabase.from('hours_summary').select('*').order('total_hours', { ascending: false })
              if (error) return flash(error.message, true)
              if (!data?.length) return flash('No data', true)
              downloadCsv(
                'hours-summary.csv',
                data.map((r: any) => ({
                  'Member name': r.display_name ?? r.user_id,
                  'Build hours': r.build_hours,
                  'Outreach hours': r.outreach_hours,
                  'Total hours': r.total_hours,
                })),
              )
              flash(`Exported ${data.length} rows`)
            }}
            className={btnGhost}
          >
            Download hours summary CSV
          </button>
        </div>
      </section>
      {Toast}
    </>
  )
}
