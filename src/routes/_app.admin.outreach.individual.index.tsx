import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { individualOutreachAction } from '~/lib/actions'
import { can } from '~/lib/rbac'
import { useToast } from '~/lib/toast'
import { fmtDate } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { IndividualOutreach, Season } from '~/lib/types'
import { card, cardHead, cardTitle, input, label, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/individual/')({ component: IndividualOutreachQueue })
const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']
function IndividualOutreachQueue() {
  const { profile } = useAuth()
  const allowed = can(profile, 'manage_outreach_attendance')
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<IndividualOutreach[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('PENDING')
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [cap, setCap] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  useEffect(() => {
    if (!allowed) return
    void supabase.from('seasons').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) { setError(error.message); return }
      const list = (data || []) as Season[]
      setSeasons(list); setSeasonId(list.find(s => s.is_current)?.id || '')
    })
  }, [allowed])
  useEffect(() => {
    const season = seasons.find(s => s.id === seasonId)
    setCap(season ? String(Number(season.individual_outreach_cap_minutes) / 60) : '')
  }, [seasonId, seasons])
  useEffect(() => {
    let active = true
    setRows([]); setNames({}); setError(''); setSuccess('')
    if (!allowed || !seasonId) return
    setLoading(true)
    void (async () => {
      try {
        const list: IndividualOutreach[] = []
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from('individual_outreach').select('*').eq('season_id', seasonId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499)
          if (error) throw error
          list.push(...(data || []) as IndividualOutreach[])
          if (!data || data.length < 500) break
        }
        const ids = [...new Set(list.map(r => r.user_id))]
        const directory: Record<string, string> = {}
        for (let offset = 0; offset < ids.length; offset += 100) {
          const { data, error } = await supabase.from('historical_profiles').select('id,display_name').in('id', ids.slice(offset, offset + 100))
          if (error) throw error
          for (const person of data || []) directory[person.id] = person.display_name || 'Retained member'
        }
        if (active) { setRows(list); setNames(directory) }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : 'Load failed')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [allowed, seasonId])
  const shown = useMemo(() => filter === 'ALL' ? rows : rows.filter(r => r.status === filter), [rows, filter])
  const pendingCount = rows.filter(r => r.status === 'PENDING').length
  async function saveCap() {
    const minutes = Number(cap) * 60
    setError(''); setSuccess('')
    if (cap === '' || !Number.isFinite(minutes) || minutes < 0) { setError('Enter a finite nonnegative cap in hours.'); return }
    setBusy(true)
    const { error } = await individualOutreachAction({ action: 'set_cap', season_id: seasonId, cap_minutes: minutes })
    setBusy(false)
    if (error) { setError(error.message); return }
    setSeasons(prev => prev.map(s => s.id === seasonId ? { ...s, individual_outreach_cap_minutes: minutes } : s))
    setSuccess('Season cap saved. All approved individual contributions in this season have been recalculated.'); flash('Cap saved')
  }
  if (!allowed) return <p role="alert" className="p-5">Manage outreach attendance permission required.</p>
  return <section className={card}>
    <div className={cardHead}><h1 className={cardTitle}>Individual outreach · {pendingCount} pending</h1></div>
    <div className="p-5 space-y-4">
      <label className={label}>Season<select className={input} value={seasonId} onChange={e => setSeasonId(e.target.value)}><option value="">Select a season</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' · Current' : ''}</option>)}</select></label>
      {!seasons.length && <p className="text-sm text-ink-soft">Season setup is required.</p>}
      <div className="flex flex-wrap gap-3 items-end"><label className={label}>Individual cap per member (hours)<input type="number" min="0" step="any" className={input} value={cap} onChange={e => setCap(e.target.value)} /></label><button className={btn} disabled={!seasonId || busy} onClick={saveCap}>{busy ? 'Saving…' : 'Save season cap'}</button></div>
      <p className="text-sm text-ink-soft">Approve the uncapped amount earned, up to the claim. Official individual credit is the lesser of each member's season approved total and this cap; event attendance is never capped. Changing the cap recalculates old approvals, not their approved amounts.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}{success && <p role="status" className="text-sm text-accent">{success}</p>}
      <div className="flex flex-wrap gap-2">{FILTERS.map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`text-xs font-mono px-3 py-2 border ${filter === f ? 'border-accent text-accent' : 'border-line text-ink-soft'}`}>{f}</button>)}</div>
    </div>
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Individual outreach review requests"><table className="w-full text-sm"><thead><tr>{['Date', 'Member', 'Event', 'Claimed hours', 'Approved hours (uncapped)', 'Status', 'Action'].map(h => <th key={h} className="py-2 px-5 text-left border-b border-line text-ink-soft">{h}</th>)}</tr></thead><tbody>
      {shown.map(r => <tr key={r.id} className="border-b border-line"><td className="py-2 px-5">{fmtDate(r.event_date)}</td><td className="py-2 px-5">{names[r.user_id] || r.full_name}</td><td className="py-2 px-5">{r.event_name}</td><td className="py-2 px-5">{(Number(r.claimed_minutes) / 60).toFixed(2)}</td><td className="py-2 px-5">{r.status === 'APPROVED' ? (Number(r.approved_minutes) / 60).toFixed(2) : '—'}</td><td className="py-2 px-5"><Badge label={r.status} tone={r.status} /></td><td className="py-2 px-5"><Link to="/admin/outreach/individual/$id/review" params={{ id: r.id }} className="text-accent underline">Review</Link></td></tr>)}
      {!shown.length && <tr><td colSpan={7} className="p-5 text-center text-ink-soft">{loading ? 'Loading…' : error ? 'Requests unavailable.' : !seasonId ? 'Select a season.' : 'No matching requests.'}</td></tr>}
    </tbody></table></div>{Toast}
  </section>
}
