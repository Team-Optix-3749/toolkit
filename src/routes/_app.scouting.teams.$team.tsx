import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { AutoPathField, mirrorToRed } from '~/components/AutoPathField'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { can } from '~/lib/rbac'
import { useToast } from '~/lib/toast'
import { useScoutEvents } from '~/lib/useScoutEvents'
import { fmtDateTime } from '~/lib/format'
import {
  MATCH_SECTIONS,
  PIT_SECTIONS,
  isPath,
  matchLabel,
  one,
  pct,
  teamStats,
  type AutoPath,
  type Field,
  type MatchEntry,
  type PitEntry,
  type ScoutData,
} from '~/lib/scouting'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/scouting/teams/$team')({
  component: TeamDetail,
})

const fmtValue = (f: Field, v: ScoutData[string]): ReactNode => {
  if (v == null || v === '') return '—'
  if (f.kind === 'path') return isPath(v) ? <AutoPathField value={v} className="w-28" /> : '—'
  if (f.kind === 'toggle') return v ? 'Yes' : 'No'
  if (f.kind === 'choice') return f.options.find(([k]) => k === v)?.[1] ?? String(v)
  if (f.kind === 'number' && f.suffix) return `${v} ${f.suffix}`
  if (f.kind === 'rating') return v ? `${v}/${f.max}` : '—'
  return String(v)
}

