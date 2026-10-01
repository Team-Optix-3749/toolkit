import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildSession, BuildLocation } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/schedule/')({
  component: SchedulePage,
})

function SchedulePage() {
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [locations, setLocations] = useState<Record<string, string>>({})

  async function load() {
    const [{ data: s, error: e1 }, { data: loc }] = await Promise.all([
      supabase.from('build_sessions').select('*').order('opens_at', { ascending: false }),
      supabase.from('build_locations').select('id, name'),
    ])
    if (e1) return flash('Load failed: ' + e1.message, true)
    setSessions((s as BuildSession[]) || [])
    setLocations(Object.fromEntries(((loc as BuildLocation[]) || []).map((x) => [x.id, x.name])))
  }
  useEffect(() => {
    load()
  }, [])

  async function cancel(id: string) {
    const { error } = await supabase.rpc('build_action', {
      payload: { action: 'cancel', id },
    })
    if (error) return flash(error.message, true)
    flash('Cancelled')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Build schedule ({sessions.length})</span>
        <Link to="/admin/build/schedule/new" className={btnGhost}>
          New session
        </Link>
      </div>
      <div className="divide-y divide-line">
        {sessions.map((s) => (
          <div key={s.id} className="px-5 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {s.title}
                {s.cancelled && <Badge label="cancelled" tone="REJECTED" />}
              </div>
              <div className="text-sm text-ink-soft font-mono">
                {fmtDateTime(s.opens_at)}
                {s.closes_at ? ` – ${fmtDateTime(s.closes_at)}` : ''}
                {s.location_id ? ` · ${locations[s.location_id] ?? 'location'}` : ''}
              </div>
            </div>
            {!s.cancelled && (
              <button onClick={() => cancel(s.id)} className="text-ink-soft hover:text-[#c0392b] px-1" title="Cancel">
                ✕
              </button>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="px-5 py-6 text-center text-ink-soft text-sm">No sessions scheduled.</div>
        )}
      </div>
      {Toast}
    </section>
  )
}
