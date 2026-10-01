import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { OpiTimeline } from '~/components/OpiTimeline'
import { OpiComments } from '~/components/OpiComments'
import { Badge } from '~/components/Badge'
import type { OpiInitiative } from '~/lib/types'
import { card, cardHead, cardTitle, btn, label, input, textarea } from '~/lib/ui'

export const Route = createFileRoute('/_app/opi/$id')({
  component: OpiDetail,
})

const LOCKED_STATUSES = new Set(['SUBMITTED', 'RESUBMITTED', 'APPROVED', 'CONVERTED'])

function OpiDetail() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [opi, setOpi] = useState<OpiInitiative | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', doc_url: '', description: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('opi_initiatives').select('*').eq('id', id).maybeSingle()
    if (error) flash(error.message, true)
    const o = data as OpiInitiative
    setOpi(o)
    if (o) setForm({ title: o.title, doc_url: o.doc_url || '', description: o.description || '' })
  }

  useEffect(() => { load() }, [id])

  const isOwner = opi?.user_id === user?.id
  const locked = opi ? LOCKED_STATUSES.has(opi.status) : true
  const canEdit = isOwner && !locked
  const canResubmit = isOwner && opi?.status === 'CHANGES_REQUESTED'

  async function save() {
    if (!form.title.trim()) return flash('Title required', true)
    setBusy(true)
    const { error } = await supabase.from('opi_initiatives').update({
      title: form.title.trim(),
      doc_url: form.doc_url || null,
      description: form.description || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setBusy(false)
    if (error) return flash(error.message, true)
    flash('Saved')
    setEditing(false)
    load()
  }

  async function resubmit() {
    setBusy(true)
    const { error } = await supabase.from('opi_initiatives').update({
      status: 'RESUBMITTED',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    await supabase.from('opi_comments').insert({
      initiative_id: id,
      user_id: user!.id,
      body: '[RESUBMITTED] Updated and resubmitted for review',
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
          <span className="text-[11px] font-mono text-ink-soft">Submitted {fmtDate(opi.created_at)}</span>
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
              {opi.doc_url && (
                <a href={opi.doc_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-accent hover:underline">
                  Open Google Doc ↗
                </a>
              )}
              {opi.description && <p className="text-sm whitespace-pre-wrap text-ink">{opi.description}</p>}
              <div className="flex gap-2 pt-2">
                {canEdit && (
                  <button onClick={() => setEditing(true)} className={btn}>Edit</button>
                )}
                {canResubmit && (
                  <>
                    <button onClick={() => setEditing(true)} className={btn}>Edit & resubmit</button>
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
                <input className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={label}>Google Doc link</label>
                <input className={input} value={form.doc_url} onChange={e => setForm({ ...form, doc_url: e.target.value })} />
              </div>
              <div>
                <label className={label}>Description</label>
                <textarea className={textarea} rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex gap-2">
                {canResubmit ? (
                  <>
                    <button onClick={async () => { await save(); await resubmit() }} disabled={busy} className={btn}>
                      {busy ? 'Saving…' : 'Save & resubmit'}
                    </button>
                    <button onClick={() => setEditing(false)} className="text-sm text-ink-soft hover:text-ink">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={save} disabled={busy} className={btn}>
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(false)} className="text-sm text-ink-soft hover:text-ink">Cancel</button>
                  </>
                )}
              </div>
            </div>
          )}
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
