import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { fmtDateTime } from '~/lib/format'
import type { OpiComment, ProfileRow } from '~/lib/types'
import { textarea, btn } from '~/lib/ui'

export function OpiComments({ initiativeId }: { initiativeId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<OpiComment[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('opi_comments')
      .select('*')
      .eq('initiative_id', initiativeId)
      .order('created_at', { ascending: true })
    const list = (data as OpiComment[]) || []
    setComments(list)
    const ids = [...new Set(list.map((c) => c.user_id))]
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, display_name').in('id', ids)
      setNames(Object.fromEntries(((p as ProfileRow[]) || []).map((x) => [x.id, x.display_name || '—'])))
    }
  }
  useEffect(() => {
    load()
  }, [initiativeId])

  async function post() {
    if (!body.trim()) return
    setBusy(true)
    const { error } = await supabase
      .from('opi_comments')
      .insert({ initiative_id: initiativeId, user_id: user!.id, body: body.trim() })
    setBusy(false)
    if (!error) {
      setBody('')
      load()
    }
  }

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="border-l-2 border-line pl-3">
          <div className="text-[11px] font-mono uppercase tracking-wide text-ink-soft">
            {names[c.user_id] || 'member'} · {fmtDateTime(c.created_at)}
          </div>
          <p className="text-sm whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}
      {comments.length === 0 && <p className="text-sm text-ink-soft">No comments yet.</p>}
      <div className="pt-2">
        <textarea rows={3} className={textarea} placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={post} disabled={busy} className={`mt-2 ${btn.replace('h-10', 'h-9')} px-4 text-sm`}>
          {busy ? 'Posting…' : 'Comment'}
        </button>
      </div>
    </div>
  )
}
