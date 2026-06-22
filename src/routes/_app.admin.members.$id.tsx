import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { ROLES, isOwner } from '~/lib/rbac'
import type { ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/members/$id')({
  component: MemberDetail,
})

type Summary = { build_hours: number; outreach_hours: number; total_hours: number }

function MemberDetail() {
  const { id } = Route.useParams()
  const { role: myRole } = useAuth()
  const { flash, Toast } = useToast()
  const [p, setP] = useState<ProfileRow | null>(null)
  const [summary, setSummary] = useState<Summary>({ build_hours: 0, outreach_hours: 0, total_hours: 0 })
  const [perms, setPerms] = useState('')
  const [role, setRole] = useState('')

  async function load() {
    const [{ data, error }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('hours_summary').select('build_hours, outreach_hours, total_hours').eq('user_id', id).maybeSingle(),
    ])
    if (error) return flash(error.message, true)
    const row = data as ProfileRow
    setP(row)
    setRole(row?.role ?? 'PENDING')
    setPerms((row?.special_perms ?? []).join(', '))
    if (s) setSummary(s as Summary)
  }
  useEffect(() => {
    load()
  }, [id])

  async function save() {
    const special_perms = perms
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const { error } = await supabase.from('profiles').update({ role, special_perms }).eq('id', id)
    if (error) return flash('Save failed: ' + error.message, true)
    flash('Member updated')
    load()
  }

  if (!p) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  const assignable = isOwner(myRole) ? ROLES : ROLES.filter((r) => r !== 'OWNER' && r !== 'OFFICER')

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{p.display_name || 'Member'}</span>
          <span className="text-[11px] font-mono text-ink-soft">{p.grade ? `Grade ${p.grade}` : ''}</span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-line border-b border-line">
          {([['Build', summary.build_hours], ['Outreach', summary.outreach_hours], ['Total', summary.total_hours]] as [string, number][]).map(([k, v]) => (
            <div key={k} className="bg-panel px-4 py-4">
              <div className="font-mono text-2xl tabular-nums">{v}</div>
              <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft mt-1">{k} hrs</div>
            </div>
          ))}
        </div>
        {p.bio && <p className="p-5 text-sm text-ink-soft">{p.bio}</p>}
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Role & permissions</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={label}>Role</label>
            <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Special permissions (comma-separated)</label>
            <input
              className={input}
              placeholder="e.g. manage_zones, edit_hours"
              value={perms}
              onChange={(e) => setPerms(e.target.value)}
            />
          </div>
          <button onClick={save} className={btn}>
            Save changes
          </button>
        </div>
      </section>
      {Toast}
    </>
  )
}
