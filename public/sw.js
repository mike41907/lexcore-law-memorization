const CACHE_NAME = 'lexcore-v0.6.0'
const SCOPE_URL = self.registration.scope
const INDEX_URL = new URL('index.html', SCOPE_URL).href
const APP_SHELL = [
  new URL('./', SCOPE_URL).href,
  INDEX_URL,
  new URL('manifest.webmanifest', SCOPE_URL).href,
  new URL('icon.svg', SCOPE_URL).href,
  new URL('version.json', SCOPE_URL).href,
  new URL('official/commands/D0080070.json', SCOPE_URL).href,
  new URL('official/commands/D0080076.json', SCOPE_URL).href,
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('lexcore-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, response.clone())),
            )
          }
          return response
        })
        .catch(() => caches.match(INDEX_URL).then((cached) => cached ?? caches.match(SCOPE_URL))),
    )
    return
  }

  if (requestUrl.pathname.includes('/official/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())),
            )
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          throw new Error('Official law data is unavailable offline.')
        }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      if (response.ok && response.type === 'basic') {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())),
        )
      }
      return response
    })),
  )
})
