import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import type { BuildLocation } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/zones')({
  component: LocationsPage,
})

function LocationsPage() {
  const { flash, Toast } = useToast()
  const [locations, setLocations] = useState<BuildLocation[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('build_locations').select('*').order('name')
    if (error) return flash('Load failed: ' + error.message, true)
    setLocations((data as BuildLocation[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function create() {
    if (!name.trim()) return flash('Name required', true)
    setBusy(true)
    const { error } = await supabase.rpc('build_action', {
      payload: { action: 'location', name: name.trim() },
    })
    setBusy(false)
    if (error) return flash('Create failed: ' + error.message, true)
    flash('Location created')
    setName('')
    load()
  }

  async function rename(loc: BuildLocation) {
    const newName = prompt('New name:', loc.name)
    if (!newName || newName.trim() === loc.name) return
    const { error } = await supabase.rpc('build_action', {
      payload: { action: 'location', id: loc.id, name: newName.trim() },
    })
    if (error) return flash(error.message, true)
    flash('Renamed')
    load()
  }

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>New location</span>
        </div>
        <div className="p-5 flex items-end gap-3">
          <div className="flex-1">
            <label className={label}>Name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button onClick={create} disabled={busy} className={btn}>
            {busy ? 'Saving…' : 'Create'}
          </button>
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Locations ({locations.length})</span>
          <button onClick={load} className={btnGhost}>
            Refresh
          </button>
        </div>
        <div className="divide-y divide-line">
          {locations.map((loc) => (
            <div key={loc.id} className="px-5 py-3 flex items-center justify-between">
              <span className="font-medium">{loc.name}</span>
              <button onClick={() => rename(loc)} className="text-xs font-mono uppercase border border-line px-2 py-1 hover:bg-canvas">
                Rename
              </button>
            </div>
          ))}
          {locations.length === 0 && (
            <div className="px-5 py-6 text-center text-ink-soft text-sm">No locations yet.</div>
          )}
        </div>
      </section>
      {Toast}
    </>
  )
}
