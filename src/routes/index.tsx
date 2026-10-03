import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  return (
    <div className="min-h-dvh bg-canvas text-ink bg-ambient flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-accent rounded-xl grid place-items-center font-heading font-bold text-lg text-[#06080b] shrink-0">
            O
          </div>
          <div>
            <div className="text-base font-heading font-bold tracking-tight leading-tight">Optix Toolkit</div>
            <div className="text-xs text-ink-soft">Team 3749</div>
          </div>
        </div>

        <Link
          to="/login"
          className="block h-11 w-full bg-accent text-[#06080b] text-sm font-semibold text-center leading-[44px] rounded-lg hover:brightness-110 transition-all"
        >
          Log in
        </Link>
        <Link
          to="/signup"
          className="block h-11 w-full border border-white/10 bg-white/5 backdrop-blur text-sm font-medium text-center leading-[44px] rounded-lg hover:bg-white/10 mt-3 transition-all"
        >
          Create account
        </Link>

        <p className="text-xs text-ink-soft mt-8 text-center">Del Norte HS &middot; San Diego</p>
      </div>
    </div>
  )
}
