import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { toISO } from '~/lib/format'
import { buildRRule, WEEKDAYS } from '~/lib/recurrence'
import type { Zone } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/schedule/new')({
  component: NewSession,
})

function NewSession() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [zones, setZones] = useState<Zone[]>([])
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    title: '',
    zone_id: '',
    starts_at: '',
    ends_at: '',
    short_notice: false,
    recurring: false,
    freq: 'WEEKLY' as 'WEEKLY' | 'DAILY',
    interval: '1',
    byday: [] as string[],
    count: '',
  })

  useEffect(() => {
    supabase
      .from('build_zones')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setZones((data as Zone[]) || []))
  }, [])

  function toggleDay(d: string) {
    setF((s) => ({
      ...s,
      byday: s.byday.includes(d) ? s.byday.filter((x) => x !== d) : [...s.byday, d],
    }))
  }

  async function create() {
    if (!f.title.trim()) return flash('Title required', true)
    if (!f.starts_at) return flash('Start time required', true)
    const rrule = f.recurring
      ? buildRRule({
          freq: f.freq,
          interval: Number(f.interval) || 1,
          byday: f.freq === 'WEEKLY' ? f.byday : undefined,
          count: f.count ? Number(f.count) : undefined,
        })
      : null
    setBusy(true)
    const { error } = await supabase.from('build_schedule').insert({
      created_by: user!.id,
      title: f.title.trim(),
      zone_id: f.zone_id || null,
      starts_at: toISO(f.starts_at),
      ends_at: f.ends_at ? toISO(f.ends_at) : null,
      rrule,
      is_recurring: f.recurring,
      short_notice: f.short_notice,
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
            <label className={label}>Zone</label>
            <select className={input} value={f.zone_id} onChange={(e) => setF({ ...f, zone_id: e.target.value })}>
              <option value="">- none -</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Starts</label>
            <input type="datetime-local" className={input} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
          </div>
          <div>
            <label className={label}>Ends</label>
            <input type="datetime-local" className={input} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.short_notice} onChange={(e) => setF({ ...f, short_notice: e.target.checked })} />
            Short notice
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} />
            Recurring
          </label>
        </div>

        {f.recurring && (
          <div className="mt-4 border border-line p-4 space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className={label}>Frequency</label>
                <select className={input} value={f.freq} onChange={(e) => setF({ ...f, freq: e.target.value as 'WEEKLY' | 'DAILY' })}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="DAILY">Daily</option>
                </select>
              </div>
              <div>
                <label className={label}>Every (interval)</label>
                <input type="number" min="1" className={input} value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })} />
              </div>
              <div>
                <label className={label}>Count (optional)</label>
                <input type="number" min="1" className={input} value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} />
              </div>
            </div>
            {f.freq === 'WEEKLY' && (
              <div>
                <label className={label}>On days</label>
                <div className="flex gap-1 flex-wrap">
                  {WEEKDAYS.map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleDay(v)}
                      className={`h-8 px-3 text-xs border ${
                        f.byday.includes(v) ? 'bg-brand text-white border-ink' : 'bg-panel border-line hover:bg-canvas'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={create} disabled={busy} className={`mt-5 ${btn}`}>
          {busy ? 'Creating…' : 'Create session'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
