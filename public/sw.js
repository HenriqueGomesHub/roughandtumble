// Rough & Tumble PWA service worker.
//
// Goal: the page must ALWAYS boot fast — even on slow/flaky pub WiFi.
//
// The previous worker fetched the page with no timeout, so a slow network left
// a blank screen until someone refreshed. This version boots instantly: it
// serves the app shell + assets from cache the moment the network is slow, then
// the live data streams in over the network as soon as it's available.

const CACHE = 'rt-v3'
const SHELL = '/index.html'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function networkWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('sw-timeout')), ms)
    fetch(req).then(
      (res) => { clearTimeout(id); resolve(res) },
      (err) => { clearTimeout(id); reject(err) },
    )
  })
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  // Skip cross-origin (Supabase API, Google Fonts, ESPN images) — always live.
  if (!req.url.startsWith(self.location.origin)) return

  // Navigation (loading a page): boot from cache the instant the network is
  // slow, so the screen is never blank. Refresh the cached shell on success.
  if (req.mode === 'navigate') {
    e.respondWith(
      networkWithTimeout(req, 3000)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {})
            return res
          }
          // Bad response (404/5xx after a redeploy): prefer the good cached shell.
          return caches.match(SHELL).then((hit) => hit || res)
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || fetch(req))),
    )
    return
  }

  // Build assets are content-hashed and immutable: serve from cache, and store
  // on first fetch so the cached shell always has a complete, bootable set.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => hit)
    }),
  )
})
