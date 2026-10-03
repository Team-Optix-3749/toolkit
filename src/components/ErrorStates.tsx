import { Link, type ErrorComponentProps } from '@tanstack/react-router'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-canvas text-ink px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-10 h-10 mx-auto mb-5 bg-accent text-[#06080b] grid place-items-center font-mono font-semibold rounded-lg">
          O
        </div>
        {children}
      </div>
    </div>
  )
}

/** Rendered by the router when a route throws. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unexpected error'
  return (
    <Shell>
      <h1 className="text-base font-semibold mb-1">Something went wrong</h1>
      <p className="text-sm text-ink-soft mb-5">
        The page hit an unexpected error. You can try again, or head back to the dashboard.
      </p>
      <p className="text-[11px] font-mono text-ink-soft/80 break-words mb-5">{message}</p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => reset()}
          className="h-9 px-4 bg-accent text-[#06080b] text-sm font-medium rounded-lg hover:brightness-110 inline-flex items-center justify-center transition-all"
        >
          Try again
        </button>
        <Link
          to="/dashboard"
          className="h-9 px-4 border border-white/10 bg-white/5 rounded-lg text-sm font-medium inline-flex items-center justify-center hover:bg-white/10 transition-all"
        >
          Dashboard
        </Link>
      </div>
    </Shell>
  )
}

/** Rendered by the router for unmatched URLs. */
export function NotFound() {
  return (
    <Shell>
      <div className="text-3xl font-mono font-semibold mb-1">404</div>
      <h1 className="text-base font-semibold mb-1">Page not found</h1>
      <p className="text-sm text-ink-soft mb-5">
        That page doesn't exist or may have moved.
      </p>
      <Link
        to="/dashboard"
        className="h-9 px-4 bg-accent text-[#06080b] text-sm font-medium rounded-lg hover:brightness-110 inline-flex items-center justify-center transition-all"
      >
        Back to dashboard
      </Link>
    </Shell>
  )
}
