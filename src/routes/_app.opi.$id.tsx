import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { OpiTimeline } from '~/components/OpiTimeline'
import { OpiComments } from '~/components/OpiComments'
import type { OpiInitiative } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/opi/$id')({
  component: OpiDetail,
})

function OpiDetail() {
  const { id } = Route.useParams()
  const { flash, Toast } = useToast()
  const [opi, setOpi] = useState<OpiInitiative | null>(null)

  useEffect(() => {
    supabase
      .from('opi_initiatives')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) flash(error.message, true)
        setOpi(data as OpiInitiative)
      })
  }, [id])

  if (!opi) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{opi.title}</span>
          <span className="text-[11px] font-mono text-ink-soft">Submitted {fmtDate(opi.created_at)}</span>
        </div>
        <div className="p-5 space-y-4">
          <OpiTimeline status={opi.status} />
          {opi.doc_url && (
            <a href={opi.doc_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-accent hover:underline">
              Open Google Doc ↗
            </a>
          )}
          {opi.description && <p className="text-sm whitespace-pre-wrap text-ink">{opi.description}</p>}
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Comments & feedback</span>
        </div>
        <div className="p-5">
          <OpiComments initiativeId={opi.id} />
        </div>
      </section>
      {Toast}
    </>
  )
}
