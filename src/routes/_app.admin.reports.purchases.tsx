import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { downloadCsv } from '~/lib/csv'
import type { Purchase, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/reports/purchases')({
  component: PurchasesReport,
})

function PurchasesReport() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Purchase[]>([])
  const [names, setNames] = useState<Record<string, string>>({})

  async function load() {
    const { data, error } = await supabase.from('purchases').select('*')
    if (error) return flash('Load failed: ' + error.message, true)
    const list = (data as Purchase[]) || []
    setRows(list)
    const ids = [...new Set(list.map((r) => r.user_id))]
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
      setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '—'])))
    }
  }
  useEffect(() => {
    load()
  }, [])

  const sums = useMemo(() => {
    const by = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>
    for (const r of rows) by[r.status] = (by[r.status] || 0) + Number(r.amount)
    return by
  }, [rows])

  const byMember = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) if (r.status === 'APPROVED') m[r.user_id] = (m[r.user_id] || 0) + Number(r.amount)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Spending summary</span>
          <button
            onClick={() =>
              downloadCsv(
                'purchases-report.csv',
                rows.map((r) => ({
                  member: names[r.user_id] ?? r.user_id,
                  kind: r.kind,
                  amount: r.amount,
                  status: r.status,
                  description: r.description,
                })),
              )
            }
            className={btnGhost}
          >
            Export CSV
          </button>
        </div>
        <div className="grid grid-cols-3 gap-px bg-line border-b border-line">
          {(['APPROVED', 'PENDING', 'REJECTED'] as const).map((s) => (
            <div key={s} className="bg-panel px-4 py-4">
              <div className="font-mono text-2xl tabular-nums">${sums[s].toFixed(2)}</div>
              <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{s}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Approved spend by member</span>
        </div>
        <div className="divide-y divide-line">
          {byMember.map(([uid, amt]) => (
            <div key={uid} className="px-5 py-2.5 flex justify-between text-sm">
              <span>{names[uid] || uid.slice(0, 8)}</span>
              <span className="font-mono tabular-nums">${amt.toFixed(2)}</span>
            </div>
          ))}
          {byMember.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No approved spend.</div>}
        </div>
      </section>
      {Toast}
    </>
  )
}
