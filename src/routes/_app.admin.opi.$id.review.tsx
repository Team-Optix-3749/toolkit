import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { OpiTimeline } from '~/components/OpiTimeline'
import { OpiComments } from '~/components/OpiComments'
import type { OpiInitiative } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/opi/$id/review')({
  component: OpiReview,
})

const NEXT: Record<string, string[]> = {
  SUBMITTED: ['CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
  CHANGES_REQUESTED: [],
  RESUBMITTED: ['CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
  APPROVED: ['CONVERTED'],
  REJECTED: ['SUBMITTED'],
  CONVERTED: [],
}

function docPreview(url: string): string | null {
  // Convert a Google Doc edit/view link to an embeddable preview.
  const m = url.match(/document\/d\/([^/]+)/)
  return m ? `https://docs.google.com/document/d/${m[1]}/preview` : null
}

function OpiReview() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [opi, setOpi] = useState<OpiInitiative | null>(null)

  async function load() {
    const { data, error } = await supabase.from('opi_initiatives').select('*').eq('id', id).maybeSingle()
    if (error) return flash(error.message, true)
    setOpi(data as OpiInitiative)
  }
  useEffect(() => {
    load()
  }, [id])

  async function transition(status: string) {
    const { error } = await supabase
      .from('opi_initiatives')
      .update({ status, reviewer_id: user!.id, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return flash('Update failed: ' + error.message, true)
    flash(`Moved to ${status.replace('_', ' ')}`)
    load()
  }

  if (!opi) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  const preview = opi.doc_url ? docPreview(opi.doc_url) : null

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{opi.title}</span>
          <span className="text-[11px] font-mono text-ink-soft">Submitted {fmtDate(opi.created_at)}</span>
        </div>
        <div className="p-5 space-y-4">
          <OpiTimeline status={opi.status} />
          <div className="flex flex-wrap gap-2">
            {(NEXT[opi.status] || []).map((s) => (
              <button
                key={s}
                onClick={() => transition(s)}
                className={`h-9 px-4 text-sm font-medium border ${
                  s === 'REJECTED'
                    ? 'border-[#e3a9a1] text-[#c0392b] bg-[#fbeeec] hover:bg-[#f7e2de]'
                    : 'border-ink bg-brand text-white hover:bg-black'
                }`}
              >
                {s === 'REJECTED' ? 'Reject' : `Move to ${s.replace('_', ' ')}`}
              </button>
            ))}
            {(NEXT[opi.status] || []).length === 0 && (
              <span className="text-sm text-ink-soft">No further transitions.</span>
            )}
          </div>
          {opi.description && <p className="text-sm whitespace-pre-wrap pt-2">{opi.description}</p>}
        </div>
      </section>

      {opi.doc_url && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Google Doc</span>
            <a href={opi.doc_url} target="_blank" rel="noreferrer" className="text-[11px] font-mono uppercase text-accent hover:underline">
              Open ↗
            </a>
          </div>
          {preview ? (
            <iframe title="doc" src={preview} className="w-full h-[480px] border-0" />
          ) : (
            <div className="p-5 text-sm text-ink-soft">Link is not an embeddable Google Doc.</div>
          )}
        </section>
      )}

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Feedback</span>
        </div>
        <div className="p-5">
          <OpiComments initiativeId={opi.id} />
        </div>
      </section>
      {Toast}
    </>
  )
}
