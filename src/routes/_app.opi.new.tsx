import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, label, input, textarea, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/opi/new')({
  component: NewOpi,
})

function NewOpi() {
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState({ title: '', document_url: '', summary: '' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!f.title.trim()) return flash('Title required', true)
    setBusy(true)
    const { data, error } = await supabase.rpc('opi_action', {
      payload: {
        action: 'submit',
        title: f.title.trim(),
        summary: f.summary || null,
        document_url: f.document_url || null,
      },
    })
    setBusy(false)
    if (error) return flash('Submit failed: ' + error.message, true)
    flash('Initiative submitted')
    const id = (data as any)?.id
    if (id) navigate({ to: '/opi/$id', params: { id } })
    else navigate({ to: '/opi' })
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>New OPI submission</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className={label}>Title</label>
          <input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div>
          <label className={label}>Google Doc link</label>
          <input
            className={input}
            placeholder="https://docs.google.com/document/d/…"
            value={f.document_url}
            onChange={(e) => setF({ ...f, document_url: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>Summary</label>
          <textarea rows={5} className={textarea} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        </div>
        <button onClick={submit} disabled={busy} className={btn}>
          {busy ? 'Submitting…' : 'Submit initiative'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
