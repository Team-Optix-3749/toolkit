import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import type { OutreachEvent } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/events/')({
  component: EventsAdmin,
})

function EventsAdmin() {
  const { flash, Toast } = useToast()
  const [events, setEvents] = useState<OutreachEvent[]>([])

  async function load() {
    const { data, error } = await supabase.from('outreach_events').select('*').order('starts_at', { ascending: false })
    if (error) return flash('Load failed: ' + error.message, true)
    setEvents((data as OutreachEvent[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function del(id: string) {
    if (!confirm('Delete this event?')) return
    const { error } = await supabase.from('outreach_events').delete().eq('id', id)
    if (error) return flash(error.message, true)
    flash('Deleted')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Outreach events ({events.length})</span>
        <div className="flex items-center gap-3">
          <Link to="/admin/outreach/individual" className="text-[11px] font-mono uppercase text-accent hover:underline">
            Review individual hours
          </Link>
          <Link to="/admin/outreach/events/new" className={btnGhost}>
            New event
          </Link>
        </div>
      </div>
      <div className="divide-y divide-line">
        {events.map((e) => (
          <div key={e.id} className="px-5 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{e.title}</div>
              <div className="text-sm text-ink-soft font-mono">
                {fmtDateTime(e.starts_at)}
                {e.location ? ` · ${e.location}` : ''}
                {e.qr_token ? ` · QR ${e.qr_token.slice(0, 8)}…` : ''}
              </div>
            </div>
            <button onClick={() => del(e.id)} className="text-ink-soft hover:text-[#c0392b] px-1" title="Delete">
              ✕
            </button>
          </div>
        ))}
        {events.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No events yet.</div>}
      </div>
      {Toast}
    </section>
  )
}
