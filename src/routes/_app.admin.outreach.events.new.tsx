import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { toISO } from '~/lib/format'
import { getPosition } from '~/lib/geo'
import { card, cardHead, cardTitle, label, input, textarea, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/events/new')({
  component: NewEvent,
})

const blank = { title: '', description: '', location: '', lat: '', lng: '', starts_at: '', ends_at: '' }

function NewEvent() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)

  async function useMyLocation() {
    const c = await getPosition()
    if (!c) return flash('Location unavailable', true)
    setF((s) => ({ ...s, lat: c.latitude.toFixed(6), lng: c.longitude.toFixed(6) }))
  }

  async function create() {
    if (!f.title.trim()) return flash('Title required', true)
    if (!f.starts_at) return flash('Start time required', true)
    setBusy(true)
    const { error } = await supabase.from('outreach_events').insert({
      created_by: user!.id,
      title: f.title.trim(),
      description: f.description || null,
      location: f.location || null,
      lat: f.lat ? Number(f.lat) : null,
      lng: f.lng ? Number(f.lng) : null,
      starts_at: toISO(f.starts_at),
      ends_at: f.ends_at ? toISO(f.ends_at) : null,
      qr_token: crypto.randomUUID(),
    })
    setBusy(false)
    if (error) return flash('Create failed: ' + error.message, true)
    flash('Event created')
    navigate({ to: '/admin/outreach/events' })
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>New outreach event</span>
      </div>
      <div className="p-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Title</label>
            <input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </div>
          <div>
            <label className={label}>Location</label>
            <input className={input} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </div>
          <div>
            <label className={label}>Starts</label>
            <input type="datetime-local" className={input} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
          </div>
          <div>
            <label className={label}>Ends</label>
            <input type="datetime-local" className={input} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
          </div>
          <div>
            <label className={label}>Latitude</label>
            <input className={input} value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />
          </div>
          <div>
            <label className={label}>Longitude</label>
            <input className={input} value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />
          </div>
        </div>
        <div className="mt-2">
          <button type="button" onClick={useMyLocation} className={btnGhost}>
            Use my location
          </button>
        </div>
        <div className="mt-4">
          <label className={label}>Description</label>
          <textarea rows={3} className={textarea} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <button onClick={create} disabled={busy} className={`mt-5 ${btn}`}>
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
