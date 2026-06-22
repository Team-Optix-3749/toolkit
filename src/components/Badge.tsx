const TONES: Record<string, string> = {
  PENDING: 'border-[#e7c08a] text-[#b4690e] bg-[#fcf6ec]',
  IN_REVIEW: 'border-accent text-accent bg-accent-soft',
  APPROVED: 'border-[#9bd0b0] text-[#1a7f4b] bg-[#eefaf2]',
  EXECUTED: 'border-[#9bd0b0] text-[#1a7f4b] bg-[#eefaf2]',
  REJECTED: 'border-[#e3a9a1] text-[#c0392b] bg-[#fbeeec]',
  neutral: 'border-line text-ink-soft bg-panel',
  accent: 'border-accent text-accent bg-accent-soft',
}

export function Badge({ label, tone }: { label: string; tone?: string }) {
  const cls = TONES[tone ?? label] ?? TONES.neutral
  return (
    <span className={`text-[11px] font-mono uppercase tracking-wide px-1.5 py-0.5 border ${cls}`}>
      {label}
    </span>
  )
}
