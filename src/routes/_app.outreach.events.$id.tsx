import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { isAdmin } from '~/lib/rbac'
import { fmtDateTime } from '~/lib/format'
import type { OutreachEvent, OutreachCheckin, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/events/$id')({
  component: EventDetail,
})

function EventDetail() {
  const { id } = Route.useParams()
  const { user, role } = useAuth()
  const { flash, Toast } = useToast()
  const [ev, setEv] = useState<OutreachEvent | null>(null)
  const [count, setCount] = useState(0)
  const [mineIn, setMineIn] = useState(false)
  const [attendees, setAttendees] = useState<{ id: string; name: string; when: string }[]>([])
  const admin = isAdmin(role)

  useEffect(() => {
    ;(async () => {
      const { data: e, error } = await supabase.from('outreach_events').select('*').eq('id', id).maybeSingle()
      if (error) return flash(error.message, true)
      setEv(e as OutreachEvent)
      const { data: ci } = await supabase.from('outreach_checkins').select('*').eq('event_id', id)
      const list = (ci as OutreachCheckin[]) || []
      setCount(list.length)
      setMineIn(list.some((c) => c.user_id === user!.id))
      if (admin && list.length) {
        const ids = [...new Set(list.map((c) => c.user_id))]
        const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
        const names = Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '-']))
        setAttendees(list.map((c) => ({ id: c.id, name: names[c.user_id] || c.user_id.slice(0, 8), when: c.checked_in_at })))
      }
    })()
  }, [id, admin])

  if (!ev) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{ev.title}</span>
          <span className="text-[11px] font-mono text-ink-soft">{count} checked in</span>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <Row k="Starts" v={fmtDateTime(ev.starts_at)} />
          <Row k="Ends" v={ev.ends_at ? fmtDateTime(ev.ends_at) : '-'} />
          <Row k="Location" v={ev.location || '-'} />
          {ev.description && <p className="text-ink-soft pt-2">{ev.description}</p>}
          <div className="pt-3">
            {mineIn ? (
              <span className="text-sm text-[#1a7f4b]">✓ You're checked in.</span>
            ) : (
              <Link to="/outreach/check-in" className={btn}>
                Check in
              </Link>
            )}
          </div>
        </div>
      </section>

      {admin && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Attendees ({attendees.length})</span>
          </div>
          <div className="divide-y divide-line">
            {attendees.map((a) => (
              <div key={a.id} className="px-5 py-2.5 flex justify-between text-sm">
                <span>{a.name}</span>
                <span className="font-mono text-ink-soft">{fmtDateTime(a.when)}</span>
              </div>
            ))}
            {attendees.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No check-ins.</div>}
          </div>
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
