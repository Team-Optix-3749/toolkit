import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { Purchase } from '~/lib/types'
import { card, cardHead, cardTitle, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/purchases/')({
  component: PurchasesList,
})

function PurchasesList() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Purchase[]>([])

  async function load() {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as Purchase[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>My purchases & reimbursements</span>
        <Link to="/purchases/new" className={btn.replace('h-10', 'h-8') + ' px-4 text-xs'}>
          New request
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            {['Date', 'Type', 'Description', 'Amount', 'Status'].map((h) => (
              <th key={h} className={`py-2 px-5 font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line ${h === 'Amount' ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line hover:bg-canvas">
              <td className="py-2 px-5 font-mono text-ink-soft">{fmtDate(r.created_at)}</td>
              <td className="py-2 px-5 capitalize">{r.kind}</td>
              <td className="py-2 px-5">
                <Link to="/purchases/$id" params={{ id: r.id }} className="hover:underline">
                  {r.description}
                </Link>
              </td>
              <td className="py-2 px-5 text-right font-mono tabular-nums">${Number(r.amount).toFixed(2)}</td>
              <td className="py-2 px-5"><Badge label={r.status} tone={r.status} /></td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-ink-soft text-sm">
                No requests yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {Toast}
    </section>
  )
}
