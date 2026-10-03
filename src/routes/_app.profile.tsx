import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '~/lib/auth'
import { supabase } from '~/lib/supabase'
import { card, cardHead, cardTitle, label, input, textarea, btn } from '~/lib/ui'
import { ROLES, ROLE_LABEL, roleLevel, type Role } from '~/lib/rbac'
import { DEPARTMENTS } from '~/lib/types'
import { Select } from '~/components/Select'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { user, profile, role, refresh } = useAuth()
  const [form, setForm] = useState({ display_name: '', department: '', grade: '', avatar_url: '', bio: '', displayed_role: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  async function changePassword() {
    if (pw.length < 6) return setPwMsg('Password must be at least 6 characters')
    setPwBusy(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    setPwMsg(error ? 'Failed: ' + error.message : 'Password updated')
    if (!error) setPw('')
  }

  useEffect(() => {
    if (profile)
      setForm({
        display_name: profile.display_name || '',
        department: profile.department || '',
        grade: profile.grade || '',
        avatar_url: profile.avatar_url || '',
        bio: profile.bio || '',
        displayed_role: profile.displayed_role || '',
      })
  }, [profile])

  async function save() {
    if (!form.display_name.trim()) return setMsg('Display name is required')
    setBusy(true)
    setMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name.trim(),
        department: form.department || null,
        grade: form.grade || null,
        avatar_url: form.avatar_url || null,
        bio: form.bio || null,
        displayed_role: form.displayed_role || null,
      })
      .eq('id', user!.id)
    setBusy(false)
    setMsg(error ? 'Save failed: ' + error.message : 'Saved')
    if (!error) refresh()
  }

  const providers = user?.app_metadata?.providers ?? user?.app_metadata?.provider ?? []
  const linked = Array.isArray(providers) ? providers : [providers].filter(Boolean)

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Account</span>
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-soft">
            {ROLE_LABEL[role as Role] ?? role}
          </span>
        </div>
        <div className="p-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Display name</label>
              <input className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <label className={label}>Department</label>
              <Select
                value={form.department}
                onChange={(v) => setForm({ ...form, department: v })}
                options={[{ value: '', label: '—' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className={label}>Grade / Year</label>
            <input className={input} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          </div>
          <div className="mt-4">
            <label className={label}>Avatar URL</label>
            <input className={input} value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
          </div>
          <div className="mt-4">
            <label className={label}>Bio</label>
            <textarea rows={4} className={textarea} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>

          {roleLevel(role) > roleLevel('MEMBER') && (
            <div className="mt-4">
              <label className={label}>Displayed role</label>
              <Select
                value={form.displayed_role}
                onChange={(v) => setForm({ ...form, displayed_role: v })}
                options={[
                  { value: '', label: `Default (${ROLE_LABEL[role as Role] ?? role})` },
                  ...ROLES
                    .filter((r) => r !== 'PENDING' && roleLevel(r) <= roleLevel(role))
                    .map((r) => ({ value: r, label: ROLE_LABEL[r] })),
                ]}
              />
              <p className="text-xs text-ink-soft mt-1.5">
                Other members see this role next to your name. Admin tools still use your real role.
              </p>
            </div>
          )}
          {msg && <p className="mt-3 text-sm text-ink-soft">{msg}</p>}
          <button onClick={save} disabled={busy} className={`mt-5 ${btn}`}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Sign-in & security</span>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-soft">Email</span>
            <span className="font-mono">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Linked accounts</span>
            <span className="font-mono capitalize">{linked.length ? linked.join(', ') : 'email'}</span>
          </div>
          <div className="pt-3 border-t border-line">
            <label className={label}>Change password</label>
            <div className="flex gap-2">
              <input
                type="password"
                minLength={6}
                placeholder="New password"
                className={input}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <button onClick={changePassword} disabled={pwBusy} className={btn.replace('px-6', 'px-4')}>
                {pwBusy ? '…' : 'Update'}
              </button>
            </div>
            {pwMsg && <p className="text-xs text-ink-soft mt-1">{pwMsg}</p>}
          </div>
        </div>
      </section>
    </>
  )
}
