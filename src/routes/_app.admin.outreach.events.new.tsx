import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { can } from '~/lib/rbac'
import { outreachAction } from '~/lib/actions'
import { teamDateTime, teamInput } from '~/lib/time'
import { TeamDateTimeInput, type TimeDisambiguation } from '~/components/TeamDateTimeInput'
import type { Season } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, textarea, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/events/new')({ component: NewEvent })

function NewEvent() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState(() => ({ title: '', description: '', location: '', latitude: '', longitude: '', starts_at: teamInput(), ends_at: '', season_id: '' }))
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [startsChoice, setStartsChoice] = useState<TimeDisambiguation>('reject')
  const [endsChoice, setEndsChoice] = useState<TimeDisambiguation>('reject')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const result = await supabase.from('seasons').select('*').order('name')
      if (result.error) throw result.error
      const rows = (result.data || []) as Season[]
      setSeasons(rows)
      setF((old) => ({ ...old, season_id: old.season_id || rows.find((s) => s.is_current)?.id || '' }))
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load seasons.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (!f.title.trim() || !f.description.trim() || !f.location.trim()) throw new Error('Title, description and location are required.')
      if (!f.season_id) throw new Error('Select an existing season before creating an event.')
      if (!f.starts_at || !f.ends_at) throw new Error('Start and end are required.')
      const starts_at = teamDateTime(f.starts_at, startsChoice)
      const ends_at = teamDateTime(f.ends_at, endsChoice)
      if (Date.parse(ends_at) <= Date.parse(starts_at)) throw new Error('End must be later than start.')
      const latitude = f.latitude === '' ? null : Number(f.latitude)
      const longitude = f.longitude === '' ? null : Number(f.longitude)
      if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) throw new Error('Provide both valid coordinates or leave both empty.')
      const result = await outreachAction({ action: 'create', title: f.title.trim(), description: f.description.trim(), location: f.location.trim(), season_id: f.season_id, starts_at, ends_at, latitude, longitude })
      if (result.error) throw result.error
      await navigate({ to: '/admin/outreach/events' })
    } catch (e) { setError(e instanceof Error ? e.message : 'Event creation failed. Please retry.') }
    finally { setBusy(false) }
  }

  if (!can(profile, 'manage_outreach_events')) return <p role="alert">You do not have permission to create outreach events.</p>
  return <section className={card}>
    <div className={cardHead}><h1 className={cardTitle}>New outreach event</h1></div>
    {loading ? <p className="p-5" role="status">Loading seasons…</p> : loadError ? <div className="p-5" role="alert">{loadError} <button className={btnGhost} onClick={load}>Retry</button></div> : <form onSubmit={create} className="p-5 space-y-4">
      {!seasons.length && <p role="alert">Setup required: a season manager must create a season before events can be saved.</p>}
      <label className={label}>Season<select required className={input} value={f.season_id} onChange={(e) => setF({ ...f, season_id: e.target.value })}><option value="">Select a season</option>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' (current)' : ''}</option>)}</select></label>
      <label className={label}>Title<input required className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className={label}>Description<textarea required className={textarea} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className={label}>Location<input required className={input} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TeamDateTimeInput label="Start" value={f.starts_at} disambiguation={startsChoice} onChange={(v) => setF({ ...f, starts_at: v })} onDisambiguationChange={setStartsChoice} />
        <TeamDateTimeInput label="End" value={f.ends_at} disambiguation={endsChoice} onChange={(v) => setF({ ...f, ends_at: v })} onDisambiguationChange={setEndsChoice} />
      </div>
      <p className="text-sm text-ink-soft">Optional coordinates describe the location only. Outreach attendance is recorded by event leads or attendance managers, not GPS self-check-in.</p>
      <div className="grid gap-4 sm:grid-cols-2">{(['latitude', 'longitude'] as const).map((key) => <label key={key} className={label}>{key === 'latitude' ? 'Latitude (optional)' : 'Longitude (optional)'}<input type="number" step="any" min={key === 'latitude' ? -90 : -180} max={key === 'latitude' ? 90 : 180} className={input} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></label>)}</div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button disabled={busy || !seasons.length} className={btn} type="submit">{busy ? 'Creating…' : 'Create event'}</button>
    </form>}
  </section>
}
