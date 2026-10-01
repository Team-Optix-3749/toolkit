import { useEffect, useState } from 'react'

type Mode = 'light' | 'dark'

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setMode(document.documentElement.classList.contains('light') ? 'light' : 'dark')
  }, [])

  function toggle() {
    const next: Mode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    document.documentElement.classList.toggle('light', next === 'light')
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className={
        className ??
        'h-8 w-8 grid place-items-center border border-line bg-panel text-ink-soft hover:text-ink text-sm'
      }
    >
      {mounted ? (mode === 'dark' ? '☀' : '☾') : '☀'}
    </button>
  )
}
