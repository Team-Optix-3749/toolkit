import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { toISO } from '~/lib/format'
import type { BuildLocation } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/schedule/new')({
  component: NewSession,
})

function NewSession() {
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [locations, setLocations] = useState<BuildLocation[]>([])
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    title: '',
    location_id: '',
    opens_at: '',
    closes_at: '',
  })

  useEffect(() => {
    supabase
      .from('build_locations')
      .select('*')
      .order('name')
      .then(({ data }) => setLocations((data as BuildLocation[]) || []))
  }, [])

  async function create() {
    if (!f.title.trim()) return flash('Title required', true)
    if (!f.opens_at) return flash('Opens at required', true)
    setBusy(true)
    const { error } = await supabase.rpc('build_action', {
      payload: {
        action: 'session',
        title: f.title.trim(),
        location_id: f.location_id || null,
        opens_at: toISO(f.opens_at),
        closes_at: f.closes_at ? toISO(f.closes_at) : null,
      },
    })
    setBusy(false)
    if (error) return flash('Create failed: ' + error.message, true)
    flash('Session created')
    navigate({ to: '/admin/build/schedule' })
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>New build session</span>
      </div>
      <div className="p-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Title</label>
            <input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </div>
          <div>
            <label className={label}>Location</label>
            <select className={input} value={f.location_id} onChange={(e) => setF({ ...f, location_id: e.target.value })}>
              <option value="">(none)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Opens at</label>
            <input type="datetime-local" className={input} value={f.opens_at} onChange={(e) => setF({ ...f, opens_at: e.target.value })} />
          </div>
          <div>
            <label className={label}>Closes at</label>
            <input type="datetime-local" className={input} value={f.closes_at} onChange={(e) => setF({ ...f, closes_at: e.target.value })} />
          </div>
        </div>

        <button onClick={create} disabled={busy} className={`mt-5 ${btn}`}>
          {busy ? 'Creating…' : 'Create session'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
