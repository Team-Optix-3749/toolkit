import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '~/lib/auth'
import { isRemembered } from '~/lib/supabase'
import { isApproved } from '~/lib/rbac'
import { label, input, btn } from '~/lib/ui'
import { ThemeToggle } from '~/components/ThemeToggle'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { user, role, loading, signInPassword, signInOAuth } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRememberMe] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Reflect the last-used choice (e.g. if they previously unchecked it).
  useEffect(() => setRememberMe(isRemembered()), [])

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: isApproved(role) ? '/dashboard' : '/pending-approval' })
    }
  }, [loading, user, role, navigate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { error } = await signInPassword(email, password, remember)
    setBusy(false)
    if (error) setErr(error)
  }

  return (
    <AuthShell title="Sign in">
      <form onSubmit={submit} className="space-y-4">
        <OAuthButtons onClick={(p) => signInOAuth(p, remember)} />
        <Divider />
        <div>
          <label className={label}>Email</label>
          <input type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={label}>Password</label>
          <input type="password" required className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft select-none cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Remember me on this device
        </label>
        {err && <p className="text-sm text-[#c0392b]">{err}</p>}
        <button disabled={busy} className={`w-full ${btn}`}>
          {busy ? '…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-ink-soft">
          No account?{' '}
          <Link to="/signup" className="text-accent font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-canvas px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="flex items-center mb-5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand text-white grid place-items-center font-mono font-semibold">
              O
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Optix</div>
              <div className="text-xs text-ink-soft">Robotics</div>
            </div>
          </Link>
          <ThemeToggle className="ml-auto h-8 w-8 grid place-items-center border border-line bg-panel text-ink-soft hover:text-ink text-sm" />
        </div>
        <div className="bg-panel border border-line">
          <div className="px-5 py-3 border-b border-line">
            <h1 className="text-sm font-semibold">{title}</h1>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function OAuthButtons({ onClick }: { onClick: (p: 'google' | 'discord') => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['google', 'discord'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onClick(p)}
          className="h-10 border border-line bg-panel text-sm font-medium hover:bg-canvas capitalize"
        >
          {p}
        </button>
      ))}
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wide text-ink-soft">
      <span className="h-px bg-line flex-1" /> or <span className="h-px bg-line flex-1" />
    </div>
  )
}
