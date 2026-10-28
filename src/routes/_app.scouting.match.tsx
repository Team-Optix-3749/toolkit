import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { useScoutEvents } from '~/lib/useScoutEvents'
import { ScoutFields } from '~/components/ScoutFields'
import {
  MATCH_SECTIONS,
  MATCH_TYPE_LABEL,
  emptyData,
  matchLabel,
  type MatchEntry,
  type ScoutData,
  type ScoutMatch,
} from '~/lib/scouting'
import { card, cardHead, cardTitle, btn, btnGhost, input, label, textarea } from '~/lib/ui'

type Search = { type?: string; match?: number; team?: number; alliance?: 'red' | 'blue' }

export const Route = createFileRoute('/_app/scouting/match')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    type: typeof s.type === 'string' ? s.type : undefined,
    match: Number(s.match) > 0 ? Number(s.match) : undefined,
    team: Number(s.team) > 0 ? Number(s.team) : undefined,
    alliance: s.alliance === 'red' || s.alliance === 'blue' ? s.alliance : undefined,
  }),
  component: MatchScout,
})

function MatchScout() {
  const search = Route.useSearch()
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const { event, eventId, loading } = useScoutEvents()

  const [matchType, setMatchType] = useState(search.type ?? 'qm')
  const [matchNumber, setMatchNumber] = useState(search.match ? String(search.match) : '')
  const [team, setTeam] = useState(search.team ? String(search.team) : '')
  const [alliance, setAlliance] = useState<'red' | 'blue' | ''>(search.alliance ?? '')
  const [data, setData] = useState<ScoutData>(() => emptyData(MATCH_SECTIONS))
  const [notes, setNotes] = useState('')
  const [schedule, setSchedule] = useState<ScoutMatch | null>(null)
  const [existing, setExisting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Look up the scheduled match so scouts can tap a team instead of typing.
  useEffect(() => {
    const n = Number(matchNumber)
    if (!eventId || !n) return setSchedule(null)
    supabase
      .from('scout_matches')
      .select('*')
      .eq('event_id', eventId)
      .eq('match_type', matchType)
      .eq('match_number', n)
      .maybeSingle()
      .then(({ data }) => setSchedule((data as ScoutMatch) ?? null))
  }, [eventId, matchType, matchNumber])

  // Reopen this scout's previous entry for the same robot+match instead of duplicating.
  useEffect(() => {
    const n = Number(matchNumber)
    const t = Number(team)
    if (!eventId || !n || !t) return setExisting(null)
    supabase
      .from('match_scouting')
      .select('*')
      .eq('event_id', eventId)
      .eq('match_type', matchType)
      .eq('match_number', n)
      .eq('team_number', t)
      .eq('scout_id', user!.id)
      .maybeSingle()
      .then(({ data: row }) => {
        const e = row as MatchEntry | null
        setExisting(e?.id ?? null)
        if (e) {
          setData({ ...emptyData(MATCH_SECTIONS), ...e.data })
          setNotes(e.notes ?? '')
          if (e.alliance) setAlliance(e.alliance)
        }
      })
  }, [eventId, matchType, matchNumber, team])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const n = Number(matchNumber)
    const t = Number(team)
    if (!eventId) return flash('No scouting event selected', true)
    if (!n) return flash('Enter the match number', true)
    if (!t) return flash('Enter the team number', true)
    setBusy(true)
    const { error } = await supabase.from('match_scouting').upsert(
      {
        event_id: eventId,
        match_type: matchType,
        match_number: n,
        team_number: t,
        alliance: alliance || null,
        scout_id: user!.id,
        data,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,match_type,match_number,team_number,scout_id' },
    )
    setBusy(false)
    if (error) return flash('Save failed: ' + error.message, true)
    flash(`${existing ? 'Updated' : 'Saved'} ${t} in ${matchLabel(matchType, n)}`)
    // Ready for the next match: keep alliance/type, advance the match number.
    setMatchNumber(String(n + 1))
    setTeam('')
    setData(emptyData(MATCH_SECTIONS))
    setNotes('')
    setExisting(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className={`${card} p-8 text-center text-sm text-ink-soft`}>Loading…</div>
  if (!event)
    return (
      <div className={`${card} p-8 text-center text-sm text-ink-soft`}>
        No scouting event yet. <Link to="/scouting" className="text-accent hover:underline">Back to scouting</Link>
      </div>
    )

  const teamButtons = schedule
    ? ([
        ...schedule.red.map((t) => [t, 'red'] as const),
        ...schedule.blue.map((t) => [t, 'blue'] as const),
      ] as const)
    : []

  return (
    <form onSubmit={submit} className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link to="/scouting" className="text-[11px] font-mono uppercase text-ink-soft hover:text-ink">
            ← Scouting
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Match scout</h1>
          <p className="text-xs text-ink-soft">{event.name}</p>
        </div>
        {existing && <span className="text-[11px] font-mono uppercase text-accent">Editing your earlier entry</span>}
      </div>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Match</span>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(MATCH_TYPE_LABEL).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMatchType(v)}
                className={`${btnGhost} ${matchType === v ? 'bg-accent/15 border-accent/40 text-accent' : ''}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={label}>Match #</span>
              <input
                className={input}
                inputMode="numeric"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value.replace(/\D/g, ''))}
                required
              />
            </label>
            <label className="block">
              <span className={label}>Team #</span>
              <input
                className={input}
                inputMode="numeric"
                value={team}
                onChange={(e) => setTeam(e.target.value.replace(/\D/g, ''))}
                required
              />
            </label>
          </div>

          {teamButtons.length > 0 && (
            <div>
              <span className={label}>Scheduled robots</span>
              <div className="grid grid-cols-3 gap-2">
                {teamButtons.map(([t, side], i) => (
                  <button
                    key={`${side}-${i}`}
                    type="button"
                    onClick={() => {
                      setTeam(String(t))
                      setAlliance(side)
                    }}
                    className={`h-11 rounded-lg border font-mono text-sm transition-all active:scale-95 ${
                      side === 'red'
                        ? 'border-[#c0392b]/30 bg-[#c0392b]/10 text-[#f07070]'
                        : 'border-[#2f80ed]/30 bg-[#2f80ed]/10 text-[#7fb2f5]'
                    } ${String(t) === team ? 'ring-2 ring-accent' : ''}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {(['red', 'blue'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAlliance(a)}
                aria-pressed={alliance === a}
                className={`flex-1 h-11 rounded-lg border text-sm font-medium capitalize transition-all ${
                  alliance === a
                    ? a === 'red'
                      ? 'bg-[#c0392b]/20 border-[#c0392b]/50 text-[#f07070]'
                      : 'bg-[#2f80ed]/20 border-[#2f80ed]/50 text-[#7fb2f5]'
                    : 'bg-white/5 border-white/10 text-ink-soft'
                }`}
              >
                {a} alliance
              </button>
            ))}
          </div>
        </div>
      </section>

      <ScoutFields sections={MATCH_SECTIONS} data={data} onChange={setData} alliance={alliance} />

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Notes</span>
        </div>
        <div className="p-4 sm:p-5">
          <textarea
            className={textarea}
            rows={3}
            placeholder="Strategy, strengths, problems you saw…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </section>

      <button disabled={busy} className={`${btn} w-full h-12 text-base`}>
        {busy ? 'Saving…' : existing ? 'Update entry' : 'Submit entry'}
      </button>
      {Toast}
    </form>
  )
}
