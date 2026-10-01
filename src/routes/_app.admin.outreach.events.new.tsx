import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { toISO } from '~/lib/format'
import { card, cardHead, cardTitle, label, input, textarea, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/events/new')({
  component: NewEvent,
})

const blank = { title: '', description: '', location: '', latitude: '', longitude: '', starts_at: '', ends_at: '' }

function NewEvent() {
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!f.title.trim()) return flash('Title required', true)
    if (!f.starts_at) return flash('Start time required', true)
    if (f.latitude && isNaN(Number(f.latitude))) return flash('Latitude must be a number', true)
    if (f.longitude && isNaN(Number(f.longitude))) return flash('Longitude must be a number', true)
    setBusy(true)
    const { error } = await supabase.rpc('outreach_action', {
      payload: {
        action: 'create',
        title: f.title.trim(),
        description: f.description || null,
        location: f.location || null,
        latitude: f.latitude ? Number(f.latitude) : null,
        longitude: f.longitude ? Number(f.longitude) : null,
        starts_at: toISO(f.starts_at),
        ends_at: f.ends_at ? toISO(f.ends_at) : null,
      },
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
            <label className={label}>Location name</label>
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
            <label className={label}>Latitude (for check-in)</label>
            <input className={input} placeholder="e.g. 33.0144" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} />
          </div>
          <div>
            <label className={label}>Longitude (for check-in)</label>
            <input className={input} placeholder="e.g. -117.1222" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} />
          </div>
        </div>
        <div className="mt-4">
          <label className={label}>Description</label>
          <textarea rows={3} className={textarea} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <p className="text-xs text-ink-soft mt-2">
          Latitude and longitude are required for members to self-check-in at the event location. Members must be within 1 mile.
        </p>
        <button onClick={create} disabled={busy} className={`mt-5 ${btn}`}>
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