function TeamDetail() {
  const { team } = Route.useParams()
  const teamNumber = Number(team)
  const { user, profile } = useAuth()
  const { flash, Toast } = useToast()
  const { event, eventId, loading } = useScoutEvents()
  const [entries, setEntries] = useState<MatchEntry[]>([])
  const [pits, setPits] = useState<PitEntry[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const canManage = can(profile, 'manage_scouting')

  async function load() {
    if (!eventId) return
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('match_scouting').select('*').eq('event_id', eventId).eq('team_number', teamNumber).order('match_number'),
      supabase.from('pit_scouting').select('*').eq('event_id', eventId).eq('team_number', teamNumber).order('updated_at', { ascending: false }),
    ])
    const ms = (m as MatchEntry[]) || []
    const ps = (p as PitEntry[]) || []
    setEntries(ms)
    setPits(ps)
    const ids = [...new Set([...ms, ...ps].map((r) => r.scout_id))]
    if (ids.length) {
      const { data: pr } = await supabase.from('profiles').select('id, display_name').in('id', ids)
      setNames(Object.fromEntries(((pr as { id: string; display_name: string | null }[]) || []).map((x) => [x.id, x.display_name ?? ''])))
    }
  }

  useEffect(() => {
    load()
  }, [eventId, teamNumber])

  async function remove(id: string) {
    if (!confirm('Delete this match entry? This cannot be undone.')) return
    const { error } = await supabase.from('match_scouting').delete().eq('id', id)
    if (error) return flash('Delete failed: ' + error.message, true)
    flash('Entry deleted')
    load()
  }

  if (loading) return <div className={`${card} p-8 text-center text-sm text-ink-soft`}>Loading…</div>

  const s = teamStats(teamNumber, entries)
  // Prefix with the section so "Pieces scored" (auto) and (teleop) are distinguishable.
  const matchFields = MATCH_SECTIONS.flatMap((sec) =>
    sec.fields.map((f) => ({ ...f, header: sec.fields.length > 1 && sec.title !== 'Performance' ? `${sec.title} · ${f.label}` : f.label })),
  )

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/scouting/teams" className="text-[11px] font-mono uppercase text-ink-soft hover:text-ink">
            ← Team data
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Team {teamNumber}</h1>
          <p className="text-xs text-ink-soft">{event?.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/scouting/pit" search={{ team: teamNumber }} className={btnGhost}>
            Pit scout
          </Link>
          <Link to="/scouting/match" search={{ team: teamNumber }} className={btnGhost}>
            Match scout
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ['Matches', String(s.matches)],
            ['Avg scored', one(s.totalScored)],
            ['Auto / Teleop', `${one(s.autoScored)} / ${one(s.teleScored)}`],
            ['Accuracy', pct(s.accuracy)],
            ['Climb rate', pct(s.climbRate)],
            ['Left zone', pct(s.leaveRate)],
            ['Driver / Defense', `${one(s.driver)} / ${one(s.defense)}`],
            ['Died', String(s.diedCount)],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className={`${card} p-4`}>
            <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft">{l}</div>
            <div className="text-lg font-semibold mt-1 font-mono tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <AutoPaths entries={entries} pits={pits} />

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Pit reports</span>
        </div>
        {pits.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-ink-soft">Not pit-scouted yet.</div>
        ) : (
          <div className="divide-y divide-white/4">
            {pits.map((p) => (
              <div key={p.id} className="px-5 py-4 space-y-3">
                <div className="text-xs text-ink-soft">
                  {names[p.scout_id] || 'Scout'} · {fmtDateTime(p.updated_at)}
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                  {PIT_SECTIONS.flatMap((sec) => sec.fields).map((f) => (
                    <div key={f.key}>
                      <dt className="text-[11px] font-mono uppercase text-ink-soft">{f.label}</dt>
                      <dd>{fmtValue(f, p.data[f.key])}</dd>
                    </div>
                  ))}
                </dl>
                {p.notes && <p className="text-sm whitespace-pre-wrap text-ink-soft">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Match entries</span>
        </div>
        {entries.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-ink-soft">No match data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6 text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft">
                  <th scope="col" className="px-3 py-2 text-left">Match</th>
                  {matchFields.map((f) => (
                    <th key={f.key} scope="col" className="px-3 py-2 text-left whitespace-nowrap">{f.header}</th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-left">Scout</th>
                  <th scope="col" className="px-3 py-2 text-left">Notes</th>
                  <th scope="col" className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.03] align-top">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      <span className={e.alliance === 'red' ? 'text-[#f07070]' : e.alliance === 'blue' ? 'text-[#7fb2f5]' : ''}>
                        {matchLabel(e.match_type, e.match_number)}
                      </span>
                    </td>
                    {matchFields.map((f) => (
                      <td key={f.key} className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">{fmtValue(f, e.data[f.key])}</td>
                    ))}
                    <td className="px-3 py-2 whitespace-nowrap text-ink-soft">{names[e.scout_id] || '—'}</td>
                    <td className="px-3 py-2 min-w-[200px] text-ink-soft">{e.notes || ''}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(e.scout_id === user!.id || canManage) && (
                        <div className="flex gap-1">
                          {e.scout_id === user!.id && (
                            <Link
                              to="/scouting/match"
                              search={{ type: e.match_type, match: e.match_number, team: e.team_number, alliance: e.alliance ?? undefined }}
                              className={btnGhost}
                            >
                              Edit
                            </Link>
                          )}
                          <button onClick={() => remove(e.id)} className={`${btnGhost} text-[#f07070]`}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {Toast}
    </>
  )
}

/**
 * Every scouted auto for this team on one field. Blue-alliance paths are moved
 * to the red side so repeated routines stack up; tap a match to highlight it.
 */
function AutoPaths({ entries, pits }: { entries: MatchEntry[]; pits: PitEntry[] }) {
  const [focus, setFocus] = useState<string | null>(null)
  const runs = entries
    .filter((e) => isPath(e.data.auto_path))
    .map((e) => ({ id: e.id, label: matchLabel(e.match_type, e.match_number), path: mirrorToRed(e.data.auto_path as AutoPath, e.alliance) }))
  const planned = pits.map((p) => p.data.planned_auto).filter(isPath)
  if (!runs.length && !planned.length) return null

  const focused = runs.find((r) => r.id === focus)
  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Auto paths</span>
        <span className="text-[11px] text-ink-soft">Shown from the red side · ○ start · ● end</span>
      </div>
      <div className={`p-4 sm:p-5 grid gap-4 ${planned.length ? 'lg:grid-cols-[2fr_1fr]' : ''}`}>
        <div>
          <AutoPathField
            overlay={runs.filter((r) => r.id !== focus).map((r) => ({ path: r.path }))}
            value={focused?.path ?? null}
          />
          {runs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {runs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={focus === r.id}
                  onClick={() => setFocus(focus === r.id ? null : r.id)}
                  className={`${btnGhost} ${focus === r.id ? 'bg-accent/15 border-accent/40 text-accent' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {planned.length > 0 && (
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft mb-2">Planned (pit)</div>
            <div className="space-y-2">
              {planned.map((p, i) => (
                <AutoPathField key={i} value={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
