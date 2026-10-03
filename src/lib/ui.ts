// Shared Tailwind class strings — glass variant.
export const card =
  'bg-panel backdrop-blur-xl border border-white/8 rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] duration-200 hover:border-white/12 hover:shadow-[0_4px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]'
export const cardHead =
  'px-5 py-3 border-b border-white/6 flex items-center justify-between gap-2 flex-wrap'
export const cardTitle = 'text-[12px] font-mono uppercase tracking-[0.08em] text-ink-soft'
export const label = 'block text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft mb-1.5'
export const input =
  'w-full h-9 px-3 bg-white/5 backdrop-blur border border-white/10 rounded-lg text-sm leading-[calc(2.25rem-2px)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-ink-soft/50'
export const textarea =
  'w-full px-3 py-2 bg-white/5 backdrop-blur border border-white/10 rounded-lg text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-ink-soft/50'
export const btn =
  'h-10 px-6 bg-accent text-[#06080b] text-sm font-semibold rounded-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center transition-all duration-150'
export const btnGhost =
  'h-8 px-3 border border-white/10 bg-white/5 backdrop-blur rounded-lg text-xs font-mono uppercase tracking-wide hover:bg-white/10 hover:border-white/15 active:scale-[0.98] inline-flex items-center justify-center transition-all duration-150'

export const r1 = (n: number) => Math.round(n * 10) / 10
export const todayStr = () => new Date().toISOString().slice(0, 10)
