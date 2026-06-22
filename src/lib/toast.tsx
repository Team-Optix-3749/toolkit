import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null)
  const flash = useCallback((text: string, err?: boolean) => {
    setToast({ text, err })
    setTimeout(() => setToast(null), 2800)
  }, [])
  const Toast = toast ? (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 text-sm text-white border-l-2 z-50 ${
        toast.err ? 'bg-[#c0392b] border-white/40' : 'bg-brand border-accent'
      }`}
    >
      {toast.text}
    </div>
  ) : null
  return { flash, Toast }
}
