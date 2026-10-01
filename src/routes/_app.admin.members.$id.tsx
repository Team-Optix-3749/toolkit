import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { ROLES, isOwner } from '~/lib/rbac'
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from '~/lib/types'
import type { ProfileRow } from '~/lib/types'
import { Badge } from '~/components/Badge'
import { card, cardHead, cardTitle, label, input, btn, btnGhost } from '~/lib/ui'

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
  const [permissions, setPermissions] = useState<string[]>([])
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  async function load() {
    const [{ data, error }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('hours_summary').select('build_hours, outreach_hours, total_hours').eq('user_id', id).maybeSingle(),
    ])
    if (error) return flash(error.message, true)
    const row = data as ProfileRow
    setP(row)
    setRole(row?.role ?? 'PENDING')
    setPermissions(row?.permissions ?? [])
    if (s) setSummary(s as Summary)
  }
  useEffect(() => { load() }, [id])

  function togglePerm(perm: Permission) {
    setPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    )
  }

  async function save() {
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ role, permissions }).eq('id', id)
    setBusy(false)
    if (error) return flash('Save failed: ' + error.message, true)
    flash('Member updated')
    load()
  }

  async function setAccountStatus(status: 'active' | 'deactivated' | 'rejected') {
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ account_status: status }).eq('id', id)
    setBusy(false)
    setConfirmAction(null)
    if (error) return flash(error.message, true)
    flash(`Account ${status}`)
    load()
  }

  if (!p) return <div className="bg-panel border border-line p-8 text-center text-sm text-ink-soft">Loading…</div>

  const assignable = isOwner(myRole) ? ROLES : ROLES.filter((r) => r !== 'OWNER' && r !== 'OFFICER')

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-2">
            <span className={cardTitle}>{p.display_name || 'Member'}</span>
            {p.account_status !== 'active' && (
              <Badge label={p.account_status} tone={p.account_status === 'deactivated' ? 'REJECTED' : 'REJECTED'} />
            )}
          </div>
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
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Permissions</label>
            <div className="grid sm:grid-cols-2 gap-1">
              {PERMISSIONS.map(perm => (
                <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-canvas px-2 py-1.5 select-none">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm)}
                    onChange={() => togglePerm(perm)}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  {PERMISSION_LABELS[perm]}
                </label>
              ))}
            </div>
          </div>

          <button onClick={save} disabled={busy} className={btn}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Account status</span>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-sm">
            Current status: <strong>{p.account_status}</strong>
          </div>
          {confirmAction ? (
            <div className="border border-[#c0392b]/30 bg-[#c0392b]/5 p-4 space-y-3">
              <p className="text-sm font-medium">
                Are you sure you want to {confirmAction} this account?
              </p>
              <p className="text-sm text-ink-soft">
                {confirmAction === 'deactivate' && 'The member will be locked out and see a deactivation notice.'}
                {confirmAction === 'reject' && 'The member will be locked out and see a rejection notice.'}
                {confirmAction === 'reactivate' && 'The member will regain access to the app.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (confirmAction === 'deactivate') setAccountStatus('deactivated')
                    else if (confirmAction === 'reject') setAccountStatus('rejected')
                    else if (confirmAction === 'reactivate') setAccountStatus('active')
                  }}
                  disabled={busy}
                  className={`h-9 px-4 text-sm font-medium border ${
                    confirmAction === 'reactivate'
                      ? 'border-ink bg-brand text-white'
                      : 'border-[#c0392b] text-[#c0392b] bg-[#fbeeec]'
                  }`}
                >
                  {busy ? '…' : `Yes, ${confirmAction}`}
                </button>
                <button onClick={() => setConfirmAction(null)} className={btnGhost}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {p.account_status === 'active' && (
                <button onClick={() => setConfirmAction('deactivate')} className={btnGhost}>
                  Deactivate account
                </button>
              )}
              {p.account_status === 'active' && p.role === 'PENDING' && (
                <button onClick={() => setConfirmAction('reject')} className={btnGhost}>
                  Reject account
                </button>
              )}
              {(p.account_status === 'deactivated' || p.account_status === 'rejected') && (
                <button onClick={() => setConfirmAction('reactivate')} className={btn}>
                  Reactivate account
                </button>
              )}
            </div>
          )}
        </div>
      </section>
      {Toast}
    </>
  )
}
