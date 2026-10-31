import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { teamDateTime, teamInput } from '~/lib/time'
import { TeamDateTimeInput, type TimeDisambiguation } from '~/components/TeamDateTimeInput'
import type { BuildLocation, Season } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/schedule/new')({
  component: NewSession,
})

function NewSession() {
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [locations, setLocations] = useState<BuildLocation[]>([])
  const [seasons,setSeasons] = useState<Season[]>([])
  const [seasonId,setSeasonId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [opensChoice, setOpensChoice] = useState<TimeDisambiguation>('reject')
  const [closesChoice, setClosesChoice] = useState<TimeDisambiguation>('reject')
  const [f, setF] = useState(() => ({
    title: '',
    location_id: '',
    opens_at: teamInput(),
    closes_at: '',
  }))

  useEffect(() => {
    void supabase.from('seasons').select('*').order('name').then(({data,error})=>{if(error)setError(error.message);else {setSeasons(data as Season[]);setSeasonId(data.find((s:Season)=>s.is_current)?.id??'')}})
    supabase
      .from('build_locations')
      .select('*')
      .order('name')
      .then(({ data }) => setLocations((data as BuildLocation[]) || []))
  }, [])

  async function create() {
    setError('')
    if (!f.title.trim()) return setError('Title required')
    if (!f.opens_at) return setError('Opens at required')
    if (!f.closes_at || !f.location_id || !seasonId) return setError('Close, location and season are required')
    setBusy(true)
    try {
      const opens_at = teamDateTime(f.opens_at, opensChoice)
      const closes_at = f.closes_at ? teamDateTime(f.closes_at, closesChoice) : null
      const { error } = await supabase.rpc('build_action', {
        payload: {
          action: 'session',
          title: f.title.trim(),
          location_id: f.location_id || null,
          season_id: seasonId,
          opens_at,
          closes_at,
        },
      })
      if (error) throw error
      flash('Session created')
      navigate({ to: '/admin/build/schedule' })
    } catch (error) {
      setError('Create failed: ' + (error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>New build session</span>
      </div>
      <div className="p-5">
        <label className={label}>Season<select className={input} value={seasonId} onChange={event=>setSeasonId(event.target.value)}><option value="">Choose season</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
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
          <TeamDateTimeInput label="Opens at" value={f.opens_at} disambiguation={opensChoice} onChange={(value) => setF({ ...f, opens_at: value })} onDisambiguationChange={setOpensChoice} />
          <TeamDateTimeInput label="Closes at" value={f.closes_at} disambiguation={closesChoice} onChange={(value) => setF({ ...f, closes_at: value })} onDisambiguationChange={setClosesChoice} />
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <button onClick={create} disabled={busy} className={`mt-5 ${btn}`}>
          {busy ? 'Creating…' : 'Create session'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
