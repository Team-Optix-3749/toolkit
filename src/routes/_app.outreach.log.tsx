import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, label, input, textarea, btn } from '~/lib/ui'
import { DEPARTMENTS } from '~/lib/types'

export const Route = createFileRoute('/_app/outreach/log')({
  component: LogIndividualOutreach,
})

const MAX_FILES = 5

function LogIndividualOutreach() {
  const { user, profile } = useAuth()
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState({
    full_name: '',
    department: '',
    event_name: '',
    what_you_did: '',
    impact: '',
    hours: '',
    event_date: '',
    people_impacted: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  // Pre-fill name + department from the member's profile.
  useEffect(() => {
    if (profile)
      setF((prev) => ({
        ...prev,
        full_name: prev.full_name || profile.display_name || '',
        department: prev.department || profile.department || '',
      }))
  }, [profile])

  async function submit() {
    if (!f.full_name.trim()) return flash('Full name required', true)
    if (!f.event_name.trim()) return flash('Event name required', true)
    if (!f.what_you_did.trim()) return flash('Describe what you did', true)
    if (!f.impact.trim()) return flash('Describe the community impact', true)
    const hours = parseFloat(f.hours)
    if (!hours || hours <= 0) return flash('Enter the hours you did', true)
    if (!f.event_date) return flash('Date of event required', true)
    if (!files.length) return flash('Visual proof is required', true)
    if (files.length > MAX_FILES) return flash(`Upload at most ${MAX_FILES} files`, true)
    const people = parseInt(f.people_impacted, 10)
    if (!Number.isFinite(people) || people < 0) return flash('Enter how many people you impacted', true)

    setBusy(true)
    const proof_urls: string[] = []
    for (const file of files) {
      const path = `${user!.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('outreach-proofs').upload(path, file)
      if (upErr) {
        setBusy(false)
        return flash('Upload failed: ' + upErr.message, true)
      }
      proof_urls.push(supabase.storage.from('outreach-proofs').getPublicUrl(path).data.publicUrl)
    }

    const { error } = await supabase.from('individual_outreach').insert({
      user_id: user!.id,
      full_name: f.full_name.trim(),
      department: f.department || null,
      event_name: f.event_name.trim(),
      what_you_did: f.what_you_did.trim(),
      impact: f.impact.trim(),
      hours,
      event_date: f.event_date,
      proof_urls,
      people_impacted: people,
      status: 'PENDING',
    })
    setBusy(false)
    if (error) return flash('Submit failed: ' + error.message, true)
    flash('Submitted for review')
    navigate({ to: '/outreach' })
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Log individual outreach hours</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Full name</label>
            <input className={input} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </div>
          <div>
            <label className={label}>Department</label>
            <select className={input} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
              <option value="">—</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Name of the event</label>
          <input
            className={input}
            placeholder="e.g. Chem Tutoring · Food Bank Volunteering"
            value={f.event_name}
            onChange={(e) => setF({ ...f, event_name: e.target.value })}
          />
        </div>

        <div>
          <label className={label}>What did you do? (be descriptive)</label>
          <textarea rows={3} className={textarea} value={f.what_you_did} onChange={(e) => setF({ ...f, what_you_did: e.target.value })} />
        </div>

        <div>
          <label className={label}>How was this impactful to our community? (2-3 sentences max)</label>
          <textarea rows={3} className={textarea} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>Hours you did</label>
            <input type="number" step="0.5" min="0" className={input} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
          </div>
          <div>
            <label className={label}>Date of event</label>
            <input type="date" className={input} value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} />
          </div>
          <div>
            <label className={label}>People impacted</label>
            <input type="number" min="0" className={input} value={f.people_impacted} onChange={(e) => setF({ ...f, people_impacted: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-ink-soft">
          Enter the full hours you did. A maximum of 6 individual outreach hours count toward your total.
        </p>

        <div>
          <label className={label}>Visual proof (required · up to 5 images or videos)</label>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_FILES))}
            className="text-sm"
          />
          {files.length > 0 && (
            <ul className="mt-2 text-xs text-ink-soft font-mono space-y-0.5">
              {files.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          )}
        </div>

        <button onClick={submit} disabled={busy} className={btn}>
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
