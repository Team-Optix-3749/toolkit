import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { outreachAction } from '~/lib/actions'
import { useAuth } from '~/lib/auth'
import { can } from '~/lib/rbac'
import { fmtDateTime } from '~/lib/format'
import { eventState } from '~/lib/outreach'
import { teamDateTime, teamInput } from '~/lib/time'
import { TeamDateTimeInput, type TimeDisambiguation } from '~/components/TeamDateTimeInput'
import { Badge } from '~/components/Badge'
import { EventAttendance } from './_app.admin.outreach.attendance'
import type { OutreachEvent, OutreachAttendance, Season } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, textarea, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/events/$id')({ component: EventDetail })
import {ConfirmDialog} from '~/components/ConfirmDialog'
type NamedMember = { id: string; display_name: string | null }
type Correction = { member_id: string; arrival: string; departure: string; arrivalChoice: TimeDisambiguation; departureChoice: TimeDisambiguation; originalArrival?: string; originalDeparture?: string | null }

function EventDetail() {
  const { id } = Route.useParams()
  const { user, profile } = useAuth()
  const [event, setEvent] = useState<OutreachEvent | null>(null)
  const [leads, setLeads] = useState<string[]>([])
  const [directory, setDirectory] = useState<NamedMember[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [seasons, setSeasons] = useState<Season[]>([])
  const [planned, setPlanned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: '', description: '', location: '', latitude: '', longitude: '', starts_at: '', ends_at: '', season_id: '' })
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [startChoice, setStartChoice] = useState<TimeDisambiguation>('reject')
  const [endChoice, setEndChoice] = useState<TimeDisambiguation>('reject')
  const [startChanged, setStartChanged] = useState(false)
  const [endChanged, setEndChanged] = useState(false)
  const [withCorrections, setWithCorrections] = useState(false)
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'restore' | null>(null)
  const [now, setNow] = useState(Date.now())
  const manager = can(profile, 'manage_outreach_events')
  const attendanceManager = can(profile, 'manage_outreach_attendance')
  const canRecord = attendanceManager || leads.includes(user?.id || '')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const [ev, ld, rv, historical, seasonRows, active] = await Promise.all([
        supabase.from('outreach_events').select('*').eq('id', id).maybeSingle(),
        supabase.from('outreach_leads').select('member_id').eq('event_id', id),
        supabase.from('outreach_rsvps').select('member_id').eq('event_id', id).eq('member_id', user!.id),
        supabase.from('historical_profiles').select('id, display_name'),
        supabase.from('seasons').select('*').order('name'),
        manager ? supabase.from('public_directory').select('id, display_name').order('display_name') : Promise.resolve({ data: [] as NamedMember[], error: null }),
      ])
      for (const result of [ev, ld, rv, historical, seasonRows, active]) if (result.error) throw result.error
      setEvent(ev.data as OutreachEvent | null)
      setLeads((ld.data || []).map((l) => l.member_id as string))
      setSelectedLeads((ld.data || []).map((l) => l.member_id as string))
      setPlanned(!!rv.data?.length)
      setNames(Object.fromEntries((historical.data || []).map((p) => [p.id, p.display_name || 'Unnamed member'])))
      setSeasons((seasonRows.data || []) as Season[])
      setDirectory((active.data || []) as NamedMember[])
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load this event.') }
    finally { setLoading(false) }
  }
  useEffect(() => { setEditing(false); setError(''); setSuccess(''); if (user) void load() }, [id, user?.id, manager])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])

  async function mutate(action: () => Promise<{ error: { message: string } | null }>, message: string) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await action()
      if (result.error) throw new Error(result.error.message)
      setSuccess(message)
      await load()
      return true
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed. Please retry.'); return false }
    finally { setBusy(false) }
  }

  async function openEdit() {
    if (!event) return
    setError('')
    setBusy(true)
    try {
      let rows: OutreachAttendance[] = []
      if (attendanceManager) {
        const result = await supabase.from('outreach_attendance').select('*').eq('event_id', id).order('member_id')
        if (result.error) throw result.error
        rows = (result.data || []) as OutreachAttendance[]
      }
      setCorrections(rows.map((r) => ({ member_id: r.member_id, arrival: teamInput(r.arrival), departure: teamInput(r.departure), arrivalChoice: 'reject', departureChoice: 'reject', originalArrival: r.arrival, originalDeparture: r.departure })))
      setDraft({ title: event.title, description: event.description, location: event.location, starts_at: teamInput(event.starts_at), ends_at: teamInput(event.ends_at), season_id: event.season_id, latitude: event.latitude?.toString() ?? '', longitude: event.longitude?.toString() ?? '' })
      setStartChoice('reject'); setEndChoice('reject'); setStartChanged(false); setEndChanged(false); setWithCorrections(false); setEditing(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load event corrections.') }
    finally { setBusy(false) }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!event) return
    setError('')
    try {
      if (!draft.title.trim() || !draft.description.trim() || !draft.location.trim() || !draft.season_id || !draft.starts_at || !draft.ends_at) throw new Error('Title, description, location, season, start and end are required.')
      const starts_at = startChanged ? teamDateTime(draft.starts_at, startChoice) : event.starts_at
      const ends_at = endChanged ? teamDateTime(draft.ends_at, endChoice) : event.ends_at
      if (Date.parse(ends_at) <= Date.parse(starts_at)) throw new Error('End must be later than start.')
      const latitude = draft.latitude === '' ? null : Number(draft.latitude)
      const longitude = draft.longitude === '' ? null : Number(draft.longitude)
      if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) throw new Error('Provide both valid coordinates or leave both empty.')
      const attendance_corrections = withCorrections ? corrections.map((r) => {
        if (!r.arrival) throw new Error('Every retained attendance row requires arrival.')
        const arrival = r.originalArrival ?? teamDateTime(r.arrival, r.arrivalChoice)
        const departure = r.departure ? r.originalDeparture ?? teamDateTime(r.departure, r.departureChoice) : null
        if (departure && Date.parse(departure) <= Date.parse(arrival)) throw new Error('Each departure must be later than arrival.')
        return { member_id: r.member_id, arrival, departure }
      }) : undefined
      const saved = await mutate(() => outreachAction({ action: 'edit', id, title: draft.title.trim(), description: draft.description.trim(), location: draft.location.trim(), season_id: draft.season_id, starts_at, ends_at, latitude, longitude, ...(attendance_corrections ? { attendance_corrections } : {}) }), 'Event updated. Attendance inherits the event season.')
      if (saved) setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid event fields.') }
  }

  if (loading) return <p className="p-5" role="status">Loading event…</p>
  if (loadError) return <div className={card}><p className="p-5" role="alert">{loadError} <button className={btnGhost} onClick={load}>Retry</button></p></div>
  if (!event) return <div className={card}><p className="p-5">Event not found or no longer accessible.</p><button className={btnGhost} onClick={load}>Retry</button></div>
  const state = eventState(event, now)
  return <div className="space-y-5">
    <section className={card}>
      <div className={cardHead}><h1 className={cardTitle}>{event.title}</h1><Badge label={state} tone={event.cancelled ? 'REJECTED' : 'PENDING'} /></div>
      <div className="p-5 space-y-4 text-sm">
        <p><strong>Season:</strong> {seasons.find((s) => s.id === event.season_id)?.name || event.season_id}</p>
        <p><strong>Starts:</strong> {fmtDateTime(event.starts_at)}</p><p><strong>Ends:</strong> {fmtDateTime(event.ends_at)}</p>
        <p><strong>Location:</strong> {event.location}</p><p className="whitespace-pre-wrap">{event.description}</p>
        <p><strong>Event leads:</strong> {leads.length ? leads.map((l) => names[l] || 'Member').join(', ') : 'None assigned'}</p>
        {event.latitude !== null && event.longitude !== null && <p className="text-ink-soft">Location coordinates: {event.latitude}, {event.longitude} (metadata only).</p>}
        <p className="text-ink-soft">Attendance is entered by assigned event leads or attendance managers. Members can RSVP, but cannot check themselves in or out.</p>
        <div className="flex flex-wrap gap-3">
          {!event.cancelled && now < Date.parse(event.starts_at) ? <button className={planned ? btnGhost : btn} disabled={busy} onClick={() => mutate(() => outreachAction({ action: 'rsvp', event_id: id, planned: !planned }), planned ? 'RSVP removed.' : 'RSVP saved.')}>{planned ? 'Remove RSVP' : 'I plan to attend'}</button> : <p>{planned ? 'You RSVPed. ' : ''}RSVP changes close when the event starts.</p>}
          {manager && <><button className={btnGhost} disabled={busy} onClick={openEdit}>Edit event</button><button className={btnGhost} disabled={busy} onClick={() => setConfirmAction(event.cancelled ? 'restore' : 'cancel')}>{event.cancelled ? 'Restore event' : 'Cancel event'}</button></>}
        </div>
        <ConfirmDialog open={!!confirmAction} title={confirmAction==='cancel'?'Cancel event?':'Restore event?'} description="Attendance is retained. Cancellation disables ordinary credit; restoration atomically revalidates all retained intervals." busy={busy} onCancel={()=>setConfirmAction(null)} onConfirm={async()=>{if(confirmAction&&await mutate(()=>outreachAction({action:confirmAction,id}),confirmAction==='cancel'?'Event cancelled.':'Event restored.'))setConfirmAction(null)}}/>
        {error && <p role="alert" className="text-danger">{error}</p>}{success && <p role="status">{success}</p>}
      </div>
    </section>
    {manager && editing && <section className={card}><div className={cardHead}><h2 className={cardTitle}>Edit event</h2></div><form onSubmit={saveEdit} className="p-5 space-y-4">
      <label className={label}>Season<select required className={input} value={draft.season_id} onChange={(e) => setDraft({ ...draft, season_id: e.target.value })}>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' (current)' : ''}</option>)}</select></label>
      <p className="text-sm text-ink-soft">All attendance follows the parent season. There is no independent attendance season.</p>
      <label className={label}>Title<input required className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label className={label}>Description<textarea required className={textarea} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className={label}>Location<input required className={input} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><TeamDateTimeInput label="Start" value={draft.starts_at} disambiguation={startChoice} onChange={(v) => { setDraft({ ...draft, starts_at: v }); setStartChanged(true) }} onDisambiguationChange={setStartChoice} /><TeamDateTimeInput label="End" value={draft.ends_at} disambiguation={endChoice} onChange={(v) => { setDraft({ ...draft, ends_at: v }); setEndChanged(true) }} onDisambiguationChange={setEndChoice} /></div>
      <div className="grid gap-4 sm:grid-cols-2">{(['latitude', 'longitude'] as const).map((key) => <label key={key} className={label}>{key} (optional metadata)<input type="number" step="any" className={input} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
      <p className="text-sm text-ink-soft">Window changes that invalidate existing attendance are rejected. An attendance manager may explicitly include a complete correction below in the same transaction.</p>
      {attendanceManager && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withCorrections} onChange={(e) => setWithCorrections(e.target.checked)} />Include complete retained-attendance corrections atomically</label>{withCorrections && <div className="space-y-4">{!corrections.length && <p>No retained attendance rows to correct.</p>}{corrections.map((r, index) => <fieldset key={r.member_id} className="border border-line p-3 space-y-3"><legend>{names[r.member_id] || 'Historical member'}</legend><TeamDateTimeInput label="Corrected arrival" value={r.arrival} disambiguation={r.arrivalChoice} onChange={(value) => setCorrections((old) => old.map((row, i) => i === index ? { ...row, arrival: value, originalArrival: undefined } : row))} onDisambiguationChange={(value) => setCorrections((old) => old.map((row, i) => i === index ? { ...row, arrivalChoice: value } : row))} /><TeamDateTimeInput label="Corrected departure (empty keeps open)" value={r.departure} disambiguation={r.departureChoice} onChange={(value) => setCorrections((old) => old.map((row, i) => i === index ? { ...row, departure: value, originalDeparture: undefined } : row))} onDisambiguationChange={(value) => setCorrections((old) => old.map((row, i) => i === index ? { ...row, departureChoice: value } : row))} /></fieldset>)}</div>}</>}
      <div className="flex gap-3"><button type="submit" className={btn} disabled={busy}>Save event</button><button type="button" className={btnGhost} disabled={busy} onClick={() => setEditing(false)}>Discard edits</button></div>
      {error && <p role="alert" className="text-danger text-sm">{error}</p>}
    </form></section>}
    {manager && <section className={card}><div className={cardHead}><h2 className={cardTitle}>Assign event leads</h2></div><div className="p-5 space-y-4"><p className="text-sm text-ink-soft">Leads may maintain attendance for this event only, within its configured window. Managing events does not grant attendance access.</p><fieldset className="max-h-64 overflow-y-auto space-y-2"><legend className={label}>Active members</legend>{directory.map((p) => <label key={p.id} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={selectedLeads.includes(p.id)} onChange={(e) => setSelectedLeads((old) => e.target.checked ? [...old, p.id] : old.filter((id) => id !== p.id))} />{p.display_name || 'Unnamed member'}</label>)}</fieldset><button className={btn} disabled={busy} onClick={() => mutate(() => outreachAction({ action: 'leads', id, member_ids: selectedLeads.filter((id) => directory.some((p) => p.id === id)) }), 'Event leads updated.')}>Save leads</button></div></section>}
    <EventAttendance key={`${id}:${canRecord}`} event={event} canRecord={canRecord} globalManager={attendanceManager} />
  </div>
}
