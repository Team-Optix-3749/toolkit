import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useScoutEvents } from '~/lib/useScoutEvents'
import { downloadCsv } from '~/lib/csv'
import { Select } from '~/components/Select'
import { MATCH_SECTIONS, one, pct, teamStats, type MatchEntry, type TeamStats } from '~/lib/scouting'
import { card, cardHead, cardTitle, btnGhost, input } from '~/lib/ui'

export const Route = createFileRoute('/_app/scouting/teams/')({
  component: TeamsTable,
})

type SortKey = keyof Omit<TeamStats, 'team'> | 'team'

const COLS: [SortKey, string, (s: TeamStats) => string][] = [
  ['team', 'Team', (s) => String(s.team)],
  ['matches', 'Matches', (s) => String(s.matches)],
  ['totalScored', 'Avg scored', (s) => one(s.totalScored)],
  ['autoScored', 'Auto', (s) => one(s.autoScored)],
  ['teleScored', 'Teleop', (s) => one(s.teleScored)],
  ['accuracy', 'Accuracy', (s) => pct(s.accuracy)],
  ['climbRate', 'Climb', (s) => pct(s.climbRate)],
  ['driver', 'Driver', (s) => one(s.driver)],
  ['defense', 'Defense', (s) => one(s.defense)],
  ['diedCount', 'Died', (s) => String(s.diedCount)],
]

function TeamsTable() {
  const { events, event, eventId, setEventId, loading } = useScoutEvents()
  const [entries, setEntries] = useState<MatchEntry[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<SortKey>('totalScored')
  const [asc, setAsc] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!eventId) return
    supabase
      .from('match_scouting')
      .select('*')
      .eq('event_id', eventId)
      .then(async ({ data }) => {
        const rows = (data as MatchEntry[]) || []
        setEntries(rows)
        const ids = [...new Set(rows.map((r) => r.scout_id))]
        if (ids.length) {
          const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
          setNames(Object.fromEntries(((p as { id: string; display_name: string | null }[]) || []).map((x) => [x.id, x.display_name ?? ''])))
        }
      })
  }, [eventId])

  const stats = useMemo(() => {
    const teams = [...new Set(entries.map((e) => e.team_number))]
    return teams.map((t) => teamStats(t, entries))
  }, [entries])

  const rows = stats
    .filter((s) => !q || String(s.team).includes(q))
    .sort((a, b) => {
      const av = a[sort] ?? -1
      const bv = b[sort] ?? -1
      return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1)
    })

  function clickSort(k: SortKey) {
    if (k === sort) setAsc(!asc)
    else {
      setSort(k)
      setAsc(k === 'team')
    }
  }

  function exportRaw() {
    const keys = MATCH_SECTIONS.flatMap((s) => s.fields.map((f) => f.key))
    downloadCsv(
      `scouting-${event?.event_code || event?.name || 'event'}.csv`,
      entries
        .slice()
        .sort((a, b) => a.match_number - b.match_number || a.team_number - b.team_number)
        .map((e) => ({
          match_type: e.match_type,
          match: e.match_number,
          team: e.team_number,
          alliance: e.alliance ?? '',
          scout: names[e.scout_id] ?? e.scout_id,
          ...Object.fromEntries(keys.map((k) => [k, e.data[k] ?? ''])),
          notes: e.notes ?? '',
          submitted: e.updated_at,
        })),
    )
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/scouting" className="text-[11px] font-mono uppercase text-ink-soft hover:text-ink">
            ← Scouting
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Team data</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {events.length > 0 && (
            <Select
              size="sm"
              value={eventId}
              onChange={setEventId}
              options={events.map((e) => ({ value: e.id, label: e.name }))}
              className="min-w-[200px]"
            />
          )}
          <button onClick={exportRaw} disabled={!entries.length} className={btnGhost}>
            Export CSV
          </button>
        </div>
      </div>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>
            {rows.length} team{rows.length === 1 ? '' : 's'} · {entries.length} entries
          </span>
          <input
            className={`${input} max-w-[160px] h-8`}
            placeholder="Find team…"
            inputMode="numeric"
            value={q}
            onChange={(e) => setQ(e.target.value.replace(/\D/g, ''))}
            aria-label="Filter by team number"
          />
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-soft">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-soft">No match data yet for this event.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  {COLS.map(([k, l]) => (
                    <th key={k} scope="col" className="px-3 py-2 text-left whitespace-nowrap">
                      <button
                        onClick={() => clickSort(k)}
                        className={`text-[11px] font-mono uppercase tracking-[0.08em] ${sort === k ? 'text-accent' : 'text-ink-soft hover:text-ink'}`}
                      >
                        {l}
                        {sort === k ? (asc ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {rows.map((s) => (
                  <tr key={s.team} className="hover:bg-white/[0.03]">
                    {COLS.map(([k, , fmt]) => (
                      <td key={k} className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {k === 'team' ? (
                          <Link to="/scouting/teams/$team" params={{ team: String(s.team) }} className="text-accent hover:underline font-semibold">
                            {fmt(s)}
                          </Link>
                        ) : (
                          fmt(s)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
