import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { toISO } from '~/lib/format'
import { Select } from '~/components/Select'
import type { BuildLocation } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/schedule/new')({
  component: NewSession,
})

const NEW_LOCATION = '__new'

function NewSession() {
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [locations, setLocations] = useState<BuildLocation[]>([])
  const [busy, setBusy] = useState(false)
  const [startNow, setStartNow] = useState(true)
  const [newLocation, setNewLocation] = useState('')
  const [f, setF] = useState({
    title: '',
    location_id: '',
    opens_at: '',
    closes_at: '',
  })

  async function loadLocations() {
    const { data } = await supabase.from('build_locations').select('*').order('name')
    const list = (data as BuildLocation[]) || []
    setLocations(list)
    return list
  }

  useEffect(() => {
    loadLocations().then((list) => {
      if (list.length === 1) setF((cur) => ({ ...cur, location_id: list[0].id }))
    })
  }, [])

  async function addLocation() {
    const name = newLocation.trim()
    if (!name) return flash('Location name required', true)
    const { data, error } = await supabase.rpc('build_action', { payload: { action: 'location', name } })
    if (error) return flash('Could not add location: ' + error.message, true)
    await loadLocations()
    setF({ ...f, location_id: (data as BuildLocation).id })
    setNewLocation('')
  }

  async function create() {
    if (!startNow && !f.opens_at) return flash('Opens at required', true)
    if (f.location_id === NEW_LOCATION) return flash('Save the new location first', true)
    const title = f.title.trim() || `Build session · ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}`
    setBusy(true)
    const { data, error } = await supabase.rpc('build_action', {
      payload: {
        action: 'session',
        title,
        location_id: f.location_id || null,
        // Omitted opens_at = server's now()
        opens_at: startNow ? null : toISO(f.opens_at),
        closes_at: f.closes_at ? toISO(f.closes_at) : null,
      },
    })
    setBusy(false)
    if (error) return flash('Create failed: ' + error.message, true)
    if (startNow) {
      navigate({ to: '/admin/build/qr', search: { session: (data as { id: string }).id } })
    } else {
      flash('Session created')
      navigate({ to: '/admin/build/schedule' })
    }
  }

  const locationOptions = [
    { value: '', label: '(none)' },
    ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
    { value: NEW_LOCATION, label: '+ Add new location…' },
  ]

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>New build session</span>
      </div>
      <div className="p-5">
        <div className="flex gap-1 p-1 mb-5 w-fit rounded-lg bg-white/5 border border-white/10">
          {[
            { v: true, l: 'Start now' },
            { v: false, l: 'Schedule' },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => setStartNow(o.v)}
              className={`h-8 px-4 rounded-md text-sm transition-colors ${
                startNow === o.v ? 'bg-accent/15 text-accent border border-accent/25' : 'text-ink-soft hover:text-ink border border-transparent'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Title</label>
            <input
              className={input}
              placeholder="Build session"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Location</label>
            <Select value={f.location_id} onChange={(v) => setF({ ...f, location_id: v })} options={locationOptions} />
            {f.location_id === NEW_LOCATION && (
              <div className="flex gap-2 mt-2">
                <input
                  className={input}
                  autoFocus
                  placeholder="e.g. Robotics lab"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLocation()}
                />
                <button type="button" onClick={addLocation} className={`${btnGhost} h-9 shrink-0`}>
                  Save
                </button>
              </div>
            )}
          </div>
          {!startNow && (
            <div>
              <label className={label}>Opens at</label>
              <input type="datetime-local" className={input} value={f.opens_at} onChange={(e) => setF({ ...f, opens_at: e.target.value })} />
            </div>
          )}
          <div>
            <label className={label}>Closes at (optional)</label>
            <input type="datetime-local" className={input} value={f.closes_at} onChange={(e) => setF({ ...f, closes_at: e.target.value })} />
          </div>
        </div>

        <button onClick={create} disabled={busy} className={`mt-5 ${btn}`}>
          {busy ? 'Creating…' : startNow ? 'Start session' : 'Create session'}
        </button>
        {startNow && (
          <p className="mt-2 text-xs text-ink-soft">Opens immediately and takes you to the check-in QR.</p>
        )}
      </div>
      {Toast}
    </section>
  )
}
