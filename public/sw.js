// Service worker de «Rumbo a Ibiza»: todo el juego queda guardado para jugar sin conexión.
// Al compilar, vite.config.ts rellena VERSION y PRECACHE con los archivos reales de dist/.
const VERSION = 'dev'
const PRECACHE = []
const CACHE = `rumbo-a-ibiza-${VERSION}`
const INDEX = new URL('index.html', self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rumbo-a-ibiza-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function navigate(request) {
  // Red primero (para recibir actualizaciones); sin red, la portada guardada.
  try {
    const res = await fetch(request)
    if (res.ok) (await caches.open(CACHE)).put(INDEX, res.clone())
    return res
  } catch {
    return (await caches.match(INDEX)) ?? Response.error()
  }
}

async function asset(request) {
  // Los archivos llevan hash en el nombre: caché primero y, si falta, red y se guarda.
  const hit = await caches.match(request, { ignoreSearch: true })
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(request, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(request.mode === 'navigate' ? navigate(request) : asset(request))
})
