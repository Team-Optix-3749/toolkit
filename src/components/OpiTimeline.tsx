const FLOW = ['SUBMITTED', 'APPROVED', 'CONVERTED'] as const
const REVIEW_FLOW = ['SUBMITTED', 'CHANGES_REQUESTED', 'RESUBMITTED'] as const

export function OpiTimeline({ status }: { status: string }) {
  if (status === 'REJECTED') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded-md border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10">
          Rejected
        </span>
      </div>
    )
  }

  const inReview = REVIEW_FLOW.includes(status as (typeof REVIEW_FLOW)[number])
  const idx = FLOW.indexOf(status as (typeof FLOW)[number])
  const reviewIdx = REVIEW_FLOW.indexOf(status as (typeof REVIEW_FLOW)[number])

  if (inReview) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {REVIEW_FLOW.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded-md border ${
                i <= reviewIdx ? 'border-accent/30 text-accent bg-accent/10' : 'border-white/10 text-ink-soft bg-white/5'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </span>
            {i < REVIEW_FLOW.length - 1 && <span className={i < reviewIdx ? 'text-accent' : 'text-ink-soft'}>→</span>}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {FLOW.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded-md border ${
              i <= idx ? 'border-accent/30 text-accent bg-accent/10' : 'border-white/10 text-ink-soft bg-white/5'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </span>
          {i < FLOW.length - 1 && <span className={i < idx ? 'text-accent' : 'text-ink-soft'}>→</span>}
        </div>
      ))}
    </div>
  )
}
