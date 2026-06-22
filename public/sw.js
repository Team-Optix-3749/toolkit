// Optix service worker — dev-safe.
// - precaches the offline page + icons
// - navigations: network-first, fall back to /offline.html when offline
// - hashed build assets (/assets/*): stale-while-revalidate
// - everything else (Vite dev modules, Supabase, APIs): passthrough
const CACHE = 'optix-v1'
const PRECACHE = ['/offline.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // skip Supabase / cross-origin

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html').then((r) => r || Response.error())),
    )
    return
  }

  // Only cache built, content-hashed assets (safe to cache forever).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const copy = resp.clone()
              caches.open(CACHE).then((c) => c.put(request, copy))
            }
            return resp
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
  // else: passthrough (keeps Vite HMR working in dev)
})
