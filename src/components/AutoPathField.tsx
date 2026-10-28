import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FIELD_SYMMETRY, type AutoPath } from '~/lib/scouting'

// Field is drawn at FRC proportions (~54 x 27 ft). Points are stored
// normalized to 0..1 in *field* space with red on the left, so paths from
// either alliance line up when overlaid (see mirrorToRed).
const W = 1000
const H = 500

type Props = {
  /** Strokes to edit (interactive mode). */
  value?: AutoPath | null
  onChange?: (next: AutoPath | null) => void
  /** Which alliance the robot is on — highlights its side of the field. */
  alliance?: 'red' | 'blue' | ''
  /** Read-only overlay: several paths drawn faintly on top of each other. */
  overlay?: { path: AutoPath; label?: string }[]
  className?: string
}

const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000

export function AutoPathField({ value, onChange, alliance = '', overlay, className = '' }: Props) {
  const [drawing, setDrawing] = useState<number[][] | null>(null)
  // Full-screen drawing for phones; `vertical` turns the field sideways to use a tall screen.
  const [expanded, setExpanded] = useState<{ vertical: boolean } | null>(null)
  const strokes = value ?? []
  const editable = !!onChange

  useEffect(() => {
    if (!expanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(null)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  /** Pointer position → field coords. In vertical mode red is at the top. */
  function point(e: React.PointerEvent<SVGSVGElement>): number[] {
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    return e.currentTarget.dataset.vertical ? [round(fy), round(1 - fx)] : [round(fx), round(fy)]
  }

  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (!editable) return
    e.preventDefault()
    // Keeps the stroke going if the finger slides off the field; not essential.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* some stylus/emulated pointers can't be captured */
    }
    setDrawing([point(e)])
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing) return
    const p = point(e)
    const last = drawing[drawing.length - 1]
    // Drop near-duplicate points so a slow finger doesn't produce thousands.
    if (Math.hypot(p[0] - last[0], (p[1] - last[1]) / 2) < 0.006) return
    setDrawing([...drawing, p])
  }

  function up() {
    if (!drawing) return
    // A tap with no movement still marks the start position.
    onChange!([...strokes, drawing])
    setDrawing(null)
  }

  const all = drawing ? [...strokes, drawing] : strokes

  const surface = (vertical: boolean, interactive: boolean, cls: string) => (
    <svg
      viewBox={vertical ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`}
      data-vertical={vertical || undefined}
      role={interactive ? 'application' : 'img'}
      aria-label={interactive ? 'Auto path drawing area. Drag to draw the robot’s autonomous path.' : 'Auto paths'}
      className={`rounded-xl border border-white/10 bg-[#0b0f14] select-none ${interactive ? 'cursor-crosshair touch-none' : ''} ${cls}`}
      onPointerDown={interactive ? down : undefined}
      onPointerMove={interactive ? move : undefined}
      onPointerUp={interactive ? up : undefined}
      onPointerCancel={interactive ? up : undefined}
    >
      {/* vertical: field (x, y) → screen (H - y, x), so red sits at the top */}
      <g transform={vertical ? `translate(${H} 0) rotate(90)` : undefined}>
        <FieldBackground alliance={alliance} />
        {overlay?.map((o, i) => <Strokes key={i} strokes={o.path} faint />)}
        <Strokes strokes={all} />
      </g>
    </svg>
  )

  const controls = (
    <>
      <button
        type="button"
        onClick={() => onChange!(strokes.length > 1 ? strokes.slice(0, -1) : null)}
        disabled={!strokes.length}
        className={toolBtn}
      >
        Undo
      </button>
      <button type="button" onClick={() => onChange!(null)} disabled={!strokes.length} className={`${toolBtn} text-[#f07070]`}>
        Clear
      </button>
      <span className="ml-auto text-[11px] text-ink-soft">
        {strokes.length ? `${strokes.length} stroke${strokes.length === 1 ? '' : 's'}` : 'Drag on the field to draw'}
      </span>
    </>
  )

  return (
    <div className={className}>
      {surface(false, editable && !expanded, 'w-full')}

      {editable && (
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => setExpanded({ vertical: window.innerHeight > window.innerWidth })}
            className={`${toolBtn} text-accent`}
          >
            Full screen
          </button>
          {controls}
        </div>
      )}

      {/* Portal: cards use backdrop-filter, which would trap a fixed overlay inside them. */}
      {expanded && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Draw auto path"
          className="fixed inset-0 z-[60] bg-[#06080b] flex flex-col p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Auto path</span>
            <button type="button" onClick={() => setExpanded(null)} className="ml-auto h-10 px-5 rounded-lg bg-accent text-[#06080b] text-sm font-semibold hover:brightness-110 active:scale-[0.98]">
              Done
            </button>
          </div>
          <div className="flex-1 min-h-0 grid place-items-center">
            {surface(expanded.vertical, true, expanded.vertical ? 'h-full max-w-full' : 'w-full max-h-full')}
          </div>
          <div className="flex items-center gap-2">{controls}</div>
        </div>,
        document.body,
      )}
    </div>
  )
}

