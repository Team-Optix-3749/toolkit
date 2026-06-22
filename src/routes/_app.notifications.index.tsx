import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { fmtDateTime } from '~/lib/format'
import type { Notification } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/notifications/')({
  component: NotificationsFeed,
})

function NotificationsFeed() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Notification[]>([])

  async function load() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as Notification[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    load()
  }
  async function markAll() {
    const unread = rows.filter((r) => !r.read_at).map((r) => r.id)
    if (!unread.length) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread)
    flash('All marked read')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Notifications</span>
        <div className="flex items-center gap-3">
          <button onClick={markAll} className={btnGhost}>
            Mark all read
          </button>
          <Link to="/notifications/preferences" className="text-[11px] font-mono uppercase text-accent hover:underline">
            Preferences →
          </Link>
        </div>
      </div>
      <div className="divide-y divide-line">
        {rows.map((n) => (
          <div key={n.id} className={`px-5 py-3 flex items-start gap-3 ${n.read_at ? '' : 'bg-accent-soft/40'}`}>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />}
                {n.title}
              </div>
              {n.body && <p className="text-sm text-ink-soft mt-0.5">{n.body}</p>}
              <div className="text-[11px] font-mono uppercase tracking-wide text-ink-soft mt-1">
                {n.type} · {fmtDateTime(n.created_at)}
              </div>
            </div>
            {!n.read_at && (
              <button onClick={() => markRead(n.id)} className="text-[11px] font-mono uppercase text-accent hover:underline">
                Mark read
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && <div className="px-5 py-8 text-center text-ink-soft text-sm">No notifications.</div>}
      </div>
      {Toast}
    </section>
  )
}
