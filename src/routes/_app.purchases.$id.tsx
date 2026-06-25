import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { Purchase } from '~/lib/types'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/purchases/$id')({
  component: PurchaseDetail,
})

function PurchaseDetail() {
  const { id } = Route.useParams()
  const { flash, Toast } = useToast()
  const [p, setP] = useState<Purchase | null>(null)

  useEffect(() => {
    supabase
      .from('purchases')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) flash(error.message, true)
        setP(data as Purchase)
      })
  }, [id])

  if (!p) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Request detail</span>
        <Badge label={p.status} tone={p.status} />
      </div>
      <div className="p-5 space-y-2 text-sm">
        <Row k="Type" v={p.kind} />
        <Row k="Amount" v={`$${Number(p.amount).toFixed(2)}`} />
        <Row k="Submitted" v={fmtDateTime(p.created_at)} />
        <Row k="Decided" v={p.decided_at ? fmtDateTime(p.decided_at) : '-'} />
        <div className="pt-2">
          <div className="text-ink-soft mb-1">Description</div>
          <p className="whitespace-pre-wrap">{p.description}</p>
        </div>
        {p.receipt_url && (
          <a href={p.receipt_url} target="_blank" rel="noreferrer" className="inline-block text-accent hover:underline pt-2">
            View receipt ↗
          </a>
        )}
      </div>
      {Toast}
    </section>
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
