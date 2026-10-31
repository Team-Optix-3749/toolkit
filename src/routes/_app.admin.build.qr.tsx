import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import { Select } from '~/components/Select'
import { CheckInQr } from '~/components/CheckInQr'
import { checkinUrl } from '~/components/QrScanner'
import type { BuildSession } from '~/lib/types'
import { card, cardHead, cardTitle, label } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/build/qr')({
  validateSearch: (s: Record<string, unknown>): { session?: string } => ({
    session: typeof s.session === 'string' ? s.session : undefined,
  }),
  component: QRManager,
})

function QRManager() {
  const { session } = Route.useSearch()
  const { flash, Toast } = useToast()
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [sessionId, setSessionId] = useState(session ?? '')

  useEffect(() => {
    const now = new Date().toISOString()
    supabase
      .from('build_sessions')
      .select('*')
      .eq('cancelled', false)
      .or(`closes_at.is.null,closes_at.gte.${now}`)
      .order('opens_at')
      .then(({ data }) => {
        const list = (data as BuildSession[]) || []
        setSessions(list)
        if (!sessionId && list[0]) setSessionId(list[0].id)
      })
  }, [])

  const issue = useCallback(async () => {
    if (!sessionId) { flash('Pick a session', true); return null }
    const { data, error } = await supabase.rpc('build_action', {
      payload: { action: 'qr', session_id: sessionId },
    })
    if (error) { flash('Generate failed: ' + error.message, true); return null }
    return data as { token: string; expires_at: string }
  }, [sessionId])

  const urlFor = useCallback((token: string) => checkinUrl('build/check-in', 'session', sessionId, token), [sessionId])

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Session QR code</span>
      </div>
      <div className="p-5 space-y-5">
        <div>
          <label className={label}>Session</label>
          <Select
            value={sessionId}
            onChange={setSessionId}
            placeholder={sessions.length === 0 ? 'No active sessions' : 'Select a session'}
            options={sessions.map((s) => ({ value: s.id, label: `${s.title} — ${fmtDateTime(s.opens_at)}` }))}
          />
        </div>

        {sessionId && (
          <div className="flex justify-center">
            <CheckInQr key={sessionId} issue={issue} urlFor={urlFor} onError={(m) => flash(m, true)} />
          </div>
        )}

        <p className="text-xs text-ink-soft">
          Display this QR on a screen at the build location. Members scan it with their phone camera (or in the app) to check in. The code refreshes every 45 seconds so it can't be shared remotely.
        </p>
      </div>
      {Toast}
    </section>
  )
}
