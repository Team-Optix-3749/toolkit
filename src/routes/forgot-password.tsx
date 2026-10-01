import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/lib/supabase'
import { label, input, btn } from '~/lib/ui'
import { AuthShell } from './login'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setErr(null)
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setBusy(false)
    if (error) return setErr(error.message)
    setSent(true)
  }

  return (
    <AuthShell title="Reset password">
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-[#1a7f4b]">
            If an account exists for <strong>{email}</strong>, a reset link has been sent.
            Check your inbox.
          </p>
          <Link to="/login" className="text-sm text-accent font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-ink-soft">
            Enter your email and we'll send a link to reset your password.
          </p>
          <div>
            <label className={label}>Email</label>
            <input
              type="email"
              required
              className={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {err && <p className="text-sm text-[#c0392b]">{err}</p>}
          <button disabled={busy} className={`w-full ${btn}`}>
            {busy ? '…' : 'Send reset link'}
          </button>
          <p className="text-center text-sm text-ink-soft">
            <Link to="/login" className="text-accent font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
