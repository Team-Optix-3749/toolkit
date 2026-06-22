import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '~/lib/auth'
import { label, input, btn } from '~/lib/ui'
import { AuthShell, OAuthButtons } from './login'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const { signUp, signInOAuth } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await signUp(email, password)
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: error })
    setMsg({
      type: 'ok',
      text: 'Account created. You can sign in once your account has been approved.',
    })
  }

  return (
    <AuthShell title="Create account">
      <form onSubmit={submit} className="space-y-4">
        <OAuthButtons onClick={signInOAuth} />
        <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wide text-ink-soft">
          <span className="h-px bg-line flex-1" /> or <span className="h-px bg-line flex-1" />
        </div>
        <div>
          <label className={label}>Email</label>
          <input type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={label}>Password</label>
          <input type="password" required minLength={6} className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && (
          <p className={`text-sm ${msg.type === 'err' ? 'text-[#c0392b]' : 'text-[#1a7f4b]'}`}>
            {msg.text}
          </p>
        )}
        <button disabled={busy} className={`w-full ${btn}`}>
          {busy ? '…' : 'Create account'}
        </button>
        <p className="text-center text-sm text-ink-soft">
          Have an account?{' '}
          <button
            type="button"
            onClick={() => navigate({ to: '/login' })}
            className="text-accent font-medium hover:underline"
          >
            Sign in
          </button>
        </p>
      </form>
    </AuthShell>
  )
}
