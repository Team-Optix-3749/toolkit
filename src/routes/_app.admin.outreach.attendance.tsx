import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { outreachAction } from '~/lib/actions'
import { useAuth } from '~/lib/auth'
import { can } from '~/lib/rbac'
import { eventState } from '~/lib/outreach'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import { teamDateTime, teamInput } from '~/lib/time'
import { TeamDateTimeInput, type TimeDisambiguation } from '~/components/TeamDateTimeInput'
import type { OutreachAttendance, OutreachEvent, Season } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/attendance')({ component: OutreachAttendancePage })
type NamedMember = { id: string; display_name: string | null }

function OutreachAttendancePage() {
  const { user, profile } = useAuth()
  const globalManager = can(profile, 'manage_outreach_attendance')
  const [events, setEvents] = useState<OutreachEvent[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [eventId, setEventId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [eventResult, seasonResult, leadResult] = await Promise.all([
        supabase.from('outreach_events').select('*').order('starts_at', { ascending: false }),
        supabase.from('seasons').select('*').order('name'),
        supabase.from('outreach_leads').select('event_id').eq('member_id', user!.id),
      ])
      if (eventResult.error) throw eventResult.error
      if (seasonResult.error) throw seasonResult.error
      if (leadResult.error) throw leadResult.error
      const ids = new Set((leadResult.data || []).map((l) => l.event_id as string))
      setEvents(((eventResult.data || []) as OutreachEvent[]).filter((e) => globalManager || ids.has(e.id)))
      const rows = (seasonResult.data || []) as Season[]
      setSeasons(rows)
      setSeasonId((old) => old || rows.find((s) => s.is_current)?.id || rows[0]?.id || '')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load attendance events.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (user) void load() }, [user?.id, globalManager])
  const visible = events.filter((e) => e.season_id === seasonId)
  const event = visible.find((e) => e.id === eventId)

  return <div className="space-y-5">
    <section className={card}>
      <div className={cardHead}><h1 className={cardTitle}>Outreach attendance</h1><button className={btnGhost} onClick={load} disabled={loading}>Refresh</button></div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-ink-soft">{globalManager ? 'Record or correct attendance in any season, including outside event windows. Credit is calculated by the server.' : 'Only events assigned to you are shown. Record live arrivals or retrospective attendance within each event’s start and end; no global attendance permission is implied.'}</p>
        {loading ? <p role="status">Loading events…</p> : error ? <p role="alert">{error} <button className={btnGhost} onClick={load}>Retry</button></p> : <>
          {!seasons.length && <p role="alert">Setup required: no seasons exist.</p>}
          <label className={label}>Season<select className={input} value={seasonId} onChange={(e) => { setSeasonId(e.target.value); setEventId('') }}><option value="">Select a season</option>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' (current)' : ''}</option>)}</select></label>
          <label className={label}>Event<select className={input} value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Select an event</option>{visible.map((e) => <option key={e.id} value={e.id}>{e.title} — {eventState(e)}</option>)}</select></label>
          {seasonId && !visible.length && <p className="text-sm text-ink-soft">No events you can maintain in this season.</p>}
        </>}
      </div>
    </section>
    {!loading && !error && event && <><Link to="/outreach/events/$id" params={{ id: event.id }} className={btnGhost}>View event</Link><EventAttendance key={event.id} event={event} canRecord globalManager={globalManager} /></>}
  </div>
}

