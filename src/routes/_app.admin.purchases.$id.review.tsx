import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { Purchase } from '~/lib/types'
import { PrivateAttachment } from '~/components/PrivateAttachment'
import { card, cardHead, cardTitle } from '~/lib/ui'
import {ConfirmDialog} from '~/components/ConfirmDialog'

export const Route = createFileRoute('/_app/admin/purchases/$id/review')({
  component: PurchaseReview,
})

function PurchaseReview() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [p, setP] = useState<Purchase | null>(null)
  const [decision,setDecision]=useState<'APPROVED'|'REJECTED'|null>(null)

  async function load() {
    const { data, error } = await supabase.from('purchases').select('*').eq('id', id).maybeSingle()
    if (error) return flash(error.message, true)
    setP(data as Purchase)
  }
  useEffect(() => {
    load()
  }, [id])

  async function decide(status: 'APPROVED' | 'REJECTED') {
    const {error}=await supabase.rpc('purchase_action',{payload:{action:status==='APPROVED'?'approve':'reject',id}})
    if (error) return flash('Update failed: ' + error.message, true)
    flash(status === 'APPROVED' ? 'Approved' : 'Rejected')
    setDecision(null)
    load()
  }

  if (!p) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>


  return (
    <div className="grid md:grid-cols-2 gap-5">
      <ConfirmDialog open={!!decision} title={decision==='APPROVED'?'Approve purchase?':'Reject purchase?'} description="This commits an immutable decision. The server rechecks pending state and purchase-review authority." onCancel={()=>setDecision(null)} onConfirm={()=>{if(decision)void decide(decision)}}/>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Request</span>
          <Badge label={p.status} tone={p.status} />
        </div>
        <div className="p-5 space-y-2 text-sm">
          <Row k="Type" v={p.kind} />
          <Row k="Amount" v={`$${Number(p.amount).toFixed(2)}`} />
          <Row k="Submitted" v={fmtDateTime(p.created_at)} />
          <div className="pt-2">
            <div className="text-ink-soft mb-1">Description</div>
            <p className="whitespace-pre-wrap">{p.description}</p>
          </div>
          {p.status === 'PENDING' && (
            <div className="flex gap-2 pt-3">
              <button onClick={() => setDecision('APPROVED')} className="h-9 px-4 text-sm font-medium bg-accent text-[#06080b] rounded-lg hover:brightness-110 inline-flex items-center justify-center transition-all">
                Approve
              </button>
              <button onClick={() => setDecision('REJECTED')} className="h-9 px-4 text-sm font-medium border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10 rounded-lg hover:bg-[#c0392b]/20 inline-flex items-center justify-center transition-all">
                Reject
              </button>
            </div>
          )}
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Receipt</span>
        </div>
        <div className="p-5">
          {p.receipt_url ? <PrivateAttachment bucket="receipts" reference={p.receipt_url} label="Receipt" /> : <p className="text-sm text-ink-soft">No receipt attached.</p>}
        </div>
      </section>
      {Toast}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{k}</span>
      <span className="font-mono text-right capitalize">{v}</span>
    </div>
  )
}
