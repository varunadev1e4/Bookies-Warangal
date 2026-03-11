// Warangal Bookies — Service Worker v3
// Fixes: response clone bug, JS MIME type error, stale cache issues

const CACHE = 'wb-bookies-v3'

self.addEventListener('install', () => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Delete all old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  const url = e.request.url

  // Never intercept: Supabase API, Google Fonts, or any cross-origin request
  if (
    url.includes('supabase.co') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    !url.startsWith(self.location.origin)
  ) return

  // Never cache JS/CSS build assets — always fetch fresh
  // (Vite bundles have hashed filenames so stale cache = MIME type crashes)
  if (
    e.request.destination === 'script' ||
    e.request.destination === 'style' ||
    url.includes('/assets/')
  ) {
    e.respondWith(fetch(e.request))
    return
  }

  // For HTML navigation requests — network first, fall back to cached index
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Clone BEFORE doing anything else with the response
          const clone = response.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return response
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // For everything else (images, icons) — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          // Clone BEFORE putting in cache — this was the original bug
          const clone = response.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return response
      }).catch(() => new Response('Offline', { status: 503 }))
    })
  )
})
