import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { Opi } from '~/lib/types'
import { card, cardHead, cardTitle, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/opi/')({
  component: OpiList,
})

function OpiList() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Opi[]>([])

  async function load() {
    const { data, error } = await supabase
      .from('opis')
      .select('*')
      .eq('submitter_id', user!.id)
      .order('created_at', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as Opi[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>My OPI initiatives</span>
        <Link to="/opi/new" className={btn.replace('h-10', 'h-8') + ' px-4 text-xs'}>
          New initiative
        </Link>
      </div>
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <Link key={r.id} to="/opi/$id" params={{ id: r.id }} className="px-5 py-3 flex items-center gap-3 hover:bg-canvas">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-ink-soft font-mono">Submitted {fmtDate(r.created_at ?? '')}</div>
            </div>
            <Badge label={r.status.replace('_', ' ')} tone={r.status} />
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="px-5 py-8 text-center text-ink-soft text-sm">
            No initiatives yet.{' '}
            <Link to="/opi/new" className="text-accent hover:underline">
              Submit one
            </Link>
            .
          </div>
        )}
      </div>
      {Toast}
    </section>
  )
}
