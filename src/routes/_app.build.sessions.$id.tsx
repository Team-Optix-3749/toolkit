import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { isAdmin } from '~/lib/rbac'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { BuildSession, BuildLocation, BuildRecord, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/sessions/$id')({
  component: SessionDetail,
})

function SessionDetail() {
  const { id } = Route.useParams()
  const { role, profile } = useAuth()
  const { flash, Toast } = useToast()
  const [session, setSession] = useState<BuildSession | null>(null)
  const [location, setLocation] = useState<BuildLocation | null>(null)
  const [attendees, setAttendees] = useState<(BuildRecord & { name?: string })[]>([])
  const admin = isAdmin(role)

  useEffect(() => {
    ;(async () => {
      const { data: s, error } = await supabase.from('build_sessions').select('*').eq('id', id).maybeSingle()
      if (error) return flash(error.message, true)
      setSession(s as BuildSession)
      if (s?.location_id) {
        const { data: loc } = await supabase.from('build_locations').select('*').eq('id', s.location_id).maybeSingle()
        setLocation(loc as BuildLocation)
      }
      if (admin || profile?.permissions?.includes('manage_build_hours')) {
        const { data: ci } = await supabase.from('build_records').select('*').eq('session_id', id)
        const list = (ci as BuildRecord[]) || []
        const ids = [...new Set(list.map((c) => c.member_id))]
        let names: Record<string, string> = {}
        if (ids.length) {
          const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
          names = Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-']))
        }
        setAttendees(list.map((c) => ({ ...c, name: names[c.member_id] })))
      }
    })()
  }, [id, admin])

  if (!session) {
    return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>
  }

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{session.title}</span>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <Row k="Opens" v={fmtDateTime(session.opens_at)} />
          <Row k="Closes" v={session.closes_at ? fmtDateTime(session.closes_at) : '-'} />
          <Row k="Location" v={location ? location.name : '-'} />
          {session.cancelled && <Row k="Status" v="Cancelled" />}
        </div>
      </section>

      {(admin || profile?.permissions?.includes('manage_build_hours')) && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Attendees ({attendees.length})</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-soft">
                {['Member', 'Check-in', 'Method', 'Hours'].map((h) => (
                  <th
                    key={h}
                    className={`py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line ${h === 'Hours' ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.id} className="border-b border-line">
                  <td className="py-2 px-5">{a.name || a.member_id.slice(0, 8)}</td>
                  <td className="py-2 px-5 font-mono text-ink-soft">{fmtDateTime(a.check_in)}</td>
                  <td className="py-2 px-5 font-mono text-xs uppercase text-ink-soft">{a.checkout_method}</td>
                  <td className="py-2 px-5 text-right font-mono tabular-nums">
                    {a.credited_minutes != null ? hoursFromMinutes(a.credited_minutes) : '-'}
                  </td>
                </tr>
              ))}
              {attendees.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-ink-soft text-sm">
                    No check-ins.
                  </td>
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
