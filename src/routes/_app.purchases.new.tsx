import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, label, input, textarea, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/purchases/new')({
  component: NewPurchase,
})

function NewPurchase() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState({ kind: 'reimbursement', description: '', amount: '' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!f.description.trim()) return flash('Description required', true)
    const amount = parseFloat(f.amount)
    if (!amount || amount <= 0) return flash('Enter an amount', true)
    setBusy(true)

    let receipt_url: string | null = null
    if (file) {
      const path = `${user!.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file)
      if (upErr) {
        setBusy(false)
        return flash('Receipt upload failed: ' + upErr.message, true)
      }
      receipt_url = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
    }

    const { data, error } = await supabase
      .from('purchases')
      .insert({
        user_id: user!.id,
        kind: f.kind,
        description: f.description.trim(),
        amount,
        receipt_url,
        status: 'PENDING',
      })
      .select('id')
      .single()
    setBusy(false)
    if (error) return flash('Submit failed: ' + error.message, true)
    flash('Request submitted')
    navigate({ to: '/purchases/$id', params: { id: (data as { id: string }).id } })
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>New request</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Type</label>
            <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="reimbursement">Reimbursement</option>
              <option value="purchase">Purchase order</option>
            </select>
          </div>
          <div>
            <label className={label}>Amount (USD)</label>
            <input type="number" step="0.01" className={input} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea rows={3} className={textarea} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div>
          <label className={label}>Receipt (optional)</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <button onClick={submit} disabled={busy} className={btn}>
          {busy ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