const toolBtn =
  'h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-xs font-mono uppercase tracking-wide hover:bg-white/10 disabled:opacity-40'

function FieldBackground({ alliance }: { alliance: string }) {
  const line = 'rgba(255,255,255,0.14)'
  return (
    <g pointerEvents="none">
      {/* alliance zones — the robot's own side is brighter */}
      <rect x={0} y={0} width={W * 0.18} height={H} fill="#c0392b" opacity={alliance === 'red' ? 0.22 : 0.09} />
      <rect x={W * 0.82} y={0} width={W * 0.18} height={H} fill="#2f80ed" opacity={alliance === 'blue' ? 0.22 : 0.09} />
      <rect x={1} y={1} width={W - 2} height={H - 2} fill="none" stroke={line} strokeWidth={2} rx={10} />
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke={line} strokeWidth={2} strokeDasharray="10 10" />
      <line x1={W * 0.18} y1={0} x2={W * 0.18} y2={H} stroke={line} strokeWidth={1.5} />
      <line x1={W * 0.82} y1={0} x2={W * 0.82} y2={H} stroke={line} strokeWidth={1.5} />
      <circle cx={W / 2} cy={H / 2} r={40} fill="none" stroke={line} strokeWidth={1.5} />
      <text x={16} y={28} fill="#f07070" fontSize={20} fontFamily="IBM Plex Mono, monospace" opacity={0.8}>RED</text>
      <text x={W - 16} y={28} fill="#7fb2f5" fontSize={20} fontFamily="IBM Plex Mono, monospace" textAnchor="end" opacity={0.8}>BLUE</text>
    </g>
  )
}

function Strokes({ strokes, faint = false }: { strokes: AutoPath; faint?: boolean }) {
  return (
    <g pointerEvents="none">
      {strokes.map((s, i) => {
        const pts = s.map(([x, y]) => `${x * W},${y * H}`).join(' ')
        const [sx, sy] = s[0]
        const [ex, ey] = s[s.length - 1]
        const color = faint ? 'rgba(180,245,78,0.35)' : '#b4f54e'
        return (
          <g key={i}>
            {s.length > 1 && (
              <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={faint ? 4 : 6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* start = hollow ring, end = solid dot */}
            <circle cx={sx * W} cy={sy * H} r={faint ? 8 : 11} fill="#0b0f14" stroke={color} strokeWidth={4} />
            {s.length > 1 && <circle cx={ex * W} cy={ey * H} r={faint ? 6 : 8} fill={color} />}
          </g>
        )
      })}
    </g>
  )
}

/** Move a blue-alliance path onto the red side (per FIELD_SYMMETRY) so autos can be compared. */
export const mirrorToRed = (path: AutoPath, alliance: string | null | undefined): AutoPath =>
  alliance === 'blue'
    ? path.map((s) => s.map(([x, y]) => [round(1 - x), FIELD_SYMMETRY === 'rotate' ? round(1 - y) : y]))
    : path
