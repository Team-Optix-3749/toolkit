import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { getPosition, distanceMeters } from '~/lib/geo'
import { fmtDateTime, minutesBetween } from '~/lib/format'
import type { OutreachEvent } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/check-in')({
  component: OutreachCheckIn,
})

const RADIUS = 150 // meters for outreach GPS verification

function OutreachCheckIn() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [events, setEvents] = useState<OutreachEvent[]>([])
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [eventId, setEventId] = useState('')
  const [method, setMethod] = useState<'gps' | 'qr'>('gps')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [{ data: e }, { data: ci }] = await Promise.all([
      supabase.from('outreach_events').select('*').order('starts_at', { ascending: true }),
      supabase.from('outreach_checkins').select('event_id').eq('user_id', user!.id),
    ])
    const list = (e as OutreachEvent[]) || []
    setEvents(list)
    setMine(new Set(((ci as { event_id: string }[]) || []).map((x) => x.event_id)))
    if (!eventId && list[0]) setEventId(list[0].id)
  }
  useEffect(() => {
    load()
  }, [])

  const ev = events.find((e) => e.id === eventId)

  async function checkIn() {
    if (!ev) return flash('Pick an event', true)
    if (mine.has(ev.id)) return flash('Already checked in to this event', true)
    setBusy(true)
    let lat: number | null = null
    let lng: number | null = null

    if (method === 'gps') {
      const c = await getPosition()
      if (!c) {
        setBusy(false)
        return flash('Could not read your location', true)
      }
      lat = c.latitude
      lng = c.longitude
      if (ev.lat != null && ev.lng != null) {
        const dist = distanceMeters(lat, lng, ev.lat, ev.lng)
        if (dist > RADIUS) {
          setBusy(false)
          return flash(`Too far from the event (${Math.round(dist)}m away)`, true)
        }
      }
    } else {
      if (token.trim() !== ev.qr_token) {
        setBusy(false)
        return flash('QR token does not match this event', true)
      }
    }

    const minutes = ev.ends_at ? minutesBetween(ev.starts_at, ev.ends_at) : null
    const { error } = await supabase.from('outreach_checkins').insert({
      event_id: ev.id,
      user_id: user!.id,
      method,
      checked_in_at: new Date().toISOString(),
      minutes_logged: minutes,
      lat,
      lng,
    })
    setBusy(false)
    if (error) return flash('Check-in failed: ' + error.message, true)
    flash('Checked in')
    setToken('')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Outreach check-in</span>
      </div>
      <div className="p-5 space-y-4">
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
            <p className="text-xs text-[#1a7f4b] mt-1">You're already checked in to this event.</p>
          )}
        </div>

        <div>
          <label className={label}>Method</label>
          <div className="inline-flex border border-line text-sm">
            {(['gps', 'qr'] as const).map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`h-9 px-5 uppercase font-mono text-xs ${i ? 'border-l border-line' : ''} ${
                  method === m ? 'bg-brand text-white' : 'bg-panel hover:bg-canvas'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {method === 'qr' && (
          <div>
            <label className={label}>Event QR token</label>
            <input className={input} placeholder="Scan or paste the event's QR value" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
        )}

        <button onClick={checkIn} disabled={busy || !ev || (ev && mine.has(ev.id))} className={btn}>
          {busy ? 'Checking in…' : 'Check in'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
