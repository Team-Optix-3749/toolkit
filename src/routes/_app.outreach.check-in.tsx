import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import type { OutreachEvent } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/check-in')({
  component: OutreachCheckIn,
})

function OutreachCheckIn() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [events, setEvents] = useState<OutreachEvent[]>([])
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [eventId, setEventId] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [{ data: e }, { data: att }] = await Promise.all([
      supabase.from('outreach_events').select('*').eq('cancelled', false).order('starts_at', { ascending: true }),
      supabase.from('outreach_attendance').select('event_id').eq('member_id', user!.id),
    ])
    const list = (e as OutreachEvent[]) || []
    setEvents(list)
    setMine(new Set(((att as { event_id: string }[]) || []).map((x) => x.event_id)))
    if (!eventId && list[0]) setEventId(list[0].id)
  }
  useEffect(() => {
    load()
  }, [])

  const ev = events.find((e) => e.id === eventId)

  async function rsvp() {
    if (!ev) return flash('Pick an event', true)
    setBusy(true)
    const { error } = await supabase.rpc('outreach_action', {
      payload: { action: 'rsvp', event_id: ev.id, planned: true },
    })
    setBusy(false)
    if (error) return flash('RSVP failed: ' + error.message, true)
    flash('RSVP recorded')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Outreach RSVP</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-ink-soft">
          Outreach attendance is managed by event leads and admins. Use this page to RSVP for upcoming events.
        </p>
        <div>
          <label className={label}>Event</label>
          <select className={input} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.length === 0 && <option value="">No events</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}, {fmtDateTime(e.starts_at)}
              </option>
            ))}
          </select>
          {ev && mine.has(ev.id) && (
            <p className="text-xs text-[#1a7f4b] mt-1">You have attendance recorded for this event.</p>
          )}
        </div>

        <button onClick={rsvp} disabled={busy || !ev} className={btn}>
          {busy ? 'Saving…' : 'RSVP to attend'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
