import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/notifications/preferences')({
  component: Preferences,
})

const TYPES: [string, string][] = [
  ['build_session', 'Build sessions'],
  ['outreach_event', 'Outreach events'],
  ['opi_status', 'OPI status changes'],
  ['purchase_status', 'Purchase decisions'],
  ['general', 'General announcements'],
]
const CHANNELS: [string, string][] = [
  ['in_app', 'In-app'],
  ['email', 'Email'],
]

type Prefs = Record<string, Record<string, boolean>>

const defaults = (): Prefs =>
  Object.fromEntries(TYPES.map(([t]) => [t, { in_app: true, email: false }]))

function Preferences() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [prefs, setPrefs] = useState<Prefs>(defaults())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('notification_preferences')
      .select('prefs')
      .eq('user_id', user!.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.prefs) setPrefs({ ...defaults(), ...(data.prefs as Prefs) })
      })
  }, [])

  function toggle(type: string, channel: string) {
    setPrefs((p) => ({ ...p, [type]: { ...p[type], [channel]: !p[type]?.[channel] } }))
  }

  async function save() {
    setBusy(true)
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user!.id, prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setBusy(false)
    flash(error ? 'Save failed: ' + error.message : 'Preferences saved', !!error)
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Notification preferences</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-soft">
            <th className="py-2 px-5 text-left font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line">Type</th>
            {CHANNELS.map(([, l]) => (
              <th key={l} className="py-2 px-5 text-center font-mono text-[11px] uppercase tracking-[0.06em] border-b border-line">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TYPES.map(([t, label]) => (
            <tr key={t} className="border-b border-line">
              <td className="py-2.5 px-5">{label}</td>
              {CHANNELS.map(([c]) => (
                <td key={c} className="py-2.5 px-5 text-center">
                  <input type="checkbox" checked={!!prefs[t]?.[c]} onChange={() => toggle(t, c)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-5">
        <button onClick={save} disabled={busy} className={btn}>
          {busy ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
      {Toast}
    </section>
  )
}
