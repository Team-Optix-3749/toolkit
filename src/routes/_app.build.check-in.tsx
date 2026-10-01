import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime, hoursFromMinutes } from '~/lib/format'
import type { BuildSession, BuildRecord } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/build/check-in')({
  component: CheckInFlow,
})

function CheckInFlow() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [open, setOpen] = useState<BuildRecord | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const now = new Date().toISOString()
    const [{ data: s }, { data: ci }] = await Promise.all([
      supabase
        .from('build_sessions')
        .select('*')
        .eq('cancelled', false)
        .lte('opens_at', now)
        .order('opens_at', { ascending: false })
        .limit(20),
      supabase
        .from('build_records')
        .select('*')
        .eq('member_id', user!.id)
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1),
    ])
    const available = ((s as BuildSession[]) || []).filter(
      (sess) => !sess.closes_at || new Date(sess.closes_at) > new Date(),
    )
    setSessions(available)
    setOpen(((ci as BuildRecord[]) || [])[0] ?? null)
    if (!sessionId && available[0]) setSessionId(available[0].id)
  }

  useEffect(() => {
    load()
  }, [])

  async function checkIn() {
    if (!sessionId) return flash('Pick a session', true)
    if (open) return flash('You already have an active check-in. Check out first.', true)
    if (!token.trim()) return flash('Scan or enter the QR token', true)

    setBusy(true)
    const { data, error } = await supabase.rpc('build_action', {
      payload: { action: 'check_in', session_id: sessionId, token: token.trim() },
    })
    setBusy(false)
    if (error) return flash('Check-in failed: ' + error.message, true)
    flash('Checked in')
    setToken('')
    load()
  }

  async function checkOut() {
    if (!open) return
    setBusy(true)
    const { data, error } = await supabase.rpc('build_action', {
      payload: { action: 'check_out', id: open.id },
    })
    setBusy(false)
    if (error) return flash('Check-out failed: ' + error.message, true)
    const mins = (data as any)?.credited_minutes
    flash(mins != null ? `Checked out, ${hoursFromMinutes(mins)} h logged` : 'Checked out')
    load()
  }

  if (open) {
    const elapsed = Math.round((Date.now() - new Date(open.check_in).getTime()) / 60000)
    return (
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Active check-in</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm">
            Checked in since <strong>{fmtDateTime(open.check_in)}</strong>.
          </p>
          <p className="text-sm text-ink-soft">Running time: ~{hoursFromMinutes(elapsed)} h</p>
          <button onClick={checkOut} disabled={busy} className={btn}>
            {busy ? 'Checking out…' : 'Check out now'}
          </button>
        </div>
        {Toast}
      </section>
    )
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Build check-in</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className={label}>Session</label>
          <select className={input} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.length === 0 && <option value="">No open sessions</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {fmtDateTime(s.opens_at)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>QR token</label>
          <input
            className={input}
            placeholder="Scan or paste the session QR code"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <button onClick={checkIn} disabled={busy || !sessionId} className={btn}>
          {busy ? 'Checking in…' : 'Check in'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
