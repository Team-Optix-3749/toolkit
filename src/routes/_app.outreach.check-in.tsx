import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useRef } from 'react'
import { QrScanner, parseCheckinCode } from '~/components/QrScanner'
import { Select } from '~/components/Select'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { OutreachEvent, OutreachAttendance } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/check-in')({
  validateSearch: (s: Record<string, unknown>): { event?: string; code?: string } => ({
    event: typeof s.event === 'string' ? s.event : undefined,
    code: typeof s.code === 'string' ? s.code : undefined,
  }),
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
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const deepLinkTried = useRef(false)
  const [events, setEvents] = useState<OutreachEvent[]>([])
  const [eventId, setEventId] = useState(search.event ?? '')
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState('')
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
    load().then(() => {
      // Opened from a scanned QR deep link: check straight in.
      if (deepLinkTried.current || !search.event || !search.code) return
      deepLinkTried.current = true
      navigate({ search: {}, replace: true })
      checkIn(search.code, search.event)
    })
  }, [])

  const activeRecord = ev ? myAttendance[ev.id] : null
  const isCheckedIn = activeRecord && !activeRecord.departure
  const eventExpired = ev?.ends_at && new Date(ev.ends_at) < new Date()

  async function checkIn(token?: string, targetId = eventId) {
    if (!targetId) return flash('Pick an event', true)
    if (!token && geo !== 'ok') return flash('Be at the event location or scan the event QR to check in.', true)

    setBusy(true)
    const { error } = await supabase.rpc('outreach_action', {
      payload: {
        action: 'self_checkin',
        event_id: targetId,
        ...(token ? { token } : {}),
      },
    })
    setBusy(false)
    if (error) return flash('Check-in failed: ' + error.message, true)
    setEventId(targetId)
    setScanning(false)
    setCode('')
    flash('Checked in')
    load()
  }

  function onScanned(raw: string) {
    const parsed = parseCheckinCode(raw)
    checkIn(parsed.code, parsed.ref ?? eventId)
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
          <Select
            value={eventId}
            onChange={setEventId}
            placeholder={events.length === 0 ? 'No active events' : 'Select an event'}
            options={events.map((e) => ({ value: e.id, label: `${e.title} — ${fmtDateTime(e.starts_at)}` }))}
          />
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
                <div className="px-4 py-3 rounded-lg border border-[#1a7f4b]/30 bg-[#1a7f4b]/10 text-sm text-[#5fd38d]">
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
              <div className="px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-ink-soft">
                You already attended this event ({hoursFromMinutes(activeRecord.credited_minutes ?? 0)} h logged).
              </div>
            ) : (
              <div className="space-y-4">
                {geo === 'ok' && (
                  <button onClick={() => checkIn()} disabled={busy || !!eventExpired} className={btn}>
                    {busy ? 'Checking in…' : 'Check in with location'}
                  </button>
                )}
                <div className="space-y-3">
                  <button onClick={() => setScanning(!scanning)} disabled={!!eventExpired} className={geo === 'ok' ? btnGhost : btn}>
                    {scanning ? 'Close camera' : 'Scan event QR'}
                  </button>
                  {scanning && <QrScanner onScanned={onScanned} onClose={() => setScanning(false)} />}
                  <div>
                    <label className={label}>Or enter the code shown by your event lead</label>
                    <div className="flex gap-2">
                      <input className={input} placeholder="Event code" value={code} onChange={(e) => setCode(e.target.value)} />
                      <button
                        onClick={() => checkIn(parseCheckinCode(code).code)}
                        disabled={busy || !code.trim() || !!eventExpired}
                        className={`${btnGhost} h-9 shrink-0`}
                      >
                        Go
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-ink-soft">
        <Spinner />
        Verifying your location…
      </div>
    )
  }

  if (geo === 'ok') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#1a7f4b]/30 bg-[#1a7f4b]/10 text-sm text-[#5fd38d]">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        At event location{distance != null ? ` (${distance} mi)` : ''}
      </div>
    )
  }

  if (geo === 'no-coords') {
    return (
      <div className="px-4 py-3 rounded-lg border border-[#e7c08a]/30 bg-[#e7c08a]/10 text-sm text-[#e7c08a]">
        This event has no GPS coordinates, so location check-in is off. Scan the event QR instead.
      </div>
    )
  }

  const messages: Record<string, string> = {
    'too-far': `You're ${distance ?? '?'} miles from ${eventName}. Must be within ${MAX_MILES} mile to check in.`,
    denied: 'Location access denied. Enable location in your browser to check in.',
    unavailable: 'Location services unavailable.',
  }

  return (
    <div className="px-4 py-3 rounded-lg border border-[#c0392b]/30 bg-[#c0392b]/10 space-y-2">
      <div className="text-sm text-[#f07070]">{messages[geo]}</div>
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
