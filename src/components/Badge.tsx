const TONES: Record<string, string> = {
  PENDING: 'border-[#b4690e]/25 text-[#e7c08a] bg-[#b4690e]/10',
  SUBMITTED: 'border-[#b4690e]/25 text-[#e7c08a] bg-[#b4690e]/10',
  CHANGES_REQUESTED: 'border-[#c0392b]/25 text-[#f07070] bg-[#c0392b]/10',
  RESUBMITTED: 'border-accent/25 text-accent bg-accent/10',
  IN_REVIEW: 'border-accent/25 text-accent bg-accent/10',
  APPROVED: 'border-[#1a7f4b]/25 text-[#5dd89a] bg-[#1a7f4b]/10',
  CONVERTED: 'border-[#1a7f4b]/25 text-[#5dd89a] bg-[#1a7f4b]/10',
  EXECUTED: 'border-[#1a7f4b]/25 text-[#5dd89a] bg-[#1a7f4b]/10',
  REJECTED: 'border-[#c0392b]/25 text-[#f07070] bg-[#c0392b]/10',
  assigned: 'border-[#b4690e]/25 text-[#e7c08a] bg-[#b4690e]/10',
  in_progress: 'border-accent/25 text-accent bg-accent/10',
  submitted: 'border-[#b4690e]/25 text-[#e7c08a] bg-[#b4690e]/10',
  changes_requested: 'border-[#c0392b]/25 text-[#f07070] bg-[#c0392b]/10',
  resubmitted: 'border-accent/25 text-accent bg-accent/10',
  completed: 'border-[#1a7f4b]/25 text-[#5dd89a] bg-[#1a7f4b]/10',
  cancelled: 'border-white/10 text-ink-soft bg-white/5',
  neutral: 'border-white/10 text-ink-soft bg-white/5',
  accent: 'border-accent/25 text-accent bg-accent/10',
}

export function Badge({ label, tone }: { label: string; tone?: string }) {
  const cls = TONES[tone ?? label] ?? TONES.neutral
  return (
    <span className={`text-[11px] font-mono uppercase tracking-wide px-2 py-0.5 border rounded-md ${cls}`}>
      {label}
    </span>
  )
}
