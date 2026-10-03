import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/owner/members')({
  component: OwnerMembers,
})

type Row = {
  id: string
  display_name: string | null
  role: string
  account_status: string
}

function OwnerMembers() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, account_status')
      .order('display_name')
    if (error) return flash(error.message, true)
    setRows((data as Row[]) || [])
  }
  useEffect(() => { load() }, [])

  async function hardDelete(id: string, name: string) {
    if (typed !== name) return flash('Confirmation text does not match', true)
    setBusy(true)
    const { error } = await supabase.rpc('owner_delete_member', { target_id: id })
    setBusy(false)
    setConfirmId(null)
    setTyped('')
    if (error) return flash('Delete failed: ' + error.message, true)
    flash('Member hard-deleted')
    load()
  }

  const filtered = rows.filter((r) =>
    !q || (r.display_name ?? '').toLowerCase().includes(q.toLowerCase()) || r.role.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>All members ({filtered.length})</span>
        <input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 px-3 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-accent focus:ring-1 focus:ring-accent w-48"
        />
      </div>
      <div className="divide-y divide-white/4">
        {filtered.map((m) => {
          const name = m.display_name || m.id.slice(0, 8)
          const isSelf = m.id === user?.id
          const confirming = confirmId === m.id
          return (
            <div key={m.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-ink-soft mt-0.5 font-mono">
                    {m.role} · {m.account_status} · {m.id.slice(0, 8)}
                  </div>
                </div>
                {isSelf ? (
                  <span className="text-[11px] font-mono uppercase text-ink-soft">You</span>
                ) : m.role === 'OWNER' ? (
                  <span className="text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded-md border border-accent/25 text-accent bg-accent/10">
                    Protected
                  </span>
                ) : confirming ? null : (
                  <button
                    onClick={() => { setConfirmId(m.id); setTyped('') }}
                    className="h-8 px-3 text-xs font-mono uppercase tracking-wide border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10 rounded-lg hover:bg-[#c0392b]/20 inline-flex items-center transition-all"
                  >
                    Hard delete
                  </button>
                )}
              </div>
              {confirming && (
                <div className="mt-3 p-4 bg-[#c0392b]/5 border border-[#c0392b]/20 rounded-lg">
                  <p className="text-sm text-[#f07070] font-medium mb-1">
                    This permanently deletes {name} and every record they created.
                  </p>
                  <p className="text-xs text-ink-soft mb-3">
                    Type the member's name <span className="font-mono text-ink">{name}</span> to confirm. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={name}
                      className="flex-1 h-9 px-3 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-[#c0392b] focus:ring-1 focus:ring-[#c0392b]"
                    />
                    <button
                      onClick={() => hardDelete(m.id, name)}
                      disabled={busy || typed !== name}
                      className="h-9 px-4 text-sm font-medium border border-[#c0392b]/40 text-[#f07070] bg-[#c0392b]/15 rounded-lg hover:bg-[#c0392b]/25 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition-all"
                    >
                      {busy ? '…' : 'Delete forever'}
                    </button>
                    <button
                      onClick={() => { setConfirmId(null); setTyped('') }}
                      className="h-9 px-4 text-sm text-ink-soft hover:text-ink rounded-lg inline-flex items-center justify-center transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-6 text-center text-ink-soft text-sm">No members match.</div>
        )}
      </div>
      {Toast}
    </section>
  )
}
