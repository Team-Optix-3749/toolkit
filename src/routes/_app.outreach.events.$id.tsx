import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { isAdmin } from '~/lib/rbac'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { OutreachEvent, OutreachCheckin, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/events/$id')({
  component: EventDetail,
})

function EventDetail() {
  const { id } = Route.useParams()
  const { user, role, profile } = useAuth()
  const { flash, Toast } = useToast()
  const [ev, setEv] = useState<OutreachEvent | null>(null)
  const [checkins, setCheckins] = useState<OutreachCheckin[]>([])
  const [planned, setPlanned] = useState<string[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const admin = isAdmin(role)
  const uid = user!.id

  async function load() {
    const [{ data: e, error }, { data: ci }, { data: pa }] = await Promise.all([
      supabase.from('outreach_events').select('*').eq('id', id).maybeSingle(),
      supabase.from('outreach_checkins').select('*').eq('event_id', id),
      supabase.from('outreach_planned_attendance').select('user_id').eq('event_id', id),
    ])
    if (error) return flash(error.message, true)
    setEv(e as OutreachEvent)
    const list = (ci as OutreachCheckin[]) || []
    setCheckins(list)
    setPlanned((pa as { user_id: string }[] || []).map(r => r.user_id))

    const userIds = new Set<string>()
    list.forEach(c => userIds.add(c.user_id))
    ;(pa as { user_id: string }[] || []).forEach(r => userIds.add(r.user_id))
    if ((e as OutreachEvent)?.lead_ids) (e as OutreachEvent).lead_ids.forEach(lid => userIds.add(lid))
    if (userIds.size > 0) {
      const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', [...userIds])
      setProfiles(Object.fromEntries((p as ProfileRow[] || []).map(x => [x.id, x.display_name || '—'])))
    }
  }

  useEffect(() => { load() }, [id])

  const mineIn = checkins.some(c => c.user_id === uid)
  const myCheckin = checkins.find(c => c.user_id === uid)
  const iPlanned = planned.includes(uid)
  const isLead = ev?.lead_ids?.includes(uid) || false
  const canManageAttendance = admin || isLead || profile?.permissions?.includes('manage_outreach_attendance')

  async function togglePlan() {
    setBusy(true)
    if (iPlanned) {
      await supabase.from('outreach_planned_attendance').delete().eq('event_id', id).eq('user_id', uid)
    } else {
      await supabase.from('outreach_planned_attendance').insert({ event_id: id, user_id: uid })
    }
    setBusy(false)
    load()
  }

  async function toggleCancel() {
    if (!ev) return
    setBusy(true)
    const { error } = await supabase.from('outreach_events').update({ cancelled: !ev.cancelled }).eq('id', id)
    setBusy(false)
    if (error) return flash(error.message, true)
    flash(ev.cancelled ? 'Event restored' : 'Event cancelled')
    load()
  }

  async function markDeparture(checkinId: string) {
    setBusy(true)
    const now = new Date().toISOString()
    const ci = checkins.find(c => c.id === checkinId)
    const credited = ci ? Math.round((new Date(now).getTime() - new Date(ci.checked_in_at).getTime()) / 60000) : null
    const { error } = await supabase.from('outreach_checkins').update({
      departed_at: now,
      credited_minutes: credited,
    }).eq('id', checkinId)
    setBusy(false)
    if (error) return flash(error.message, true)
    flash('Departure recorded')
    load()
  }

  if (!ev) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <span className={cardTitle}>{ev.title}</span>
            {ev.cancelled && <Badge label="Cancelled" tone="REJECTED" />}
          </div>
          <span className="text-[11px] font-mono text-ink-soft">{checkins.length} checked in · {planned.length} planned</span>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row k="Starts" v={fmtDateTime(ev.starts_at)} />
          <Row k="Ends" v={ev.ends_at ? fmtDateTime(ev.ends_at) : '—'} />
          <Row k="Location" v={ev.location || '—'} />
          {ev.lead_ids.length > 0 && (
            <Row k="Event leads" v={ev.lead_ids.map(lid => profiles[lid] || '—').join(', ')} />
          )}
          {ev.description && <p className="text-ink-soft pt-2 whitespace-pre-wrap">{ev.description}</p>}

          <div className="flex flex-wrap gap-2 pt-3">
            {!ev.cancelled && (
              <button onClick={togglePlan} disabled={busy} className={iPlanned ? btnGhost : btn}>
                {iPlanned ? 'Remove from plan' : 'I plan to attend'}
              </button>
            )}
            {!ev.cancelled && !mineIn && (
              <Link to="/outreach/check-in" className={btn}>Check in</Link>
            )}
            {mineIn && !myCheckin?.departed_at && (
              <button onClick={() => markDeparture(myCheckin!.id)} disabled={busy} className={btnGhost}>
                Record departure
              </button>
            )}
            {mineIn && myCheckin?.departed_at && (
              <span className="text-sm text-[#1a7f4b]">
                Departed · {myCheckin.credited_minutes ?? '—'} min credited
              </span>
            )}
            {mineIn && !myCheckin?.departed_at && (
              <span className="text-sm text-[#1a7f4b]">Checked in</span>
            )}
          </div>

          {(admin || profile?.permissions?.includes('manage_outreach_events')) && (
            <div className="border-t border-line pt-3 flex gap-2">
              <button onClick={toggleCancel} disabled={busy} className={btnGhost}>
                {ev.cancelled ? 'Restore event' : 'Cancel event'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Planned attendance */}
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Planned attendance ({planned.length})</span>
        </div>
        <div className="divide-y divide-line">
          {planned.map(uid => (
            <div key={uid} className="px-5 py-2.5 text-sm">{profiles[uid] || uid.slice(0, 8)}</div>
          ))}
          {planned.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No one has planned to attend yet.</div>}
        </div>
      </section>

      {/* Attendance */}
      {(admin || canManageAttendance) && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Attendance ({checkins.length})</span>
          </div>
          <div className="divide-y divide-line">
            {checkins.map(c => (
              <div key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{profiles[c.user_id] || c.user_id.slice(0, 8)}</span>
                  <span className="text-ink-soft ml-2">Arrived {fmtDateTime(c.checked_in_at)}</span>
                  {c.departed_at && <span className="text-ink-soft ml-2">· Left {fmtDateTime(c.departed_at)}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.credited_minutes != null && (
                    <span className="text-xs font-mono text-ink-soft">{c.credited_minutes} min</span>
                  )}
                  {!c.departed_at && canManageAttendance && (
                    <button onClick={() => markDeparture(c.id)} disabled={busy} className={btnGhost}>
                      Depart
                    </button>
                  )}
                </div>
              </div>
            ))}
            {checkins.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No check-ins yet.</div>}
          </div>
        </section>
      )}

      {Toast}
    </>
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
