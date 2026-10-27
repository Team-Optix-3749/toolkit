import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useScoutEvents } from '~/lib/useScoutEvents'
import { Select } from '~/components/Select'
import { Badge } from '~/components/Badge'
import { fmtDate, fmtTime } from '~/lib/format'
import {
  matchLabel,
  teamAtStation,
  type MatchEntry,
  type ScoutAssignment,
  type ScoutMatch,
} from '~/lib/scouting'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/scouting/')({
  component: ScoutingHub,
})

function ScoutingHub() {
  const { user, profile, role } = useAuth()
  const { events, event, eventId, setEventId, loading } = useScoutEvents()
  const [matches, setMatches] = useState<ScoutMatch[]>([])
  const [mine, setMine] = useState<ScoutAssignment[]>([])
  const [myEntries, setMyEntries] = useState<MatchEntry[]>([])
  const [counts, setCounts] = useState({ match: 0, pit: 0, teams: 0 })
  const canManage = role === 'OFFICER' || role === 'OWNER' || !!profile?.permissions?.includes('manage_scouting')

  useEffect(() => {
    if (!eventId) return
    const uid = user!.id
    ;(async () => {
      const [{ data: m }, { data: a }, { data: e }, { count: pit }, { data: allTeams }] = await Promise.all([
        supabase.from('scout_matches').select('*').eq('event_id', eventId).order('match_type').order('match_number'),
        supabase.from('scout_assignments').select('*, scout_matches!inner(event_id)').eq('scout_id', uid).eq('scout_matches.event_id', eventId),
        supabase.from('match_scouting').select('*').eq('event_id', eventId).eq('scout_id', uid),
        supabase.from('pit_scouting').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('match_scouting').select('team_number').eq('event_id', eventId),
      ])
      setMatches((m as ScoutMatch[]) || [])
      setMine((a as ScoutAssignment[]) || [])
      setMyEntries((e as MatchEntry[]) || [])
      const teamRows = (allTeams as { team_number: number }[]) || []
      setCounts({ match: teamRows.length, pit: pit ?? 0, teams: new Set(teamRows.map((r) => r.team_number)).size })
    })()
  }, [eventId])

  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]))
  const done = (m: ScoutMatch, team: number | null) =>
    myEntries.some((e) => e.match_type === m.match_type && e.match_number === m.match_number && e.team_number === team)

  const queue = mine
    .map((a) => ({ a, m: matchById[a.match_id] }))
    .filter((x) => x.m)
    .sort((x, y) => (x.m.match_type === y.m.match_type ? x.m.match_number - y.m.match_number : x.m.match_type.localeCompare(y.m.match_type)))
  const pending = queue.filter(({ a, m }) => !done(m, teamAtStation(m, a.station)))

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Scouting</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {events.length > 0 && (
            <Select
              size="sm"
              value={eventId}
              onChange={setEventId}
              options={events.map((e) => ({ value: e.id, label: e.name + (e.is_active ? ' · active' : '') }))}
              className="min-w-[220px]"
            />
          )}
          {canManage && (
            <Link to="/scouting/manage" className={btnGhost}>
              Manage
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className={`${card} p-8 text-center text-sm text-ink-soft`}>Loading…</div>
      ) : !event ? (
        <section className={`${card} p-8 text-center space-y-3`}>
          <p className="text-sm text-ink-soft">No scouting events yet.</p>
          {canManage ? (
            <Link to="/scouting/manage" className={btn}>
              Create an event
            </Link>
          ) : (
            <p className="text-xs text-ink-soft">Leadership will set one up before the competition.</p>
          )}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Event" value={event.event_code || event.name} sub={event.starts_on ? fmtDate(event.starts_on) : undefined} />
            <Stat label="Match entries" value={String(counts.match)} />
            <Stat label="Teams seen" value={String(counts.teams)} />
            <Stat label="Pit reports" value={String(counts.pit)} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Link to="/scouting/match" search={{}} className={`${card} p-5 block hover:bg-white/[0.03]`}>
              <div className="text-sm font-semibold">Match scout</div>
              <div className="text-xs text-ink-soft mt-1">Log one robot for one match</div>
            </Link>
            <Link to="/scouting/pit" search={{}} className={`${card} p-5 block hover:bg-white/[0.03]`}>
              <div className="text-sm font-semibold">Pit scout</div>
              <div className="text-xs text-ink-soft mt-1">Robot specs and capabilities</div>
            </Link>
            <Link to="/scouting/teams" className={`${card} p-5 block hover:bg-white/[0.03]`}>
              <div className="text-sm font-semibold">Team data</div>
              <div className="text-xs text-ink-soft mt-1">Averages, rankings, CSV export</div>
            </Link>
          </div>

          <section className={card}>
            <div className={cardHead}>
              <span className={cardTitle}>My assignments</span>
              <span className="text-[11px] font-mono text-ink-soft">
                {queue.length - pending.length}/{queue.length} done
              </span>
            </div>
            <div className="divide-y divide-white/4">
              {queue.map(({ a, m }) => {
                const team = teamAtStation(m, a.station)
                const isDone = done(m, team)
                const red = a.station.startsWith('red')
                return (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.03]">
                    <span className="font-mono text-sm w-12">{matchLabel(m.match_type, m.match_number)}</span>
                    <span
                      className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                        red ? 'border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10' : 'border-[#2f80ed]/30 text-[#7fb2f5] bg-[#2f80ed]/10'
                      }`}
                    >
                      {a.station}
                    </span>
                    <span className="font-semibold">{team ?? '—'}</span>
                    {m.scheduled_at && <span className="text-xs text-ink-soft">{fmtTime(m.scheduled_at)}</span>}
                    <span className="ml-auto">
                      {isDone ? (
                        <Badge label="done" tone="completed" />
                      ) : team ? (
                        <Link
                          to="/scouting/match"
                          search={{ type: m.match_type, match: m.match_number, team, alliance: red ? 'red' : 'blue' }}
                          className={btnGhost}
                        >
                          Scout
                        </Link>
                      ) : null}
                    </span>
                  </div>
                )
              })}
              {queue.length === 0 && (
                <div className="px-5 py-6 text-center text-sm text-ink-soft">
                  No assigned matches. You can still scout any match from “Match scout”.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft">{label}</div>
      <div className="text-xl font-semibold mt-1 truncate">{value}</div>
      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
    </div>
  )
}
