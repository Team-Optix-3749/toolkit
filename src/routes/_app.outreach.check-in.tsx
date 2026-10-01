import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { OutreachEvent, OutreachAttendance } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/check-in')({
  component: OutreachCheckIn,
})

const MAX_MILES = 1

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type GeoState = 'checking' | 'ok' | 'too-far' | 'denied' | 'unavailable' | 'no-coords'

function OutreachCheckIn() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [events, setEvents] = useState<OutreachEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [myAttendance, setMyAttendance] = useState<Record<string, OutreachAttendance>>({})
  const [busy, setBusy] = useState(false)

  const [geo, setGeo] = useState<GeoState>('checking')
  const [distance, setDistance] = useState<number | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeo('unavailable')
      return
    }
    setGeo('checking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  useEffect(() => {
    getLocation()
  }, [getLocation])

  const ev = events.find((e) => e.id === eventId)

  useEffect(() => {
    if (!userCoords) return
    if (!ev) {
      setGeo('checking')
      return
    }
    if (ev.latitude == null || ev.longitude == null) {
      setGeo('no-coords')
      setDistance(null)
      return
    }
    const d = haversine(userCoords.lat, userCoords.lng, ev.latitude, ev.longitude)
    setDistance(Math.round(d * 100) / 100)
    setGeo(d <= MAX_MILES ? 'ok' : 'too-far')
  }, [userCoords, ev])

  async function load() {
    const now = new Date().toISOString()
    const [{ data: e }, { data: att }] = await Promise.all([
      supabase
        .from('outreach_events')
        .select('*')
        .eq('cancelled', false)
        .gte('ends_at', now)
        .order('starts_at'),
      supabase.from('outreach_attendance').select('*').eq('member_id', user!.id),
    ])
    const list = (e as OutreachEvent[]) || []
    setEvents(list)
    const attMap: Record<string, OutreachAttendance> = {}
    for (const a of (att as OutreachAttendance[]) || []) {
      if (a.event_id) attMap[a.event_id] = a
    }
    setMyAttendance(attMap)
    if (!eventId && list[0]) setEventId(list[0].id)
  }

  useEffect(() => {
    load()
  }, [])

  const activeRecord = ev ? myAttendance[ev.id] : null
  const isCheckedIn = activeRecord && !activeRecord.departure
  const eventExpired = ev?.ends_at && new Date(ev.ends_at) < new Date()

  async function checkIn() {
    if (!ev) return flash('Pick an event', true)
    if (geo !== 'ok') return flash('You must be at the event location to check in.', true)
    if (eventExpired) return flash('This event has ended.', true)

    setBusy(true)
    const { error } = await supabase.rpc('outreach_action', {
      payload: {
        action: 'self_checkin',
        event_id: ev.id,
      },
    })
    setBusy(false)
    if (error) return flash('Check-in failed: ' + error.message, true)
    flash('Checked in to ' + ev.title)
    load()
  }

  async function checkOut() {
    if (!ev) return
    setBusy(true)
    const { error } = await supabase.rpc('outreach_action', {
      payload: {
        action: 'self_checkout',
        event_id: ev.id,
      },
    })
    setBusy(false)
    if (error) return flash('Check-out failed: ' + error.message, true)
    const rec = myAttendance[ev.id]
    if (rec?.credited_minutes) {
      flash(`Checked out, ${hoursFromMinutes(rec.credited_minutes)} h logged`)
    } else {
      flash('Checked out')
    }
    load()
  }

  const eventTimeLeft = ev?.ends_at
    ? Math.max(0, Math.round((new Date(ev.ends_at).getTime() - Date.now()) / 60000))
    : null

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Outreach check-in</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className={label}>Event</label>
          <select className={input} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.length === 0 && <option value="">No active events</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} — {fmtDateTime(e.starts_at)}
              </option>
            ))}
          </select>
        </div>

        {ev && (
          <>
            {ev.location && (
              <div className="text-xs text-ink-soft">Location: {ev.location}</div>
            )}
            {eventTimeLeft != null && eventTimeLeft > 0 && (
              <div className="text-xs text-ink-soft">
                Event ends in {eventTimeLeft < 60 ? `${eventTimeLeft} min` : `${hoursFromMinutes(eventTimeLeft)} h`}
              </div>
            )}

            <LocationBanner geo={geo} distance={distance} onRetry={getLocation} eventName={ev.title} />

            {isCheckedIn ? (
              <div className="space-y-3">
                <div className="px-4 py-3 border border-[#9bd0b0] bg-[#eefaf2] text-sm text-[#1a7f4b]">
                  Checked in since {fmtDateTime(activeRecord!.arrival)}
                  {activeRecord!.arrival && (
                    <span className="ml-2 text-xs">
                      (~{hoursFromMinutes(Math.round((Date.now() - new Date(activeRecord!.arrival).getTime()) / 60000))} h)
                    </span>
                  )}
                </div>
                <button onClick={checkOut} disabled={busy} className={btn}>
                  {busy ? 'Checking out…' : 'Check out'}
                </button>
              </div>
            ) : activeRecord?.departure ? (
              <div className="px-4 py-3 border border-line bg-canvas text-sm text-ink-soft">
                You already attended this event ({hoursFromMinutes(activeRecord.credited_minutes ?? 0)} h logged).
              </div>
            ) : (
              <button
                onClick={checkIn}
                disabled={busy || geo !== 'ok' || !!eventExpired}
                className={btn}
              >
                {busy ? 'Checking in…' : 'Check in'}
              </button>
            )}
          </>
        )}
      </div>
      {Toast}
    </section>
  )
}

function LocationBanner({ geo, distance, onRetry, eventName }: {
  geo: GeoState; distance: number | null; onRetry: () => void; eventName: string
}) {
  if (geo === 'checking') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-line bg-canvas text-sm text-ink-soft">
        <Spinner />
        Verifying your location…
      </div>
    )
  }

  if (geo === 'ok') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-[#9bd0b0] bg-[#eefaf2] text-sm text-[#1a7f4b]">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        At event location{distance != null ? ` (${distance} mi)` : ''}
      </div>
    )
  }

  if (geo === 'no-coords') {
    return (
      <div className="px-4 py-3 border border-[#e7c08a] bg-[#fcf6ec] text-sm text-[#b4690e]">
        This event doesn't have GPS coordinates set. Ask an admin to add coordinates to enable self-check-in.
      </div>
    )
  }

  const messages: Record<string, string> = {
    'too-far': `You're ${distance ?? '?'} miles from ${eventName}. Must be within ${MAX_MILES} mile to check in.`,
    denied: 'Location access denied. Enable location in your browser to check in.',
    unavailable: 'Location services unavailable.',
  }

  return (
    <div className="px-4 py-3 border border-[#e3a9a1] bg-[#fbeeec] space-y-2">
      <div className="text-sm text-[#c0392b]">{messages[geo]}</div>
      {geo !== 'denied' && (
        <button onClick={onRetry} className={btnGhost}>Retry location</button>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-ink-soft shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