export function EventAttendance({ event, canRecord, globalManager }: { event: OutreachEvent; canRecord: boolean; globalManager: boolean }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<OutreachAttendance[]>([])
  const [members, setMembers] = useState<NamedMember[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [arrival, setArrival] = useState(() => teamInput())
  const [departure, setDeparture] = useState('')
  const [arrivalChoice, setArrivalChoice] = useState<TimeDisambiguation>('reject')
  const [departureChoice, setDepartureChoice] = useState<TimeDisambiguation>('reject')
  const [preserved, setPreserved] = useState<{ arrival: string; departure: string | null } | null>(null)

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      let query = supabase.from('outreach_attendance').select('*').eq('event_id', event.id).order('arrival')
      if (!canRecord) query = query.eq('member_id', user!.id)
      const [attendance, historical, directory] = await Promise.all([
        query,
        supabase.from('historical_profiles').select('id, display_name'),
        canRecord ? supabase.from('public_directory').select('id, display_name').order('display_name') : Promise.resolve({ data: [] as NamedMember[], error: null }),
      ])
      if (attendance.error) throw attendance.error
      if (historical.error) throw historical.error
      if (directory.error) throw directory.error
      setRows((attendance.data || []) as OutreachAttendance[])
      setNames(Object.fromEntries((historical.data || []).map((p) => [p.id, p.display_name || 'Unnamed member'])))
      setMembers((directory.data || []) as NamedMember[])
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load attendance.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (user) void load() }, [event.id, user?.id, canRecord])

  function selectMember(id: string) {
    setMemberId(id)
    setError('')
    setSuccess('')
    const row = rows.find((r) => r.member_id === id)
    setArrival(row ? teamInput(row.arrival) : teamInput())
    setDeparture(row ? teamInput(row.departure) : '')
    setPreserved(row ? { arrival: row.arrival, departure: row.departure } : null)
    setArrivalChoice('reject')
    setDepartureChoice('reject')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      if (!memberId || !arrival) throw new Error('Select a member and enter arrival.')
      const from = preserved?.arrival || teamDateTime(arrival, arrivalChoice)
      const to = departure ? preserved?.departure ?? teamDateTime(departure, departureChoice) : null
      if (to && Date.parse(to) <= Date.parse(from)) throw new Error('Departure must be later than arrival.')
      if (!globalManager && (Date.parse(from) < Date.parse(event.starts_at) || Date.parse(from) >= Date.parse(event.ends_at) || (to && Date.parse(to) > Date.parse(event.ends_at)))) throw new Error('Event leads must keep arrival and departure inside the event window.')
      const result = await outreachAction({ action: 'attendance', event_id: event.id, member_id: memberId, arrival: from, departure: to })
      if (result.error) throw result.error
      setSuccess('Attendance saved. Completed credit is calculated by the server; open arrivals earn zero.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Attendance save failed. Please retry.') }
    finally { setBusy(false) }
  }
  const selectable = [...members, ...rows.filter((r) => !members.some((m) => m.id === r.member_id)).map((r) => ({ id: r.member_id, display_name: `${names[r.member_id] || 'Historical member'} (inactive)` }))]
  return <section className={card}>
    <div className={cardHead}><h2 className={cardTitle}>{canRecord ? 'Attendance roster' : 'Your attendance'}</h2><button className={btnGhost} onClick={load} disabled={loading || busy}>Refresh attendance</button></div>
    <div className="p-5 space-y-4">
      <p className="text-sm text-ink-soft">{fmtDateTime(event.starts_at)} – {fmtDateTime(event.ends_at)}. Saved timestamps display in your local timezone; editing uses Los Angeles time.</p>
      {loading ? <p role="status">Loading attendance…</p> : loadError ? <p role="alert">{loadError} <button className={btnGhost} onClick={load}>Retry</button></p> : <>
        {!rows.length ? <p className="text-sm text-ink-soft">{canRecord ? 'No attendance has been recorded.' : 'No attendance recorded for you. Contact an event lead if a correction is needed.'}</p> : <div role="region" aria-label="Outreach attendance records" tabIndex={0} className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Member', 'Arrival', 'Departure', 'Credited hours', ...(canRecord ? ['Action'] : [])].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line"><td className="p-2">{names[r.member_id] || 'Member'}</td><td className="p-2">{fmtDateTime(r.arrival)}</td><td className="p-2">{r.departure ? fmtDateTime(r.departure) : 'Present (open)'}</td><td className="p-2">{hoursFromMinutes(event.cancelled || !r.departure ? 0 : Number(r.credited_minutes || 0)).toFixed(2)}</td>{canRecord && <td className="p-2"><button className={btnGhost} disabled={busy} onClick={() => selectMember(r.member_id)}>Edit attendance</button></td>}</tr>)}</tbody></table></div>}
        {canRecord && <form onSubmit={save} className="space-y-4 border-t border-line pt-4">
          <h3 className="font-semibold">Record live or retrospective attendance</h3>
          {event.cancelled && <p className="text-sm text-ink-soft">This event is cancelled. Retained attendance earns zero credit.</p>}
          <label className={label}>Member<select required className={input} value={memberId} onChange={(e) => selectMember(e.target.value)}><option value="">Select a member</option>{selectable.map((m) => <option key={m.id} value={m.id}>{m.display_name || 'Unnamed member'}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <TeamDateTimeInput label="Arrival" value={arrival} disambiguation={arrivalChoice} onChange={(v) => { setArrival(v); setPreserved((old) => old ? { ...old, arrival: '' } : null) }} onDisambiguationChange={setArrivalChoice} />
            <TeamDateTimeInput label="Departure (leave empty for live arrival)" value={departure} disambiguation={departureChoice} onChange={(v) => { setDeparture(v); setPreserved((old) => old ? { ...old, departure: null } : null) }} onDisambiguationChange={setDepartureChoice} />
          </div>
          <p className="text-sm text-ink-soft">One record per member and event. Select a recorded member to update that record. Leave departure empty to explicitly keep it open (zero credit).</p>
          {error && <p role="alert" className="text-danger text-sm">{error}</p>}{success && <p role="status" className="text-sm">{success}</p>}
          <button type="submit" className={btn} disabled={busy || !memberId}>{busy ? 'Saving…' : 'Save attendance'}</button>
        </form>}
      </>}
    </div>
  </section>
}
