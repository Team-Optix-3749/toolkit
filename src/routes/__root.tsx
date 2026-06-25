import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { AuthProvider } from '../lib/auth'
import { isConfigured } from '../lib/supabase'
import { RouteError, NotFound } from '../components/ErrorStates'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  errorComponent: RouteError,
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Optix · Robotics' },
      { name: 'theme-color', content: '#3a5a40' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Optix' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', type: 'image/png', href: '/icon-192.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return (
    <RootDocument>
      {isConfigured ? (
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      ) : (
        <NotConfigured />
      )}
    </RootDocument>
  )
}

// Shown when the Supabase env vars are missing from the deploy — fail loudly
// with a clear message instead of letting every data call hang.
function NotConfigured() {
  return (
    <div className="min-h-dvh grid place-items-center bg-canvas text-ink px-4 text-center">
      <div className="max-w-sm">
        <div className="w-10 h-10 mx-auto mb-5 bg-brand text-white grid place-items-center font-mono font-semibold">
          O
        </div>
        <h1 className="text-base font-semibold mb-1">Not configured</h1>
        <p className="text-sm text-ink-soft">
          This deployment is missing its Supabase credentials. Set{' '}
          <code className="font-mono text-[12px]">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono text-[12px]">VITE_SUPABASE_ANON_KEY</code>, then redeploy.
        </p>
      </div>
    </div>
  )
}

const themeInit = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
