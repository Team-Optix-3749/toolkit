import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDate, toISO } from '~/lib/format'
import { OpiTimeline } from '~/components/OpiTimeline'
import { OpiFeedbackList } from '~/components/OpiFeedback'
import type { Opi } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost, label, input, textarea as textareaCls } from '~/lib/ui'

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

const NEEDS_FEEDBACK = new Set(['CHANGES_REQUESTED', 'REJECTED'])

function docPreview(url: string): string | null {
  const m = url.match(/document\/d\/([^/]+)/)
  return m ? `https://docs.google.com/document/d/${m[1]}/preview` : null
}

function OpiReview() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { flash, Toast } = useToast()
  const [opi, setOpi] = useState<Opi | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [convertForm, setConvertForm] = useState({ title: '', location: '', starts_at: '', ends_at: '' })

  async function load() {
    const { data, error } = await supabase.from('opis').select('*').eq('id', id).maybeSingle()
    if (error) return flash(error.message, true)
    const o = data as Opi
    setOpi(o)
    if (o) setConvertForm((f) => ({ ...f, title: f.title || o.title }))
  }
  useEffect(() => {
    load()
  }, [id])

  async function transition(status: string) {
    if (NEEDS_FEEDBACK.has(status) && !feedback.trim()) {
      return flash('Feedback is required for this action', true)
    }
    setBusy(true)

    const actionMap: Record<string, string> = {
      CHANGES_REQUESTED: 'changes',
      APPROVED: 'approve',
      REJECTED: 'reject',
      SUBMITTED: 'reopen',
    }

    const { error } = await supabase.rpc('opi_action', {
      payload: {
        action: actionMap[status] || status.toLowerCase(),
        id,
        feedback: feedback.trim() || undefined,
      },
    })
    setBusy(false)
    if (error) return flash('Update failed: ' + error.message, true)
    setFeedback('')
    flash(`Moved to ${status.replace('_', ' ')}`)
    load()
  }

  async function convertToEvent() {
    if (!convertForm.title.trim() || !convertForm.starts_at) {
      return flash('Title and start time required', true)
    }
    setBusy(true)
    const { error } = await supabase.rpc('opi_action', {
      payload: {
        action: 'convert',
        id,
        title: convertForm.title.trim(),
        location: convertForm.location || null,
        starts_at: toISO(convertForm.starts_at),
        ends_at: convertForm.ends_at ? toISO(convertForm.ends_at) : null,
      },
    })
    setBusy(false)
    if (error) return flash(error.message, true)
    flash('Converted to outreach event')
    load()
  }

  if (!opi) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  const preview = opi.document_url ? docPreview(opi.document_url) : null
  const actions = NEXT[opi.status] || []

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{opi.title}</span>
          <span className="text-[11px] font-mono text-ink-soft">Submitted {fmtDate(opi.created_at ?? '')}</span>
        </div>
        <div className="p-5 space-y-4">
          <OpiTimeline status={opi.status} />
          {opi.summary && <p className="text-sm whitespace-pre-wrap pt-2">{opi.summary}</p>}

          {actions.length > 0 && (
            <div className="border-t border-line pt-4 space-y-3">
              {actions.some((s) => NEEDS_FEEDBACK.has(s)) && (
                <div>
                  <label className={label}>Reviewer feedback</label>
                  <textarea
                    className={textareaCls}
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Required for changes requested or rejection"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {actions.map((s) => {
                  if (s === 'CONVERTED') {
                    return (
                      <button key={s} onClick={() => setShowConvert(true)} className={btn}>
                        Convert to event
                      </button>
                    )
                  }
                  return (
                    <button
                      key={s}
                      onClick={() => transition(s)}
                      disabled={busy}
                      className={
                        s === 'REJECTED'
                          ? `h-9 px-4 text-sm font-medium border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10 rounded-lg hover:bg-[#c0392b]/20 inline-flex items-center justify-center transition-all`
                          : btn
                      }
                    >
                      {s === 'REJECTED' ? 'Reject' : s === 'CHANGES_REQUESTED' ? 'Request changes' : `Move to ${s.replace('_', ' ')}`}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {actions.length === 0 && opi.status !== 'CHANGES_REQUESTED' && (
            <span className="text-sm text-ink-soft">No further transitions.</span>
          )}

          {opi.event_id && <div className="text-sm text-[#1a7f4b]">Linked to outreach event</div>}

          <div className="border-t border-line pt-4">
            {confirmDelete ? (
              <div className="border border-[#c0392b]/30 bg-[#c0392b]/5 p-4 space-y-3">
                <p className="text-sm font-medium">Permanently delete this OPI?</p>
                <p className="text-sm text-ink-soft">This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setBusy(true)
                      const { error } = await supabase.from('opis').delete().eq('id', id)
                      setBusy(false)
                      if (error) return flash('Delete failed: ' + error.message, true)
                      flash('OPI deleted')
                      navigate({ to: '/admin/opi' })
                    }}
                    disabled={busy}
                    className="h-9 px-4 text-sm font-medium border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10 rounded-lg hover:bg-[#c0392b]/20 inline-flex items-center justify-center transition-all"
                  >
                    {busy ? '…' : 'Yes, delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className={btnGhost}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-ink-soft hover:text-[#c0392b]">
                Delete this OPI
              </button>
            )}
          </div>
        </div>
      </section>

      {showConvert && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Convert to outreach event</span>
            <button onClick={() => setShowConvert(false)} className={btnGhost}>
              Cancel
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={label}>Event title</label>
              <input className={input} value={convertForm.title} onChange={(e) => setConvertForm({ ...convertForm, title: e.target.value })} />
            </div>
            <div>
              <label className={label}>Location</label>
              <input className={input} value={convertForm.location} onChange={(e) => setConvertForm({ ...convertForm, location: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Starts</label>
                <input type="datetime-local" className={input} value={convertForm.starts_at} onChange={(e) => setConvertForm({ ...convertForm, starts_at: e.target.value })} />
              </div>
              <div>
                <label className={label}>Ends</label>
                <input type="datetime-local" className={input} value={convertForm.ends_at} onChange={(e) => setConvertForm({ ...convertForm, ends_at: e.target.value })} />
              </div>
            </div>
            <button onClick={convertToEvent} disabled={busy} className={btn}>
              {busy ? 'Converting…' : 'Create event & mark converted'}
            </button>
          </div>
        </section>
      )}

      {opi.document_url && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Google Doc</span>
            <a href={opi.document_url?.startsWith('http') ? opi.document_url : `https://${opi.document_url}`} target="_blank" rel="noreferrer" className="text-[11px] font-mono uppercase text-accent hover:underline">
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
