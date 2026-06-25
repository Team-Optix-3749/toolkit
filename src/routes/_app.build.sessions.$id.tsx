import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { isAdmin } from '~/lib/rbac'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { BuildSession, Zone, BuildCheckin, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/sessions/$id')({
  component: SessionDetail,
})

function SessionDetail() {
  const { id } = Route.useParams()
  const { role } = useAuth()
  const { flash, Toast } = useToast()
  const [session, setSession] = useState<BuildSession | null>(null)
  const [zone, setZone] = useState<Zone | null>(null)
  const [attendees, setAttendees] = useState<(BuildCheckin & { name?: string })[]>([])
  const admin = isAdmin(role)

  useEffect(() => {
    ;(async () => {
      const { data: s, error } = await supabase.from('build_schedule').select('*').eq('id', id).maybeSingle()
      if (error) return flash(error.message, true)
      setSession(s as BuildSession)
      if (s?.zone_id) {
        const { data: z } = await supabase.from('build_zones').select('*').eq('id', s.zone_id).maybeSingle()
        setZone(z as Zone)
      }
      if (admin) {
        const { data: ci } = await supabase.from('build_checkins').select('*').eq('session_id', id)
        const list = (ci as BuildCheckin[]) || []
        const ids = [...new Set(list.map((c) => c.user_id))]
        let names: Record<string, string> = {}
        if (ids.length) {
          const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
          names = Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-']))
        }
        setAttendees(list.map((c) => ({ ...c, name: names[c.user_id] })))
      }
    })()
  }, [id, admin])

  if (!session) {
    return (
      <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>
    )
  }

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{session.title}</span>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <Row k="Starts" v={fmtDateTime(session.starts_at)} />
          <Row k="Ends" v={session.ends_at ? fmtDateTime(session.ends_at) : '-'} />
          <Row k="Zone" v={zone ? zone.name : '-'} />
          {zone?.gps_lat != null && <Row k="Location" v={`${zone.gps_lat.toFixed(4)}, ${zone.gps_lng?.toFixed(4)} (${zone.gps_radius_m}m)`} />}
          {session.is_recurring && <Row k="Recurring" v="Yes" />}
        </div>
      </section>

      {admin && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Attendees ({attendees.length})</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-soft">
                {['Member', 'Checked in', 'Method', 'Hours'].map((h) => (
                  <th key={h} className={`py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line ${h === 'Hours' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.id} className="border-b border-line">
                  <td className="py-2 px-5">{a.name || a.user_id.slice(0, 8)}</td>
                  <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(a.checked_in_at)}</td>
                  <td className="py-2 px-5 font-mono text-xs uppercase text-ink-soft">{a.method}</td>
                  <td className="py-2 px-5 text-right font-mono tabular-nums">
                    {a.minutes_logged != null ? hoursFromMinutes(a.minutes_logged) : '-'}
                  </td>
                </tr>
              ))}
              {attendees.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-ink-soft text-sm">No check-ins.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
      {Toast}
    </>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{k}</span>
      <span className="font-mono text-right">{v}</span>
    </div>
  )
}
