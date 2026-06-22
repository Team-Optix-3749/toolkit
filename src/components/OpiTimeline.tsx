const FLOW = ['PENDING', 'IN_REVIEW', 'APPROVED', 'EXECUTED'] as const

export function OpiTimeline({ status }: { status: string }) {
  if (status === 'REJECTED') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wide px-2 py-1 border border-[#e3a9a1] text-[#c0392b] bg-[#fbeeec]">
          Rejected
        </span>
      </div>
    )
  }
  const idx = FLOW.indexOf(status as (typeof FLOW)[number])
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {FLOW.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 border ${
              i <= idx ? 'border-accent text-accent bg-accent-soft' : 'border-line text-ink-soft bg-panel'
            }`}
          >
            {s.replace('_', ' ')}
          </span>
          {i < FLOW.length - 1 && <span className={i < idx ? 'text-accent' : 'text-ink-soft'}>→</span>}
        </div>
      ))}
    </div>
  )
}
