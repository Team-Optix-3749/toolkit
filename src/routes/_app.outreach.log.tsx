import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { individualCredit, individualOutreachAction } from '~/lib/actions'
import { card, cardHead, cardTitle, label, input, textarea, btn } from '~/lib/ui'
import { DEPARTMENTS, type IndividualCredit, type Season } from '~/lib/types'

export const Route = createFileRoute('/_app/outreach/log')({ component: LogIndividualOutreach })
const VISUAL_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime']
const hours = (minutes: number) => (Number(minutes) / 60).toFixed(2)

function LogIndividualOutreach() {
  const { user, profile } = useAuth()
  const { flash, Toast } = useToast()
  const [f, setF] = useState({ full_name: '', department: '', event_name: '', what_you_did: '', impact: '', hours: '', event_date: '', people_impacted: '' })
  const [files, setFiles] = useState<File[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [credit, setCredit] = useState<IndividualCredit | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  useEffect(() => {
    if (profile) setF(prev => ({ ...prev, full_name: prev.full_name || profile.display_name || '', department: prev.department || profile.department || '' }))
  }, [profile])
  useEffect(() => {
    void supabase.from('seasons').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) { setError(error.message); return }
      const list = (data || []) as Season[]
      setSeasons(list); setSeasonId(list.find(s => s.is_current)?.id || '')
    })
  }, [])
  useEffect(() => {
    let active = true
    setCredit(null)
    if (seasonId) void individualCredit({ season_id: seasonId }).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setCredit(data)
    })
    return () => { active = false }
  }, [seasonId, success])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setSuccess(false)
    const amount = Number(f.hours) * 60
    const people = Number(f.people_impacted)
    if (!user || !seasonId) { setError('Select an existing season. If none exist, season setup is required.'); return }
    if (![f.full_name, f.event_name, f.what_you_did, f.impact].every(v => v.trim()) || !f.event_date) { setError('Complete all required fields.'); return }
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter positive finite hours.'); return }
    if (!f.people_impacted || !Number.isInteger(people) || people < 0) { setError('Enter a nonnegative whole number of people impacted.'); return }
    if (!files.length || files.length > 5 || files.some(file => !VISUAL_TYPES.includes(file.type) || file.size <= 0 || file.size > 50 * 1024 * 1024)) {
      setError('Choose one to five supported images or videos, each nonempty and at most 50 MiB.'); return
    }
    setBusy(true)
    const uploaded: string[] = []
    try {
      for (const file of files) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, '_')}`
        const { error } = await supabase.storage.from('outreach-proofs').upload(path, file, { contentType: file.type })
        if (error) throw error
        uploaded.push(path)
      }
      const { error } = await individualOutreachAction({ action: 'submit', season_id: seasonId, full_name: f.full_name.trim(), department: f.department || null,
        event_name: f.event_name.trim(), what_you_did: f.what_you_did.trim(), impact: f.impact.trim(), claimed_minutes: amount,
        event_date: f.event_date, people_impacted: people, proof_urls: uploaded })
      if (error) throw error
      setSuccess(true); setFiles([]); setF(prev => ({ ...prev, event_name: '', what_you_did: '', impact: '', hours: '', event_date: '', people_impacted: '' }))
      flash('Submitted for review')
    } catch (failure) {
      let message = failure instanceof Error ? failure.message : failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : 'Submission failed'
      if (uploaded.length) {
        const { error } = await supabase.storage.from('outreach-proofs').remove(uploaded)
        if (error) message += ` Uploaded proof cleanup failed: ${error.message}`
      }
      setError(message)
    } finally { setBusy(false) }
  }

  return <section className={card}>
    <div className={cardHead}><h1 className={cardTitle}>Log individual outreach hours</h1></div>
    <form onSubmit={submit} className="p-5 space-y-5">
      <p className="text-sm text-ink-soft">Approved individual outreach counts toward your selected season's official outreach total, up to its uniform cap. Requests may still be approved in full after you reach the cap.</p>
      <label className={label}>Season<select required className={input} value={seasonId} onChange={e => setSeasonId(e.target.value)}><option value="">Select a season</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' · Current' : ''}</option>)}</select></label>
      {!seasons.length && <p className="text-sm text-ink-soft">Season setup is required before submitting.</p>}
      {credit && <dl className="grid sm:grid-cols-2 gap-3 text-sm bg-surface p-4 border border-line">
        <div><dt>Raw approved individual hours</dt><dd>{hours(credit.raw_approved_minutes)}</dd></div>
        <div><dt>Season individual cap (hours)</dt><dd>{hours(credit.cap_minutes)}</dd></div>
        <div><dt>Counted individual hours</dt><dd>{hours(credit.counted_individual_minutes)}</dd></div>
        <div><dt>Official outreach hours (events + counted individual)</dt><dd>{hours(credit.official_outreach_minutes)}</dd></div>
      </dl>}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className={label}>Full name<input required className={input} value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></label>
        <label className={label}>Department<select className={input} value={f.department} onChange={e => setF({ ...f, department: e.target.value })}><option value="">Optional</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
        <label className={label}>Event name<input required className={input} value={f.event_name} onChange={e => setF({ ...f, event_name: e.target.value })} /></label>
        <label className={label}>Event date<input required type="date" className={input} value={f.event_date} onChange={e => setF({ ...f, event_date: e.target.value })} /></label>
        <label className={label}>Hours claimed<input required type="number" min="0" step="any" className={input} value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} /></label>
        <label className={label}>People impacted<input required type="number" min="0" step="1" className={input} value={f.people_impacted} onChange={e => setF({ ...f, people_impacted: e.target.value })} /></label>
      </div>
      <label className={label}>What you did<textarea required className={textarea} value={f.what_you_did} onChange={e => setF({ ...f, what_you_did: e.target.value })} /></label>
      <label className={label}>Community impact<textarea required className={textarea} value={f.impact} onChange={e => setF({ ...f, impact: e.target.value })} /></label>
      <label className={label}>Visual proof (1–5 images/videos, up to 50 MiB each)<input key={success ? 'submitted' : 'editing'} required type="file" multiple accept={VISUAL_TYPES.join(',')} className={input} onChange={e => setFiles(Array.from(e.target.files || []))} /></label>
      {files.length > 0 && <ul className="text-sm text-ink-soft">{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}</li>)}</ul>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {success && <p role="status" className="text-sm text-accent">Submitted for review. <Link to="/outreach/history" className="underline">View your history</Link>.</p>}
      <button type="submit" className={btn} disabled={busy || !seasonId}>{busy ? 'Submitting…' : 'Submit for review'}</button>
    </form>{Toast}
  </section>
}
