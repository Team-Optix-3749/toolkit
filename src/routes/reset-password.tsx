import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { label, input, btn } from '~/lib/ui'
import { AuthShell } from './login'
import { pendingInvitation, rememberInvitation } from '~/lib/invitation'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    rememberInvitation(pendingInvitation())
    let active = true
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    void supabase.auth.getSession().then(({data,error}) => {
      if (!active) return
      if (error) setErr(error.message)
      else if (data.session) setReady(true)
      else setErr('This recovery link is invalid or expired. Request a new one.')
    })
    return () => { active=false; subscription.unsubscribe() }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setErr('Password must be at least 6 characters.')
    if (password !== confirm) return setErr('Passwords do not match.')
    setBusy(true)
    setErr(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setErr(error.message)
    setDone(true)
    const code=pendingInvitation()
    if(code) void navigate({to:'/invite',search:{code}})
    else void navigate({to:'/dashboard'})
  }

  if (!ready && !done) {
    return (
      <AuthShell title="Reset password">
        <div className="space-y-4">
          {err && <p role="alert" className="text-danger">{err}</p>}
          <p className="text-sm text-ink-soft">
            Verifying your reset link…
          </p>
          <p className="text-sm text-ink-soft">
            If this takes too long, the link may have expired.{' '}
            <Link to="/forgot-password" className="text-accent font-medium hover:underline">
              Request a new one
            </Link>
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Set new password">
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-[#1a7f4b]">Password updated. Redirecting…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={label}>New password</label>
            <input
              type="password"
              required
              minLength={6}
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Confirm password</label>
            <input
              type="password"
              required
              minLength={6}
              className={input}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {err && <p className="text-sm text-[#c0392b]">{err}</p>}
          <button disabled={busy} className={`w-full ${btn}`}>
            {busy ? '…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
