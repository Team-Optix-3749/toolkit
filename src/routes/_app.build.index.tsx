import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { nextOccurrences } from '~/lib/recurrence'
import { Badge } from '~/components/Badge'
import type { BuildSession, Zone, BuildCheckin } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/')({
  component: BuildHome,
})

function BuildHome() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [zones, setZones] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<BuildCheckin | null>(null)

  async function load() {
    const [{ data: s, error: e1 }, { data: z }, { data: ci }] = await Promise.all([
      supabase.from('build_schedule').select('*'),
      supabase.from('build_zones').select('id, name'),
      supabase
        .from('build_checkins')
        .select('*')
        .eq('user_id', user!.id)
        .is('checked_out_at', null)
        .order('checked_in_at', { ascending: false })
        .limit(1),
    ])
    if (e1) return flash('Load failed: ' + e1.message, true)
    setSessions((s as BuildSession[]) || [])
    setZones(Object.fromEntries(((z as Zone[]) || []).map((x) => [x.id, x.name])))
    setOpen(((ci as BuildCheckin[]) || [])[0] ?? null)
  }
  useEffect(() => {
    load()
  }, [])

  const upcoming = useMemo(() => {
    const out: { session: BuildSession; when: Date }[] = []
    for (const s of sessions) {
      for (const d of nextOccurrences(s.starts_at, s.rrule, 3)) out.push({ session: s, when: d })
    }
    return out.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 12)
  }, [sessions])

  return (
    <>
      {open && (
        <div className="bg-accent-soft border border-accent px-5 py-3 flex items-center gap-3">
          <span className="text-sm text-accent font-medium">
            You're checked in since {fmtDateTime(open.checked_in_at)}.
          </span>
          <Link to="/build/check-in" className={`${btnGhost} ml-auto border-accent text-accent`}>
            Check out
          </Link>
        </div>
      )}

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Upcoming build sessions</span>
          <Link to="/build/check-in" className={btn.replace('h-10', 'h-8') + ' px-4 text-xs'}>
            Check in
          </Link>
        </div>
        <div className="divide-y divide-line">
          {upcoming.map(({ session, when }, i) => (
            <div key={session.id + i} className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {session.title}
                  {session.short_notice && <Badge label="short notice" tone="PENDING" />}
                  {session.is_recurring && <Badge label="recurring" tone="accent" />}
                </div>
                <div className="text-sm text-ink-soft font-mono">
                  {fmtDateTime(when.toISOString())}
                  {session.zone_id ? ` · ${zones[session.zone_id] ?? 'zone'}` : ''}
                </div>
              </div>
              <Link
                to="/build/sessions/$id"
                params={{ id: session.id }}
                className="text-[11px] font-mono uppercase text-accent hover:underline"
              >
                Detail
              </Link>
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="px-5 py-6 text-center text-ink-soft text-sm">
              No upcoming sessions scheduled.
            </div>
          )}
        </div>
      </section>
      {Toast}
    </>
  )
}
