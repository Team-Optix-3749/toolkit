import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { useScoutEvents } from '~/lib/useScoutEvents'
import { ScoutFields } from '~/components/ScoutFields'
import { PIT_SECTIONS, emptyData, type PitEntry, type ScoutData } from '~/lib/scouting'
import { card, cardHead, cardTitle, btn, input, label, textarea } from '~/lib/ui'

export const Route = createFileRoute('/_app/scouting/pit')({
  validateSearch: (s: Record<string, unknown>): { team?: number } => ({
    team: Number(s.team) > 0 ? Number(s.team) : undefined,
  }),
  component: PitScout,
})

function PitScout() {
  const search = Route.useSearch()
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const { event, eventId, loading } = useScoutEvents()
  const [team, setTeam] = useState(search.team ? String(search.team) : '')
  const [data, setData] = useState<ScoutData>(() => emptyData(PIT_SECTIONS))
  const [notes, setNotes] = useState('')
  const [existing, setExisting] = useState<string | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!eventId) return
    supabase
      .from('pit_scouting')
      .select('team_number')
      .eq('event_id', eventId)
      .then(({ data: rows }) => setDone(new Set(((rows as { team_number: number }[]) || []).map((r) => r.team_number))))
  }, [eventId, existing])

  useEffect(() => {
    const t = Number(team)
    if (!eventId || !t) return setExisting(null)
    supabase
      .from('pit_scouting')
      .select('*')
      .eq('event_id', eventId)
      .eq('team_number', t)
      .eq('scout_id', user!.id)
      .maybeSingle()
      .then(({ data: row }) => {
        const e = row as PitEntry | null
        setExisting(e?.id ?? null)
        setData(e ? { ...emptyData(PIT_SECTIONS), ...e.data } : emptyData(PIT_SECTIONS))
        setNotes(e?.notes ?? '')
      })
  }, [eventId, team])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const t = Number(team)
    if (!eventId) return flash('No scouting event selected', true)
    if (!t) return flash('Enter the team number', true)
    setBusy(true)
    const { data: row, error } = await supabase
      .from('pit_scouting')
      .upsert(
        {
          event_id: eventId,
          team_number: t,
          scout_id: user!.id,
          data,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,team_number,scout_id' },
      )
      .select('id')
      .single()
    setBusy(false)
    if (error) return flash('Save failed: ' + error.message, true)
    flash(existing ? `Updated pit report for ${t}` : `Saved pit report for ${t}`)
    setExisting((row as { id: string }).id)
  }

  if (loading) return <div className={`${card} p-8 text-center text-sm text-ink-soft`}>Loading…</div>
  if (!event)
    return (
      <div className={`${card} p-8 text-center text-sm text-ink-soft`}>
        No scouting event yet. <Link to="/scouting" className="text-accent hover:underline">Back to scouting</Link>
      </div>
    )

  return (
    <form onSubmit={submit} className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link to="/scouting" className="text-[11px] font-mono uppercase text-ink-soft hover:text-ink">
            ← Scouting
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Pit scout</h1>
          <p className="text-xs text-ink-soft">
            {event.name} · {done.size} team{done.size === 1 ? '' : 's'} pit-scouted
          </p>
        </div>
        {existing && <span className="text-[11px] font-mono uppercase text-accent">Editing your earlier report</span>}
      </div>

      <section className={card}>
        <div className="p-4 sm:p-5">
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
          {Number(team) > 0 && done.has(Number(team)) && !existing && (
            <p className="text-xs text-ink-soft mt-2">Another scout already pit-scouted this team — yours is added alongside.</p>
          )}
        </div>
      </section>

      <ScoutFields sections={PIT_SECTIONS} data={data} onChange={setData} />

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Notes</span>
        </div>
        <div className="p-4 sm:p-5">
          <textarea
            className={textarea}
            rows={4}
            placeholder="Anything the drive team should know"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </section>

      <button disabled={busy} className={`${btn} w-full h-12 text-base`}>
        {busy ? 'Saving…' : existing ? 'Update report' : 'Submit report'}
      </button>
      {Toast}
    </form>
  )
}
