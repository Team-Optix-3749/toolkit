import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, label, input, textarea, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/opi/new')({
  component: NewOpi,
})

function NewOpi() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState({ title: '', doc_url: '', description: '' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!f.title.trim()) return flash('Title required', true)
    setBusy(true)
    const { data, error } = await supabase
      .from('opi_initiatives')
      .insert({
        user_id: user!.id,
        title: f.title.trim(),
        doc_url: f.doc_url || null,
        description: f.description || null,
        status: 'PENDING',
      })
      .select('id')
      .single()
    setBusy(false)
    if (error) return flash('Submit failed: ' + error.message, true)
    flash('Initiative submitted')
    navigate({ to: '/opi/$id', params: { id: (data as { id: string }).id } })
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
            value={f.doc_url}
            onChange={(e) => setF({ ...f, doc_url: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea rows={5} className={textarea} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <button onClick={submit} disabled={busy} className={btn}>
          {busy ? 'Submitting…' : 'Submit initiative'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
