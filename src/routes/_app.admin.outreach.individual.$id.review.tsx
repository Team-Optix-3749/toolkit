import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDate, fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { IndividualOutreach } from '~/lib/types'
import { card, cardHead, cardTitle, label, input } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/outreach/individual/$id/review')({
  component: IndividualOutreachReview,
})

const isImage = (u: string) => /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(u)
const isVideo = (u: string) => /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(u)

function IndividualOutreachReview() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [r, setR] = useState<IndividualOutreach | null>(null)
  const [memberName, setMemberName] = useState<string>('')
  const [credit, setCredit] = useState('')

  async function load() {
    const { data, error } = await supabase.from('individual_outreach').select('*').eq('id', id).maybeSingle()
    if (error) return flash(error.message, true)
    const row = data as IndividualOutreach
    setR(row)
    // Default credited hours to what they claimed, capped at the 6-hour ceiling.
    const fallback = Math.min(Number(row.hours), 6)
    setCredit(String(row.credited_hours ?? fallback))
    if (row?.user_id) {
      const { data: p } = await supabase.from('profiles').select('display_name').eq('id', row.user_id).maybeSingle()
      setMemberName((p as { display_name: string | null })?.display_name || '')
    }
  }
  useEffect(() => {
    load()
  }, [id])

  async function decide(status: 'APPROVED' | 'REJECTED') {
    if (!r) return
    let credited_hours: number | null = null
    if (status === 'APPROVED') {
      const n = parseFloat(credit)
      if (!Number.isFinite(n) || n < 0) return flash('Enter the hours to credit', true)
      credited_hours = n
    } else {
      credited_hours = 0
    }
    const { error } = await supabase
      .from('individual_outreach')
      .update({ status, credited_hours, reviewer_id: user!.id, decided_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return flash('Update failed: ' + error.message, true)
    await supabase.from('notifications').insert({
      user_id: r.user_id,
      type: 'outreach',
      title: status === 'APPROVED' ? 'Outreach hours approved' : 'Outreach hours rejected',
      body:
        status === 'APPROVED'
          ? `Your individual outreach for "${r.event_name}" was approved — ${credited_hours} hr${credited_hours === 1 ? '' : 's'} credited.`
          : `Your individual outreach for "${r.event_name}" was rejected.`,
      link: '/outreach',
    })
    flash(status === 'APPROVED' ? 'Approved' : 'Rejected')
    load()
  }

  if (!r) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Submission</span>
          <Badge label={r.status} tone={r.status} />
        </div>
        <div className="p-5 space-y-2 text-sm">
          <Row k="Member" v={memberName || r.full_name} />
          <Row k="Full name" v={r.full_name} />
          <Row k="Department" v={r.department || '—'} />
          <Row k="Event" v={r.event_name} />
          <Row k="Date" v={fmtDate(r.event_date)} />
          <Row k="Hours claimed" v={String(Number(r.hours))} />
          <Row k="People impacted" v={r.people_impacted == null ? '—' : String(r.people_impacted)} />
          <Row k="Submitted" v={fmtDateTime(r.created_at)} />
          <div className="pt-2">
            <div className="text-ink-soft mb-1">What they did</div>
            <p className="whitespace-pre-wrap">{r.what_you_did}</p>
          </div>
          <div className="pt-2">
            <div className="text-ink-soft mb-1">Community impact</div>
            <p className="whitespace-pre-wrap">{r.impact}</p>
          </div>
          {r.status !== 'PENDING' && (
            <Row k="Hours credited" v={r.credited_hours == null ? '—' : String(Number(r.credited_hours))} />
          )}

          {r.status === 'PENDING' && (
            <div className="pt-3 border-t border-line space-y-3">
              <div>
                <label className={label}>Hours to credit toward their total</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className={input}
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                />
                <p className="text-xs text-ink-soft mt-1">
                  Defaults to the hours claimed (capped at 6). Set to 0 to approve without adding hours. A
                  member's individual outreach is capped at 6 hours total.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decide('APPROVED')} className="h-9 px-4 text-sm font-medium bg-accent text-[#06080b] rounded-lg hover:brightness-110 inline-flex items-center justify-center transition-all">
                  Approve
                </button>
                <button onClick={() => decide('REJECTED')} className="h-9 px-4 text-sm font-medium border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10 rounded-lg hover:bg-[#c0392b]/20 inline-flex items-center justify-center transition-all">
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Visual proof · {r.proof_urls.length}</span>
        </div>
        <div className="p-5 space-y-4">
          {r.proof_urls.length === 0 && <p className="text-sm text-ink-soft">No proof attached.</p>}
          {r.proof_urls.map((url, i) => (
            <div key={url}>
              {isImage(url) ? (
                <img src={url} alt={`proof ${i + 1}`} className="max-w-full border border-line" />
              ) : isVideo(url) ? (
                <video src={url} controls className="max-w-full border border-line" />
              ) : (
                <a href={url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                  Open file {i + 1} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
      {Toast}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{k}</span>
      <span className="font-mono text-right">{v}</span>
    </div>
  )
}
