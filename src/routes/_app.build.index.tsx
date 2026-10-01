import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { BuildSession, BuildLocation, BuildRecord } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/')({
  component: BuildHome,
})

function BuildHome() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [locations, setLocations] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<BuildRecord | null>(null)

  async function load() {
    const [{ data: s, error: e1 }, { data: loc }, { data: ci }] = await Promise.all([
      supabase.from('build_sessions').select('*').eq('cancelled', false).order('opens_at', { ascending: true }),
      supabase.from('build_locations').select('id, name'),
      supabase
        .from('build_records')
        .select('*')
        .eq('member_id', user!.id)
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1),
    ])
    if (e1) return flash('Load failed: ' + e1.message, true)
    setSessions((s as BuildSession[]) || [])
    setLocations(Object.fromEntries(((loc as BuildLocation[]) || []).map((x) => [x.id, x.name])))
    setOpen(((ci as BuildRecord[]) || [])[0] ?? null)
  }
  useEffect(() => {
    load()
  }, [])

  const upcoming = sessions
    .filter((s) => new Date(s.opens_at) >= new Date() || (s.closes_at && new Date(s.closes_at) >= new Date()))
    .slice(0, 12)

  return (
    <>
      {open && (
        <div className="bg-accent-soft border border-accent px-5 py-3 flex items-center gap-3">
          <span className="text-sm text-accent font-medium">
            You're checked in since {fmtDateTime(open.check_in)}.
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
          {upcoming.map((session) => (
            <div key={session.id} className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{session.title}</div>
                <div className="text-sm text-ink-soft font-mono">
                  {fmtDateTime(session.opens_at)}
                  {session.closes_at ? ` – ${fmtDateTime(session.closes_at)}` : ''}
                  {session.location_id ? ` · ${locations[session.location_id] ?? 'location'}` : ''}
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
            <div className="px-5 py-6 text-center text-ink-soft text-sm">No upcoming sessions scheduled.</div>
          )}
        </div>
      </section>
      {Toast}
    </>
  )
}
