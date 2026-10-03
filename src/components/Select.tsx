import { useEffect, useRef, useState } from 'react'

export type SelectOption = { value: string; label: string }

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

/**
 * Custom glass-themed select dropdown. Replaces the native <select> so the
 * options menu can be styled (native <option> can't be themed on Chromium).
 * Keyboard-accessible: Enter/Space opens, Esc closes, Arrows navigate.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  size = 'md',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const idx = Math.max(0, options.findIndex((o) => o.value === value))
    setHighlight(idx)
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(options.length - 1, h + 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)) }
      if (e.key === 'Enter') { e.preventDefault(); const opt = options[highlight]; if (opt) { onChange(opt.value); setOpen(false) } }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, highlight, options, value, onChange])

  const heightCls = size === 'sm' ? 'h-8 text-xs px-2.5' : 'h-9 text-sm px-3'

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full ${heightCls} inline-flex items-center justify-between gap-2 bg-white/5 backdrop-blur border border-white/10 rounded-lg outline-none transition-all duration-150 hover:bg-white/[0.07] hover:border-white/15 focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 ${
          open ? 'border-accent ring-1 ring-accent' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate text-left ${current ? '' : 'text-ink-soft/70'}`}>
          {current?.label ?? placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-ink-soft shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto bg-[rgba(14,18,24,0.95)] backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] p-1"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-ink-soft">No options</div>
          )}
          {options.map((opt, i) => {
            const selected = opt.value === value
            const highlighted = i === highlight
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md flex items-center justify-between gap-2 transition-colors duration-100 ${
                  highlighted ? 'bg-white/8' : ''
                } ${selected ? 'text-accent' : 'text-ink'}`}
              >
                <span className="truncate">{opt.label}</span>
                {selected && (
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
