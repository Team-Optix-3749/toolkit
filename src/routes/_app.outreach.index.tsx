import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { OutreachEvent, OutreachCheckin } from '~/lib/types'
import { card, cardHead, cardTitle, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/')({
  component: OutreachHome,
})

function OutreachHome() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [events, setEvents] = useState<OutreachEvent[]>([])
  const [mine, setMine] = useState<Set<string>>(new Set())

  async function load() {
    const [{ data: e, error }, { data: ci }] = await Promise.all([
      supabase.from('outreach_events').select('*').order('starts_at', { ascending: true }),
      supabase.from('outreach_checkins').select('event_id').eq('user_id', user!.id),
    ])
    if (error) return flash('Load failed: ' + error.message, true)
    setEvents((e as OutreachEvent[]) || [])
    setMine(new Set(((ci as { event_id: string }[]) || []).map((x) => x.event_id)))
  }
  useEffect(() => {
    load()
  }, [])

  const now = Date.now()
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.ends_at || e.starts_at).getTime() >= now),
    [events, now],
  )

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Upcoming outreach</span>
        <Link to="/outreach/check-in" className={btn.replace('h-10', 'h-8') + ' px-4 text-xs'}>
          Check in
        </Link>
      </div>
      <div className="divide-y divide-line">
        {upcoming.map((e) => (
          <div key={e.id} className="px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {e.title}
                {mine.has(e.id) && <Badge label="checked in" tone="APPROVED" />}
              </div>
              <div className="text-sm text-ink-soft font-mono">
                {fmtDateTime(e.starts_at)}
                {e.location ? ` · ${e.location}` : ''}
              </div>
            </div>
            <Link to="/outreach/events/$id" params={{ id: e.id }} className="text-[11px] font-mono uppercase text-accent hover:underline">
              Detail
            </Link>
          </div>
        ))}
        {upcoming.length === 0 && (
          <div className="px-5 py-6 text-center text-ink-soft text-sm">No upcoming outreach events.</div>
        )}
      </div>
      {Toast}
    </section>
  )
}
