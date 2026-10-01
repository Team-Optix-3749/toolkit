import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { OpiTimeline } from '~/components/OpiTimeline'
import { OpiFeedbackList } from '~/components/OpiFeedback'
import { Badge } from '~/components/Badge'
import type { Opi } from '~/lib/types'
import { card, cardHead, cardTitle, btn, label, input, textarea } from '~/lib/ui'

export const Route = createFileRoute('/_app/opi/$id')({
  component: OpiDetail,
})

const LOCKED_STATUSES = new Set(['SUBMITTED', 'RESUBMITTED', 'APPROVED', 'CONVERTED'])

function OpiDetail() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [opi, setOpi] = useState<Opi | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', document_url: '', summary: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('opis').select('*').eq('id', id).maybeSingle()
    if (error) flash(error.message, true)
    const o = data as Opi
    setOpi(o)
    if (o) setForm({ title: o.title, document_url: o.document_url || '', summary: o.summary || '' })
  }

  useEffect(() => {
    load()
  }, [id])

  const isOwner = opi?.submitter_id === user?.id
  const locked = opi ? LOCKED_STATUSES.has(opi.status) : true
  const canResubmit = isOwner && opi?.status === 'CHANGES_REQUESTED'

  async function resubmit() {
    const rawUrl = form.document_url.trim()
    let docUrl: string | undefined
    if (rawUrl) {
      docUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
      if (!docUrl.startsWith('https://docs.google.com/')) return flash('Link must be a Google Docs URL (docs.google.com)', true)
    }
    setBusy(true)
    const { error } = await supabase.rpc('opi_action', {
      payload: {
        action: 'resubmit',
        id,
        title: form.title.trim() || undefined,
        summary: form.summary || undefined,
        document_url: docUrl,
      },
    })
    setBusy(false)
    if (error) return flash(error.message, true)
    flash('Resubmitted for review')
    setEditing(false)
    load()
  }

  if (!opi) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{opi.title}</span>
          <span className="text-[11px] font-mono text-ink-soft">Submitted {fmtDate(opi.created_at ?? '')}</span>
        </div>
        <div className="p-5 space-y-4">
          <OpiTimeline status={opi.status} />

          {locked && isOwner && (
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <Badge label={opi.status.replace('_', ' ')} tone={opi.status} />
              <span>Edits are locked while under review.</span>
            </div>
          )}

          {!editing ? (
            <>
              {opi.document_url && (
                <a
                  href={opi.document_url.startsWith('http') ? opi.document_url : `https://${opi.document_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sm text-accent hover:underline"
                >
                  Open Google Doc ↗
                </a>
              )}
              {opi.summary && <p className="text-sm whitespace-pre-wrap text-ink">{opi.summary}</p>}
              <div className="flex gap-2 pt-2">
                {canResubmit && (
                  <>
                    <button onClick={() => setEditing(true)} className={btn}>
                      Edit & resubmit
                    </button>
                    <button onClick={resubmit} disabled={busy} className={btn}>
                      Resubmit as-is
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4 border-t border-line pt-4">
              <div>
                <label className={label}>Title</label>
                <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={label}>Google Doc link</label>
                <input className={input} value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} />
              </div>
              <div>
                <label className={label}>Summary</label>
                <textarea className={textarea} rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button onClick={resubmit} disabled={busy} className={btn}>
                  {busy ? 'Saving…' : 'Save & resubmit'}
                </button>
                <button onClick={() => setEditing(false)} className="text-sm text-ink-soft hover:text-ink">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Feedback & history</span>
        </div>
        <div className="p-5">
          <OpiFeedbackList opiId={opi.id} />
        </div>
      </section>
      {Toast}
    </>
  )
}
