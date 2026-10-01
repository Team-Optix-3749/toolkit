import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { BuildSession, BuildRecord } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/check-in')({
  component: CheckInFlow,
})

const SCHOOL_LAT = 33.0144
const SCHOOL_LNG = -117.1222
const MAX_MILES = 1
const MAX_CHECKIN_MINUTES = 180

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type GeoState = 'checking' | 'ok' | 'too-far' | 'denied' | 'unavailable'

function CheckInFlow() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [open, setOpen] = useState<BuildRecord | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [expired, setExpired] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [useQr, setUseQr] = useState(false)

  const [geo, setGeo] = useState<GeoState>('checking')
  const [distance, setDistance] = useState<number | null>(null)

  const checkLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeo('unavailable')
      return
    }
    setGeo('checking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = haversine(pos.coords.latitude, pos.coords.longitude, SCHOOL_LAT, SCHOOL_LNG)
        setDistance(Math.round(d * 100) / 100)
        setGeo(d <= MAX_MILES ? 'ok' : 'too-far')
      },
      (err) => {
        setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  useEffect(() => {
    checkLocation()
  }, [checkLocation])

  async function load() {
    const now = new Date().toISOString()
    const [{ data: s }, { data: ci }] = await Promise.all([
      supabase
        .from('build_sessions')
        .select('*')
        .eq('cancelled', false)
        .lte('opens_at', now)
        .order('opens_at', { ascending: false })
        .limit(20),
      supabase
        .from('build_records')
        .select('*')
        .eq('member_id', user!.id)
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1),
    ])
    const available = ((s as BuildSession[]) || []).filter(
      (sess) => !sess.closes_at || new Date(sess.closes_at) > new Date(),
    )
    setSessions(available)

    const activeRecord = ((ci as BuildRecord[]) || [])[0] ?? null
    if (activeRecord) {
      const elapsed = (Date.now() - new Date(activeRecord.check_in).getTime()) / 60000
      if (elapsed >= MAX_CHECKIN_MINUTES) {
        await supabase.rpc('build_action', {
          payload: { action: 'check_out', id: activeRecord.id },
        })
        setOpen(null)
        setExpired(true)
        return
      }
    }

    setOpen(activeRecord)
    if (!sessionId && available[0]) setSessionId(available[0].id)
  }

  useEffect(() => {
    load()
  }, [])

  async function checkIn(scannedToken?: string) {
    const locationOk = geo === 'ok'
    const codeValue = scannedToken || token.trim()

    if (!locationOk && !codeValue) {
      return flash('Either be at Del Norte HS or scan/enter a QR code to check in.', true)
    }
    if (!sessionId) return flash('Pick a session', true)
    if (open) return flash('You already have an active check-in. Check out first.', true)

    setBusy(true)
    const payload: Record<string, string> = { action: 'check_in', session_id: sessionId }
    if (codeValue) payload.token = codeValue
    const { data, error } = await supabase.rpc('build_action', { payload })
    setBusy(false)
    if (error) return flash('Check-in failed: ' + error.message, true)
    flash('Checked in')
    setToken('')
    setExpired(false)
    setScanning(false)
    load()
  }

  async function checkOut() {
    if (!open) return
    setBusy(true)
    const { data, error } = await supabase.rpc('build_action', {
      payload: { action: 'check_out', id: open.id },
    })
    setBusy(false)
    if (error) return flash('Check-out failed: ' + error.message, true)
    const mins = (data as any)?.credited_minutes
    flash(mins != null ? `Checked out, ${hoursFromMinutes(mins)} h logged` : 'Checked out')
    load()
  }

  function onScanned(code: string) {
    setToken(code)
    setScanning(false)
    checkIn(code)
  }

  if (open) {
    const elapsed = Math.round((Date.now() - new Date(open.check_in).getTime()) / 60000)
    const remaining = MAX_CHECKIN_MINUTES - elapsed
    return (
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Active check-in</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm">
            Checked in since <strong>{fmtDateTime(open.check_in)}</strong>.
          </p>
          <p className="text-sm text-ink-soft">Running time: ~{hoursFromMinutes(elapsed)} h</p>
          {remaining <= 30 && remaining > 0 && (
            <div className="px-4 py-3 border border-[#e7c08a] bg-[#fcf6ec] text-sm text-[#b4690e]">
              Session expires in {remaining} min. Check out and check in again to continue.
            </div>
          )}
          <button onClick={checkOut} disabled={busy} className={btn}>
            {busy ? 'Checking out…' : 'Check out now'}
          </button>
        </div>
        {Toast}
      </section>
    )
  }

  const canCheckInByLocation = geo === 'ok'

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Build check-in</span>
      </div>
      <div className="p-5 space-y-4">
        {expired && (
          <div className="px-4 py-3 border border-[#e7c08a] bg-[#fcf6ec] text-sm text-[#b4690e]">
            Your previous session was auto-closed after 3 hours. Check in again to continue.
          </div>
        )}

        <LocationBanner geo={geo} distance={distance} onRetry={checkLocation} />

        <div>
          <label className={label}>Session</label>
          <select className={input} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.length === 0 && <option value="">No open sessions</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {fmtDateTime(s.opens_at)}
              </option>
            ))}
          </select>
        </div>

        {/* Location check-in */}
        {canCheckInByLocation && (
          <button onClick={() => checkIn()} disabled={busy || !sessionId} className={btn}>
            {busy ? 'Checking in…' : 'Check in with location'}
          </button>
        )}

        {/* Divider */}
        {canCheckInByLocation && (
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-line" />
            <span className="text-xs text-ink-soft font-mono uppercase">or</span>
            <div className="flex-1 border-t border-line" />
          </div>
        )}

        {/* QR / code section */}
        {!useQr && !canCheckInByLocation ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              You're not at Del Norte HS. Scan a QR code or enter a session code to check in.
            </p>
            <QrSection
              token={token}
              setToken={setToken}
              scanning={scanning}
              setScanning={setScanning}
              onScanned={onScanned}
              busy={busy}
              sessionId={sessionId}
              onCheckIn={() => checkIn()}
            />
          </div>
        ) : !useQr ? (
          <button onClick={() => setUseQr(true)} className={btnGhost}>
            Use QR code instead
          </button>
        ) : (
          <div className="space-y-3">
            <QrSection
              token={token}
              setToken={setToken}
              scanning={scanning}
              setScanning={setScanning}
              onScanned={onScanned}
              busy={busy}
              sessionId={sessionId}
              onCheckIn={() => checkIn()}
            />
            <button onClick={() => setUseQr(false)} className="text-xs text-ink-soft hover:text-ink">
              Hide QR
            </button>
          </div>
        )}
      </div>
      {Toast}
    </section>
  )
}

