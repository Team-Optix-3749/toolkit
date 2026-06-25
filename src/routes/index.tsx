import { createFileRoute, Link } from '@tanstack/react-router'
import { ThemeToggle } from '~/components/ThemeToggle'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="bg-brand text-white sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-5 h-[52px] flex items-center gap-2.5">
          <div className="w-7 h-7 bg-accent grid place-items-center font-mono font-semibold text-[13px]">
            O
          </div>
          <span className="font-semibold tracking-tight">Optix</span>
          <span className="hidden sm:inline text-white/30">/</span>
          <span className="hidden sm:inline text-sm text-white/70">Robotics</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="h-8 w-8 grid place-items-center border border-white/20 text-white/70 hover:text-white hover:bg-white/10 text-sm" />
            <Link to="/login" className="text-sm text-white/80 hover:text-white px-3">
              Log in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-medium bg-accent px-3 h-8 inline-flex items-center"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-20">
        <h1 className="text-4xl font-bold tracking-tight max-w-2xl">
          [tagline]
        </h1>
        <p className="mt-4 text-lg text-ink-soft max-w-xl">
          [description]
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/signup"
            className="h-11 px-6 bg-brand text-white text-sm font-medium inline-flex items-center hover:bg-black"
          >
            Get started
          </Link>
          <Link
            to="/login"
            className="h-11 px-6 border border-line bg-panel text-sm font-medium inline-flex items-center hover:bg-canvas"
          >
            Log in
          </Link>
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-px bg-line border border-line">
          {[
            ['Feature one', 'Placeholder description for the first feature goes here.'],
            ['Feature two', 'Placeholder description for the second feature goes here.'],
            ['Feature three', 'Placeholder description for the third feature goes here.'],
          ].map(([t, d]) => (
            <div key={t} className="bg-panel p-5">
              <div className="text-sm font-semibold">{t}</div>
              <p className="text-sm text-ink-soft mt-1">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
