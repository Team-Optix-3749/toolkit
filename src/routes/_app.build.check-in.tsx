import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { getPosition, distanceMeters } from '~/lib/geo'
import { fmtDateTime, minutesBetween, hoursFromMinutes } from '~/lib/format'
import type { BuildSession, Zone, BuildCheckin } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/check-in')({
  component: CheckInFlow,
})

function CheckInFlow() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [zones, setZones] = useState<Record<string, Zone>>({})
  const [open, setOpen] = useState<BuildCheckin | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [method, setMethod] = useState<'gps' | 'qr'>('gps')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [{ data: s }, { data: z }, { data: ci }] = await Promise.all([
      supabase.from('build_schedule').select('*').order('starts_at', { ascending: true }),
      supabase.from('build_zones').select('*'),
      supabase
        .from('build_checkins')
        .select('*')
        .eq('user_id', user!.id)
        .is('checked_out_at', null)
        .order('checked_in_at', { ascending: false })
        .limit(1),
    ])
    setSessions((s as BuildSession[]) || [])
    setZones(Object.fromEntries(((z as Zone[]) || []).map((x) => [x.id, x])))
    setOpen(((ci as BuildCheckin[]) || [])[0] ?? null)
    if (!sessionId && s && s[0]) setSessionId((s as BuildSession[])[0].id)
  }
  useEffect(() => {
    load()
  }, [])

  const session = sessions.find((s) => s.id === sessionId)
  const zone = session?.zone_id ? zones[session.zone_id] : undefined

  async function checkIn() {
    if (!session) return flash('Pick a session', true)
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
      if (zone?.gps_lat != null && zone.gps_lng != null) {
        const dist = distanceMeters(lat, lng, zone.gps_lat, zone.gps_lng)
        if (dist > (zone.gps_radius_m ?? 100)) {
          setBusy(false)
          return flash(`Too far from ${zone.name} (${Math.round(dist)}m away)`, true)
        }
      }
    } else {
      if (!zone) {
        setBusy(false)
        return flash('This session has no zone to scan', true)
      }
      if (token.trim() !== zone.qr_token) {
        setBusy(false)
        return flash('QR token does not match this zone', true)
      }
    }

    const { error } = await supabase.from('build_checkins').insert({
      session_id: session.id,
      zone_id: session.zone_id,
      user_id: user!.id,
      method,
      checked_in_at: new Date().toISOString(),
      lat,
      lng,
    })
    setBusy(false)
    if (error) return flash('Check-in failed: ' + error.message, true)
    flash('Checked in')
    setToken('')
    load()
  }

  async function checkOut() {
    if (!open) return
    const now = new Date().toISOString()
    const minutes = minutesBetween(open.checked_in_at, now)
    const { error } = await supabase
      .from('build_checkins')
      .update({ checked_out_at: now, minutes_logged: minutes })
      .eq('id', open.id)
    if (error) return flash('Check-out failed: ' + error.message, true)
    flash(`Checked out — ${hoursFromMinutes(minutes)} h logged`)
    load()
  }

  if (open) {
    return (
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Active check-in</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm">
            Checked in since <strong>{fmtDateTime(open.checked_in_at)}</strong> via{' '}
            <span className="font-mono uppercase">{open.method}</span>.
          </p>
          <p className="text-sm text-ink-soft">
            Running time: ~{hoursFromMinutes(minutesBetween(open.checked_in_at, new Date().toISOString()))} h
          </p>
          <button onClick={checkOut} className={btn}>
            Check out now
          </button>
        </div>
        {Toast}
      </section>
    )
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Build check-in</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className={label}>Session</label>
          <select className={input} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.length === 0 && <option value="">No sessions</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {fmtDateTime(s.starts_at)}
              </option>
            ))}
          </select>
          {zone && (
            <p className="text-xs text-ink-soft mt-1 font-mono">
              Zone: {zone.name}
              {zone.gps_lat != null ? ` · GPS verified within ${zone.gps_radius_m}m` : ' · no GPS set'}
            </p>
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
            <label className={label}>Zone QR token</label>
            <input
              className={input}
              placeholder="Scan or paste the zone's QR value"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
        )}

        <button onClick={checkIn} disabled={busy || !session} className={btn}>
          {busy ? 'Checking in…' : method === 'gps' ? 'Check in with GPS' : 'Check in with QR'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
