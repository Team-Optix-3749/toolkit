import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { fmtDateTime } from '~/lib/format'
import type { OpiFeedback } from '~/lib/types'

export function OpiFeedbackList({ opiId }: { opiId: string }) {
  const [items, setItems] = useState<OpiFeedback[]>([])

  async function load() {
    const { data } = await supabase
      .from('opi_feedback')
      .select('*')
      .eq('opi_id', opiId)
      .order('created_at', { ascending: true })
    setItems((data as OpiFeedback[]) || [])
  }
  useEffect(() => {
    load()
  }, [opiId])

  return (
    <div className="space-y-3">
      {items.map((fb) => (
        <div key={fb.id} className="border-l-2 border-line pl-3">
          <div className="text-[11px] font-mono uppercase tracking-wide text-ink-soft">
            {fb.decision && <span className="text-accent mr-2">[{fb.decision.replace('_', ' ')}]</span>}
            {fmtDateTime(fb.created_at)}
          </div>
          <p className="text-sm whitespace-pre-wrap">{fb.feedback}</p>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-ink-soft">No feedback yet.</p>}
    </div>
  )
}
