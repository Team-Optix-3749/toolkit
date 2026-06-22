// Shared Tailwind class strings.
export const card = 'bg-panel border border-line'
export const cardHead = 'px-5 py-3 border-b border-line flex items-center justify-between'
export const cardTitle = 'text-[12px] font-mono uppercase tracking-[0.08em] text-ink-soft'
export const label = 'block text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft mb-1.5'
export const input =
  'w-full h-9 px-3 bg-panel border border-line text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent'
export const textarea =
  'w-full px-3 py-2 bg-panel border border-line text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent'
export const btn =
  'h-10 px-6 bg-brand text-white text-sm font-medium hover:bg-black disabled:opacity-50 inline-flex items-center justify-center'
export const btnGhost =
  'h-8 px-3 border border-line bg-panel text-xs font-mono uppercase tracking-wide hover:bg-canvas inline-flex items-center'

export const r1 = (n: number) => Math.round(n * 10) / 10
export const todayStr = () => new Date().toISOString().slice(0, 10)
