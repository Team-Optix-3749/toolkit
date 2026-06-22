import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildSession, Zone } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/schedule/')({
  component: SchedulePage,
})

function SchedulePage() {
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [zones, setZones] = useState<Record<string, string>>({})

  async function load() {
    const [{ data: s, error: e1 }, { data: z }] = await Promise.all([
      supabase.from('build_schedule').select('*').order('starts_at', { ascending: false }),
      supabase.from('build_zones').select('id, name'),
    ])
    if (e1) return flash('Load failed: ' + e1.message, true)
    setSessions((s as BuildSession[]) || [])
    setZones(Object.fromEntries(((z as Zone[]) || []).map((x) => [x.id, x.name])))
  }
  useEffect(() => {
    load()
  }, [])

  async function del(id: string) {
    if (!confirm('Delete this session?')) return
    const { error } = await supabase.from('build_schedule').delete().eq('id', id)
    if (error) return flash(error.message, true)
    flash('Deleted')
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
                {s.is_recurring && <Badge label="recurring" tone="accent" />}
                {s.short_notice && <Badge label="short notice" tone="PENDING" />}
              </div>
              <div className="text-sm text-ink-soft font-mono">
                {fmtDateTime(s.starts_at)}
                {s.ends_at ? ` – ${fmtDateTime(s.ends_at)}` : ''}
                {s.zone_id ? ` · ${zones[s.zone_id] ?? 'zone'}` : ''}
              </div>
            </div>
            <button onClick={() => del(s.id)} className="text-ink-soft hover:text-[#c0392b] px-1" title="Delete">
              ✕
            </button>
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
