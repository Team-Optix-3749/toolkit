import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { btn, btnGhost } from '~/lib/ui'

type Issued = { token: string; expires_at: string }

/**
 * Displays a check-in QR. `issue` asks the server for a fresh token; the QR
 * encodes `urlFor(token)` so members can scan it with their phone camera.
 * Rotating codes re-issue automatically when they expire.
 */
export function CheckInQr({
  issue,
  urlFor,
  rotating = true,
  onError,
}: {
  issue: () => Promise<Issued | null>
  urlFor: (token: string) => string
  rotating?: boolean
  onError?: (msg: string) => void
}) {
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [big, setBig] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const refresh = useCallback(async () => {
    const d = await issue()
    if (!d) return
    setToken(d.token)
    setExpiresAt(new Date(d.expires_at))
  }, [issue])

  useEffect(() => {
    if (!token || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, urlFor(token), {
      width: big ? 520 : 280,
      margin: 2,
      color: { dark: '#06080b', light: '#ffffff' },
    }).catch((e: Error) => onError?.(e.message))
  }, [token, big, urlFor, onError])

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000))
      setCountdown(left)
      if (left <= 0 && rotating) refresh()
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt, rotating, refresh])

  if (!token) {
    return (
      <button onClick={refresh} className={btn}>
        Show check-in QR
      </button>
    )
  }

  const body = (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-lg max-w-full h-auto" />
      <div className="font-mono text-base tracking-widest select-all">{token}</div>
      <div className={`text-xs font-mono ${rotating && countdown <= 10 ? 'text-[#f07070]' : 'text-ink-soft'}`}>
        {countdown <= 0
          ? 'Expired'
          : rotating
            ? `Refreshes in ${countdown}s`
            : `Valid until ${expiresAt!.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`}
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        <button onClick={() => setBig((v) => !v)} className={btnGhost}>
          {big ? 'Exit full screen' : 'Full screen'}
        </button>
        {!rotating && (
          <button onClick={refresh} className={btnGhost}>
            New code
          </button>
        )}
      </div>
    </div>
  )

  if (big) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#06080b]/95 backdrop-blur flex items-center justify-center p-4">
        {body}
      </div>
    )
  }
  return body
}
