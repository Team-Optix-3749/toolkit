import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { can } from '~/lib/rbac'
import { useToast } from '~/lib/toast'
import { useScoutEvents } from '~/lib/useScoutEvents'
import { Select } from '~/components/Select'
import {
  MATCH_TYPE_LABEL,
  STATIONS,
  matchLabel,
  parseSchedule,
  teamAtStation,
  type ScoutAssignment,
  type ScoutMatch,
  type Station,
} from '~/lib/scouting'
import type { ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost, input, label, textarea } from '~/lib/ui'

export const Route = createFileRoute('/_app/scouting/manage')({
  component: ManageScouting,
})

function ManageScouting() {
  const { user, profile } = useAuth()
  const { flash, Toast } = useToast()
  const { events, event, eventId, setEventId, reload } = useScoutEvents()
  const canManage = can(profile, 'manage_scouting')

  const [members, setMembers] = useState<ProfileRow[]>([])
  const [matches, setMatches] = useState<ScoutMatch[]>([])
  const [assignments, setAssignments] = useState<ScoutAssignment[]>([])
  const [busy, setBusy] = useState(false)

  // new event form
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')

  // schedule import
  const [importType, setImportType] = useState('qm')
  const [scheduleText, setScheduleText] = useState('')

  // auto-assign pool
  const [pool, setPool] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name, role')
      .eq('account_status', 'active')
      .neq('role', 'PENDING')
      .order('display_name')
      .then(({ data }) => setMembers((data as ProfileRow[]) || []))
  }, [])

  async function loadMatches() {
    if (!eventId) return setMatches([])
    const { data: m } = await supabase
      .from('scout_matches')
      .select('*')
      .eq('event_id', eventId)
      .order('match_type')
      .order('match_number')
    const ms = (m as ScoutMatch[]) || []
    setMatches(ms)
    if (ms.length) {
      const { data: a } = await supabase.from('scout_assignments').select('*').in('match_id', ms.map((x) => x.id))
      setAssignments((a as ScoutAssignment[]) || [])
    } else setAssignments([])
  }

  useEffect(() => {
    loadMatches()
  }, [eventId])

  if (!canManage) {
    return (
      <div className={`${card} p-8 text-center text-sm text-ink-soft`}>
        You need the “Manage scouting” permission. <Link to="/scouting" className="text-accent hover:underline">Back</Link>
      </div>
    )
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return flash('Event name required', true)
    setBusy(true)
    const { data: season } = await supabase.from('seasons').select('id').eq('is_current', true).maybeSingle()
    const { data, error } = await supabase
      .from('scout_events')
      .insert({
        name: name.trim(),
        event_code: code.trim() || null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        is_active: events.length === 0,
        created_by: user!.id,
        season_id: season?.id ?? null,
      })
      .select('id')
      .single()
    setBusy(false)
    if (error) return flash(error.message, true)
    setName('')
    setCode('')
    setStartsOn('')
    setEndsOn('')
    flash('Event created')
    await reload()
    setEventId((data as { id: string }).id)
  }

  async function makeActive() {
    if (!event) return
    const { error } = await supabase.from('scout_events').update({ is_active: true }).eq('id', event.id)
    if (error) return flash(error.message, true)
    flash(`${event.name} is now the active event`)
    reload()
  }

  async function deleteEvent() {
    if (!event) return
    const typed = prompt(`This deletes ${event.name} and ALL its scouting data. Type the event name to confirm.`)
    if (typed !== event.name) return
    const { error } = await supabase.from('scout_events').delete().eq('id', event.id)
    if (error) return flash(error.message, true)
    flash('Event deleted')
    try {
      localStorage.removeItem('optix-scout-event')
    } catch {
      /* ignore */
    }
    reload()
  }

  async function importSchedule() {
    const { rows, errors } = parseSchedule(scheduleText)
    if (errors.length) return flash(errors[0], true)
    if (!rows.length) return flash('Paste at least one match', true)
    setBusy(true)
    const { error } = await supabase.from('scout_matches').upsert(
      rows.map((r) => ({ event_id: eventId, match_type: importType, match_number: r.n, red: r.red, blue: r.blue })),
      { onConflict: 'event_id,match_type,match_number' },
    )
    setBusy(false)
    if (error) return flash(error.message, true)
    setScheduleText('')
    flash(`Imported ${rows.length} match${rows.length === 1 ? '' : 'es'}`)
    loadMatches()
  }

  async function assign(match: ScoutMatch, station: Station, scoutId: string) {
    const current = assignments.find((a) => a.match_id === match.id && a.station === station)
    const { error } = scoutId
      ? await supabase
          .from('scout_assignments')
          .upsert({ match_id: match.id, station, scout_id: scoutId }, { onConflict: 'match_id,station' })
      : current
        ? await supabase.from('scout_assignments').delete().eq('id', current.id)
        : { error: null }
    if (error) return flash(error.message, true)
    loadMatches()
  }

  /** Fill every empty station round-robin from the pool, in match order. */
  async function autoAssign() {
    if (pool.length === 0) return flash('Pick scouts for the pool first', true)
    const taken = new Set(assignments.map((a) => `${a.match_id}:${a.station}`))
    const rows: { match_id: string; station: Station; scout_id: string }[] = []
    let i = 0
    for (const m of matches) {
      const usedThisMatch = new Set(assignments.filter((a) => a.match_id === m.id).map((a) => a.scout_id))
      for (const st of STATIONS) {
        if (taken.has(`${m.id}:${st}`) || !teamAtStation(m, st)) continue
        // Skip anyone already scouting this match so one person never has two robots.
        let tries = 0
        while (usedThisMatch.has(pool[i % pool.length]) && tries < pool.length) {
          i++
          tries++
        }
        if (tries >= pool.length) break
        const scout = pool[i % pool.length]
        usedThisMatch.add(scout)
        rows.push({ match_id: m.id, station: st, scout_id: scout })
        i++
      }
    }
    if (!rows.length) return flash('Nothing to assign — every station is filled')
    setBusy(true)
    const { error } = await supabase.from('scout_assignments').insert(rows)
    setBusy(false)
    if (error) return flash(error.message, true)
    flash(`Assigned ${rows.length} station${rows.length === 1 ? '' : 's'}`)
    loadMatches()
  }

  async function clearAssignments() {
    if (!matches.length || !confirm('Remove every scout assignment for this event?')) return
    const { error } = await supabase.from('scout_assignments').delete().in('match_id', matches.map((m) => m.id))
    if (error) return flash(error.message, true)
    flash('Assignments cleared')
    loadMatches()
  }

  const memberOptions = [{ value: '', label: '—' }, ...members.map((m) => ({ value: m.id, label: m.display_name ?? m.id }))]
  const load = Object.fromEntries(members.map((m) => [m.id, assignments.filter((a) => a.scout_id === m.id).length]))

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/scouting" className="text-[11px] font-mono uppercase text-ink-soft hover:text-ink">
            ← Scouting
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Manage scouting</h1>
        </div>
        {events.length > 0 && (
          <Select
            size="sm"
            value={eventId}
            onChange={setEventId}
            options={events.map((e) => ({ value: e.id, label: e.name + (e.is_active ? ' · active' : '') }))}
            className="min-w-[220px]"
          />
        )}
      </div>

      {event && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>{event.name}</span>
            <div className="flex gap-2">
              {!event.is_active && (
                <button onClick={makeActive} className={btnGhost}>
                  Make active
                </button>
              )}
              <button onClick={deleteEvent} className={`${btnGhost} text-[#f07070]`}>
                Delete event
              </button>
            </div>
          </div>
          <div className="p-5 text-sm text-ink-soft">
            {event.is_active ? 'Active — members land on this event by default.' : 'Inactive.'} {matches.length} matches ·{' '}
            {assignments.length} assignments
          </div>
        </section>
      )}

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>New event</span>
        </div>
        <form onSubmit={createEvent} className="p-5 grid sm:grid-cols-4 gap-4 items-end">
          <label className="block sm:col-span-2">
            <span className={label}>Name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Silicon Valley Regional" required />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>Event code (optional)</span>
            <input className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="2027casj" />
          </label>
          <label className="block">
            <span className={label}>Starts</span>
            <input type="date" className={input} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Ends</span>
            <input type="date" className={input} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </label>
          <button disabled={busy} className={`${btn} sm:col-span-2`}>
            Create event
          </button>
        </form>
      </section>

      {event && (
        <>
          <section className={card}>
            <div className={cardHead}>
              <span className={cardTitle}>Import match schedule</span>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-ink-soft">
                One match per line: <code className="font-mono">match# red1 red2 red3 blue1 blue2 blue3</code>. Commas or tabs work, so you can paste
                straight from a spreadsheet. Re-importing a match number overwrites its teams.
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(MATCH_TYPE_LABEL).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setImportType(v)}
                    className={`${btnGhost} ${importType === v ? 'bg-accent/15 border-accent/40 text-accent' : ''}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <textarea
                className={`${textarea} font-mono`}
                rows={6}
                value={scheduleText}
                onChange={(e) => setScheduleText(e.target.value)}
                placeholder={'1 3749 254 1678 971 604 5940\n2 8 100 115 199 649 751'}
                aria-label="Match schedule"
              />
              <button onClick={importSchedule} disabled={busy || !scheduleText.trim()} className={btn}>
                Import
              </button>
            </div>
          </section>

          <section className={card}>
            <div className={cardHead}>
              <span className={cardTitle}>Scout pool &amp; auto-assign</span>
              <div className="flex gap-2">
                <button onClick={autoAssign} disabled={busy || !matches.length} className={btnGhost}>
                  Fill empty stations
                </button>
                <button onClick={clearAssignments} disabled={!assignments.length} className={`${btnGhost} text-[#f07070]`}>
                  Clear all
                </button>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 max-h-56 overflow-y-auto">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/[0.03] px-2 py-1 rounded-md">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent"
                      checked={pool.includes(m.id)}
                      onChange={() => setPool(pool.includes(m.id) ? pool.filter((x) => x !== m.id) : [...pool, m.id])}
                    />
                    <span className="truncate">{m.display_name ?? m.id}</span>
                    {load[m.id] > 0 && <span className="ml-auto text-[11px] font-mono text-ink-soft">{load[m.id]}</span>}
                  </label>
                ))}
              </div>
              <p className="text-xs text-ink-soft mt-2">Assigned scouts get a notification for each match.</p>
            </div>
          </section>

          <section className={card}>
            <div className={cardHead}>
              <span className={cardTitle}>Matches &amp; assignments</span>
            </div>
            {matches.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-ink-soft">Import a schedule to start assigning scouts.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/6 text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft">
                      <th scope="col" className="px-3 py-2 text-left">Match</th>
                      {STATIONS.map((s) => (
                        <th key={s} scope="col" className={`px-2 py-2 text-left ${s.startsWith('red') ? 'text-[#f07070]' : 'text-[#7fb2f5]'}`}>
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {matches.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{matchLabel(m.match_type, m.match_number)}</td>
                        {STATIONS.map((st) => {
                          const a = assignments.find((x) => x.match_id === m.id && x.station === st)
                          return (
                            <td key={st} className="px-2 py-1.5 min-w-[150px]">
                              <div className="font-mono text-xs mb-1">{teamAtStation(m, st) ?? '—'}</div>
                              <Select size="sm" value={a?.scout_id ?? ''} onChange={(v) => assign(m, st, v)} options={memberOptions} />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {Toast}
    </>
  )
}
