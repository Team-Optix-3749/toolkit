import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { RequireOwner } from '~/components/Guards'
import { ROLES, ROLE_LABEL } from '~/lib/rbac'
import { TEAM_ZONE } from '~/lib/time'
import type { SettingsActionPayload } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/settings')({
  component: () => <RequireOwner><Settings /></RequireOwner>,
})

function Settings() {
  const { flash, Toast } = useToast()
  const [name, setName] = useState('')
  const [radius, setRadius] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    setLoadFailed(false)
    try {
      const { data, error } = await supabase.rpc('settings_action', { payload: { action: 'get' } satisfies SettingsActionPayload })
      if (error) throw error
      if (!data || typeof data.org_name !== 'string' || typeof data.build_default_radius_m !== 'string' || data.timezone !== TEAM_ZONE) {
        throw new Error('Organization settings are incomplete. Ask the President to check the configuration.')
      }
      setName(data.org_name)
      setRadius(data.build_default_radius_m)
    } catch (cause) {
      setLoadFailed(true)
      setError(cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' ? cause.message : 'Could not load settings. Please retry.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setSuccess('')
    const distance = Number(radius)
    if (!name.trim() || !radius.trim() || !Number.isFinite(distance) || distance <= 0) {
      setError('Enter an organization name and a finite, positive build radius in meters.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.rpc('settings_action', {
        payload: { action: 'edit', org_name: name.trim(), timezone: TEAM_ZONE, build_default_radius_m: distance } satisfies SettingsActionPayload,
      })
      if (error) throw error
      setName(name.trim())
      setSuccess('Organization settings saved.')
      flash('Organization settings saved')
    } catch (cause) {
      const message = cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' ? cause.message : 'Settings could not be saved. Please retry.'
      setError(message)
      flash(message, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className={card} aria-busy={loading || busy}>
        <div className={cardHead}><h1 className={cardTitle}>Organization settings</h1></div>
        <p className="px-5 pt-4 text-sm text-ink-soft">President-only configuration. Event and session inputs use Los Angeles time; saved instants display in each viewer’s local timezone. Seasons and their uniform targets are configured in Setup.</p>
        {error && <p role="alert" className="px-5 pt-4 text-sm text-red-400">{error}</p>}
        {success && <p role="status" className="px-5 pt-4 text-sm text-ink-soft">{success}</p>}
        {loading && <p role="status" className="p-5 text-sm text-ink-soft">Loading organization settings…</p>}
        {loadFailed && <div className="p-5"><button type="button" disabled={loading} className={btnGhost} onClick={() => void load()}>Retry loading settings</button></div>}
        <form onSubmit={save}>
          <fieldset disabled={loading || busy || loadFailed} className="p-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className={label}>Organization name</span><input required className={input} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="block"><span className={label}>Team timezone (fixed)</span><input readOnly className={input} value={TEAM_ZONE} aria-describedby="team-timezone-policy" /></label>
            <label className="block"><span className={label}>Default build radius (meters)</span><input required type="number" min="0" step="any" className={input} value={radius} onChange={(event) => setRadius(event.target.value)} /></label>
            <p id="team-timezone-policy" className="sm:col-span-2 text-xs text-ink-soft">America/Los_Angeles is team policy, including daylight saving transitions, and cannot be overridden. A default radius does not create a geofence for an unconfigured build location.</p>
            <button className={`${btn} sm:col-span-2 sm:w-fit`}>{busy ? 'Saving…' : 'Save organization settings'}</button>
          </fieldset>
        </form>
      </section>
      <section className={card}>
        <div className={cardHead}><span className={cardTitle}>Roles</span></div>
        <div className="p-5 flex gap-2 flex-wrap">{ROLES.map((role) => <span key={role} className="text-[11px] font-mono uppercase tracking-wide px-2 py-1 border border-line text-ink-soft">{ROLE_LABEL[role]}</span>)}</div>
      </section>
      {Toast}
    </>
  )
}
