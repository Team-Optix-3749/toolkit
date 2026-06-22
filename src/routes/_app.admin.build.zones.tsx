import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { getPosition } from '~/lib/geo'
import type { Zone } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/zones')({
  component: ZonesPage,
})

const blank = { name: '', description: '', gps_lat: '', gps_lng: '', gps_radius_m: '100' }

function ZonesPage() {
  const { flash, Toast } = useToast()
  const [zones, setZones] = useState<Zone[]>([])
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('build_zones').select('*').order('name')
    if (error) return flash('Load failed: ' + error.message, true)
    setZones((data as Zone[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function useMyLocation() {
    const c = await getPosition()
    if (!c) return flash('Location unavailable', true)
    setForm((f) => ({ ...f, gps_lat: c.latitude.toFixed(6), gps_lng: c.longitude.toFixed(6) }))
  }

  async function create() {
    if (!form.name.trim()) return flash('Name required', true)
    setBusy(true)
    const { error } = await supabase.from('build_zones').insert({
      name: form.name.trim(),
      description: form.description || null,
      gps_lat: form.gps_lat ? Number(form.gps_lat) : null,
      gps_lng: form.gps_lng ? Number(form.gps_lng) : null,
      gps_radius_m: form.gps_radius_m ? Number(form.gps_radius_m) : 100,
      qr_token: crypto.randomUUID(),
      active: true,
    })
    setBusy(false)
    if (error) return flash('Create failed: ' + error.message, true)
    flash('Zone created')
    setForm(blank)
    load()
  }

  async function toggleActive(z: Zone) {
    const { error } = await supabase.from('build_zones').update({ active: !z.active }).eq('id', z.id)
    if (error) return flash(error.message, true)
    load()
  }

  async function regenToken(z: Zone) {
    const { error } = await supabase
      .from('build_zones')
      .update({ qr_token: crypto.randomUUID() })
      .eq('id', z.id)
    if (error) return flash(error.message, true)
    flash('QR token regenerated')
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this zone?')) return
    const { error } = await supabase.from('build_zones').delete().eq('id', id)
    if (error) return flash('Delete failed (in use?)', true)
    flash('Deleted')
    load()
  }

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>New zone</span>
        </div>
        <div className="p-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Name</label>
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={label}>Description</label>
              <input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className={label}>Latitude</label>
              <input className={input} value={form.gps_lat} onChange={(e) => setForm({ ...form, gps_lat: e.target.value })} />
            </div>
            <div>
              <label className={label}>Longitude</label>
              <input className={input} value={form.gps_lng} onChange={(e) => setForm({ ...form, gps_lng: e.target.value })} />
            </div>
            <div>
              <label className={label}>Radius (m)</label>
              <input type="number" className={input} value={form.gps_radius_m} onChange={(e) => setForm({ ...form, gps_radius_m: e.target.value })} />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={useMyLocation} className={btnGhost}>
                Use my location
              </button>
            </div>
          </div>
          <button onClick={create} disabled={busy} className={`mt-5 ${btn}`}>
            {busy ? 'Saving…' : 'Create zone'}
          </button>
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Zones ({zones.length})</span>
          <button onClick={load} className={btnGhost}>
            Refresh
          </button>
        </div>
        <div className="divide-y divide-line">
          {zones.map((z) => (
            <div key={z.id} className="px-5 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {z.name}{' '}
                  {!z.active && <span className="text-[11px] font-mono text-ink-soft">(inactive)</span>}
                </div>
                <div className="text-sm text-ink-soft font-mono">
                  {z.gps_lat != null ? `${z.gps_lat.toFixed(4)}, ${z.gps_lng?.toFixed(4)} · ${z.gps_radius_m}m` : 'no GPS'}
                  {' · QR '}
                  <span title={z.qr_token ?? ''}>{z.qr_token?.slice(0, 8)}…</span>
                </div>
                {z.description && <p className="text-sm text-ink-soft mt-0.5">{z.description}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(z)} className="text-xs font-mono uppercase border border-line px-2 py-1 hover:bg-canvas">
                    {z.active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => regenToken(z)} className="text-xs font-mono uppercase border border-line px-2 py-1 hover:bg-canvas">
                    New QR
                  </button>
                  <button onClick={() => del(z.id)} className="text-ink-soft hover:text-[#c0392b] px-1" title="Delete">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
          {zones.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No zones yet.</div>}
        </div>
      </section>
      {Toast}
    </>
  )
}