function QrSection({ token, setToken, scanning, setScanning, onScanned, busy, sessionId, onCheckIn }: {
  token: string
  setToken: (v: string) => void
  scanning: boolean
  setScanning: (v: boolean) => void
  onScanned: (code: string) => void
  busy: boolean
  sessionId: string
  onCheckIn: () => void
}) {
  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setScanning(!scanning)} className={btnGhost}>
          {scanning ? 'Close camera' : 'Scan QR code'}
        </button>
      </div>

      {scanning && <QrScanner onScanned={onScanned} onClose={() => setScanning(false)} />}

      <div>
        <label className={label}>Or enter code manually</label>
        <div className="flex gap-2">
          <input
            className={input}
            placeholder="Paste the session code"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button onClick={onCheckIn} disabled={busy || !sessionId || !token.trim()} className={btn}>
            {busy ? '…' : 'Go'}
          </button>
        </div>
      </div>
    </>
  )
}

function QrScanner({ onScanned, onClose }: { onScanned: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }

        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          const scan = async () => {
            if (!active || !videoRef.current) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                onScanned(barcodes[0].rawValue)
                return
              }
            } catch {}
            if (active) requestAnimationFrame(scan)
          }
          videoRef.current!.onplaying = () => scan()
        } else {
          setError('QR scanning not supported in this browser. Enter the code manually.')
        }
      } catch {
        setError('Camera access denied. Enter the code manually.')
      }
    }

    start()

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [onScanned])

  if (error) {
    return (
      <div className="px-4 py-3 border border-[#e7c08a] bg-[#fcf6ec] text-sm text-[#b4690e]">
        {error}
      </div>
    )
  }

  return (
    <div className="relative border border-line bg-black">
      <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted />
      <button
        onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); onClose() }}
        className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white flex items-center justify-center text-lg"
      >
        &times;
      </button>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-40 h-40 border-2 border-white/40" />
      </div>
    </div>
  )
}

function LocationBanner({ geo, distance, onRetry }: { geo: GeoState; distance: number | null; onRetry: () => void }) {
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
        At Del Norte HS{distance != null ? ` (${distance} mi)` : ''}
      </div>
    )
  }
  const messages: Record<string, string> = {
    'too-far': `You're ${distance ?? '?'} mi from Del Norte HS.`,
    denied: 'Location access denied.',
    unavailable: 'Location unavailable.',
  }
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 border border-[#e7c08a] bg-[#fcf6ec] text-sm text-[#b4690e]">
      <span>{messages[geo]}</span>
      {geo !== 'denied' && (
        <button onClick={onRetry} className="text-xs font-mono underline">Retry</button>
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
