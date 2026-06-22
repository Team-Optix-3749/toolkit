import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/hours')({
  component: HoursSummary,
})

type Summary = { build_hours: number; outreach_hours: number; total_hours: number }

function HoursSummary() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [s, setS] = useState<Summary | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('hours_summary')
      .select('build_hours, outreach_hours, total_hours')
      .eq('user_id', user!.id)
      .maybeSingle()
    if (error) return flash('Load failed: ' + error.message, true)
    setS((data as Summary) ?? { build_hours: 0, outreach_hours: 0, total_hours: 0 })
  }
  useEffect(() => {
    load()
  }, [])

  const tiles: [string, number][] = [
    ['Build hrs', s?.build_hours ?? 0],
    ['Outreach hrs', s?.outreach_hours ?? 0],
    ['Total hrs', s?.total_hours ?? 0],
  ]

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Hours summary</span>
        <button onClick={load} className={btnGhost}>
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-3 gap-px bg-line border-b border-line">
        {tiles.map(([k, v]) => (
          <div key={k} className="bg-panel px-4 py-5">
            <div className="font-mono text-3xl tabular-nums">{v}</div>
            <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{k}</div>
          </div>
        ))}
      </div>
      <div className="p-5 text-sm text-ink-soft">
        Combined from your build and outreach check-ins.
      </div>
      {Toast}
    </section>
  )
}
