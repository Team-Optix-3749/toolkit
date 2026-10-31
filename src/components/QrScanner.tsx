import { useEffect, useRef, useState } from 'react'

/** Camera QR scanner using the native BarcodeDetector. Calls onScanned once per hit. */
export function QrScanner({ onScanned, onClose }: { onScanned: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Held in a ref so a parent re-render doesn't restart the camera.
  const onScannedRef = useRef(onScanned)
  onScannedRef.current = onScanned

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
                active = false
                onScannedRef.current(barcodes[0].rawValue)
                return
              }
            } catch {}
            if (active) requestAnimationFrame(scan)
          }
          videoRef.current!.onplaying = () => scan()
        } else {
          setError("This browser can't scan in-app. Open your phone's camera app and point it at the QR instead, or enter the code manually.")
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
  }, [])

  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg border border-[#e7c08a]/30 bg-[#e7c08a]/10 text-sm text-[#e7c08a]">
        {error}
      </div>
    )
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black">
      <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted />
      <button
        onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); onClose() }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg"
        aria-label="Close camera"
      >
        &times;
      </button>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-40 h-40 border-2 border-white/40 rounded-lg" />
      </div>
    </div>
  )
}

/**
 * A check-in QR encodes a deep link like `…/outreach/check-in?event=X&code=Y`.
 * Accept either that link or a bare code typed by hand.
 */
export function parseCheckinCode(raw: string): { code: string; ref?: string } {
  const value = raw.trim()
  try {
    const u = new URL(value)
    const code = u.searchParams.get('code')
    if (code) return { code, ref: u.searchParams.get('event') ?? u.searchParams.get('session') ?? undefined }
  } catch {}
  return { code: value }
}

export function checkinUrl(path: 'build/check-in' | 'outreach/check-in', refKey: 'session' | 'event', ref: string, code: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}${path}?${refKey}=${ref}&code=${code}`
}
