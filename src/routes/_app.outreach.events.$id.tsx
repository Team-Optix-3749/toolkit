import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { can } from '~/lib/rbac'
import { fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import { CheckInQr } from '~/components/CheckInQr'
import { checkinUrl } from '~/components/QrScanner'
import type { OutreachEvent, OutreachAttendance, OutreachLead, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/outreach/events/$id')({
  component: EventDetail,
})

function EventDetail() {
  const { id } = Route.useParams()
  const { user, profile } = useAuth()
  const { flash, Toast } = useToast()
  const [ev, setEv] = useState<OutreachEvent | null>(null)
  const [attendance, setAttendance] = useState<OutreachAttendance[]>([])
  const [rsvps, setRsvps] = useState<string[]>([])
  const [leads, setLeads] = useState<string[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const uid = user!.id

  async function load() {
    const [{ data: e, error }, { data: att }, { data: rv }, { data: ld }] = await Promise.all([
      supabase.from('outreach_events').select('*').eq('id', id).maybeSingle(),
      supabase.from('outreach_attendance').select('*').eq('event_id', id),
      supabase.from('outreach_rsvps').select('member_id').eq('event_id', id),
      supabase.from('outreach_leads').select('member_id').eq('event_id', id),
    ])
    if (error) return flash(error.message, true)
    setEv(e as OutreachEvent)
    const attList = (att as OutreachAttendance[]) || []
    setAttendance(attList)
    const rsvpIds = ((rv as { member_id: string }[]) || []).map((r) => r.member_id)
    setRsvps(rsvpIds)
    const leadIds = ((ld as OutreachLead[]) || []).map((r) => r.member_id)
    setLeads(leadIds)

    const userIds = new Set<string>()
    attList.forEach((c) => userIds.add(c.member_id))
    rsvpIds.forEach((uid) => userIds.add(uid))
    leadIds.forEach((uid) => userIds.add(uid))
    if (userIds.size > 0) {
      const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', [...userIds])
      setProfiles(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '—'])))
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const myAttendance = attendance.find((c) => c.member_id === uid)
  const iRsvped = rsvps.includes(uid)
  const isLead = leads.includes(uid)
  const canManageAttendance = isLead || can(profile, 'manage_outreach_attendance')
  const canShowQr = canManageAttendance || can(profile, 'manage_outreach_events')
  const [qrFixed, setQrFixed] = useState(false)

  const issueQr = useCallback(async () => {
    const { data, error } = await supabase.rpc('outreach_action', {
      payload: { action: 'qr', event_id: id, fixed: qrFixed },
    })
    if (error) { flash('QR failed: ' + error.message, true); return null }
    return data as { token: string; expires_at: string }
  }, [id, qrFixed])
  const qrUrl = useCallback((token: string) => checkinUrl('outreach/check-in', 'event', id, token), [id])

  async function toggleRsvp() {
    setBusy(true)
    const { error } = await supabase.rpc('outreach_action', {
      payload: { action: 'rsvp', event_id: id, planned: !iRsvped },
    })
    setBusy(false)
    if (error) return flash(error.message, true)
    load()
  }

  async function toggleCancel() {
    if (!ev) return
    setBusy(true)
    const { error } = await supabase.rpc('outreach_action', {
      payload: { action: ev.cancelled ? 'restore' : 'cancel', id },
    })
    setBusy(false)
    if (error) return flash(error.message, true)
    flash(ev.cancelled ? 'Event restored' : 'Event cancelled')
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
          <span className="text-[11px] font-mono text-ink-soft">
            {attendance.length} attended · {rsvps.length} RSVPs
          </span>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row k="Starts" v={fmtDateTime(ev.starts_at)} />
          <Row k="Ends" v={ev.ends_at ? fmtDateTime(ev.ends_at) : '—'} />
          <Row k="Location" v={ev.location || '—'} />
          {leads.length > 0 && <Row k="Event leads" v={leads.map((lid) => profiles[lid] || '—').join(', ')} />}
          {ev.description && <p className="text-ink-soft pt-2 whitespace-pre-wrap">{ev.description}</p>}

          <div className="flex flex-wrap gap-2 pt-3">
            {!ev.cancelled && (
              <button onClick={toggleRsvp} disabled={busy} className={iRsvped ? btnGhost : btn}>
                {iRsvped ? 'Remove RSVP' : 'I plan to attend'}
              </button>
            )}
            {myAttendance && !myAttendance.departure && (
              <span className="text-sm text-[#1a7f4b]">Checked in</span>
            )}
            {myAttendance?.departure && (
              <span className="text-sm text-[#1a7f4b]">
                Attended · {myAttendance.credited_minutes ?? '—'} min credited
              </span>
            )}
          </div>

          {(can(profile, 'manage_outreach_events')) && (
            <div className="border-t border-line pt-3 flex gap-2">
              <button onClick={toggleCancel} disabled={busy} className={btnGhost}>
                {ev.cancelled ? 'Restore event' : 'Cancel event'}
              </button>
            </div>
          )}
        </div>
      </section>

      {canShowQr && !ev.cancelled && !(ev.ends_at && new Date(ev.ends_at) < new Date()) && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Check-in QR</span>
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10">
              {[
                { v: false, l: 'Rotating' },
                { v: true, l: 'Printable' },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => setQrFixed(o.v)}
                  className={`h-7 px-3 rounded-md text-xs transition-colors ${
                    qrFixed === o.v ? 'bg-accent/15 text-accent' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5 flex flex-col items-center gap-3">
            <CheckInQr key={String(qrFixed)} issue={issueQr} urlFor={qrUrl} rotating={!qrFixed} onError={(m) => flash(m, true)} />
            <p className="text-xs text-ink-soft text-center max-w-md">
              {qrFixed
                ? 'One code that works until the event ends — print it or post it at the venue. Anyone with the code can check in, so keep it on-site.'
                : 'Show this on your phone or a screen at the venue. Members scan it with their camera to check in. It refreshes every 60 seconds so it cannot be shared remotely.'}
            </p>
          </div>
        </section>
      )}

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>RSVPs ({rsvps.length})</span>
        </div>
        <div className="divide-y divide-line">
          {rsvps.map((mid) => (
            <div key={mid} className="px-5 py-2.5 text-sm">
              {profiles[mid] || mid.slice(0, 8)}
            </div>
          ))}
          {rsvps.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No RSVPs yet.</div>}
        </div>
      </section>

      {canManageAttendance && (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>Attendance ({attendance.length})</span>
          </div>
          <div className="divide-y divide-line">
            {attendance.map((c) => (
              <div key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{profiles[c.member_id] || c.member_id.slice(0, 8)}</span>
                  <span className="text-ink-soft ml-2">Arrived {fmtDateTime(c.arrival)}</span>
                  {c.departure && <span className="text-ink-soft ml-2">· Left {fmtDateTime(c.departure)}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.credited_minutes != null && <span className="text-xs font-mono text-ink-soft">{c.credited_minutes} min</span>}
                </div>
              </div>
            ))}
            {attendance.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No attendance records.</div>}
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
