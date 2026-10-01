import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import QRCode from 'qrcode'
import type { BuildSession } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/qr')({
  component: QRManager,
})

function QRManager() {
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [sessionId, setSessionId] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [autoRotate, setAutoRotate] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const now = new Date().toISOString()
    supabase
      .from('build_sessions')
      .select('*')
      .eq('cancelled', false)
      .gte('closes_at', now)
      .order('opens_at')
      .then(({ data }) => {
        const list = (data as BuildSession[]) || []
        setSessions(list)
        if (list[0]) setSessionId(list[0].id)
      })
  }, [])

  const generate = useCallback(async () => {
    if (!sessionId) return flash('Pick a session', true)
    const { data, error } = await supabase.rpc('build_action', {
      payload: { action: 'qr', session_id: sessionId },
    })
    if (error) return flash('Generate failed: ' + error.message, true)
    const d = data as { token: string; expires_at: string }
    setToken(d.token)
    setExpiresAt(new Date(d.expires_at))
  }, [sessionId])

  useEffect(() => {
    if (!token || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, token, {
      width: 280,
      margin: 2,
      color: { dark: '#06080b', light: '#ffffff' },
    })
  }, [token])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!expiresAt) return
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000))
      setCountdown(left)
      if (left <= 0 && autoRotate) generate()
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [expiresAt, autoRotate, generate])

  const sess = sessions.find((s) => s.id === sessionId)

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Session QR code</span>
      </div>
      <div className="p-5 space-y-5">
        <div>
          <label className={label}>Session</label>
          <select className={input} value={sessionId} onChange={(e) => { setSessionId(e.target.value); setToken(null) }}>
            {sessions.length === 0 && <option value="">No active sessions</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {fmtDateTime(s.opens_at)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={generate} className={btn}>
            {token ? 'New code' : 'Generate code'}
          </button>
          {token && (
            <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={(e) => setAutoRotate(e.target.checked)}
                className="w-4 h-4"
              />
              Auto-rotate every 45s
            </label>
          )}
        </div>

        {token && (
          <div className="flex flex-col items-center gap-4">
            <canvas ref={canvasRef} className="border border-line" />

            <div className="text-center space-y-1">
              <div className="font-mono text-lg tracking-widest select-all">{token}</div>
              <div className={`text-sm font-mono ${countdown <= 10 ? 'text-[#c0392b]' : 'text-ink-soft'}`}>
                {countdown > 0 ? `Expires in ${countdown}s` : 'Expired'}
              </div>
            </div>

            {sess && (
              <div className="text-xs text-ink-soft text-center">
                {sess.title} — {fmtDateTime(sess.opens_at)}
              </div>
            )}

            <button
              onClick={() => { navigator.clipboard.writeText(token); flash('Copied') }}
              className={btnGhost}
            >
              Copy code
            </button>
          </div>
        )}

        <p className="text-xs text-ink-soft">
          Display this QR code on a screen at the build location. Members scan it with their camera to check in. Codes expire after 45 seconds. Enable auto-rotate for continuous display.
        </p>
      </div>
      {Toast}
    </section>
  )
}
