/* =========================================================
   Service Worker — Control de Pacientes Ortopedia
   v3.26 — Cache offline + persistencia de almacenamiento.
   ========================================================= */
const CACHE_NAME = 'ortopedia-shell-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  // Forzar activación inmediata sin esperar a que se cierren las pestañas viejas
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cachear el shell — si alguno falla (ej. manifest no existe), no aborta toda la instalación
      return Promise.all(URLS_TO_CACHE.map(url =>
        cache.add(url).catch(e => console.warn('[SW] No se pudo cachear:', url, e))
      ));
    })
  );
});

self.addEventListener('activate', (event) => {
  // Limpiar caches viejos de versiones anteriores
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // No interceptar requests a Firebase / Google APIs / Drive — esos van directo a la red
  if (url.host.includes('firestore.googleapis.com') ||
      url.host.includes('firebaseio.com') ||
      url.host.includes('firebaseapp.com') ||
      url.host.includes('googleapis.com') ||
      url.host.includes('googleusercontent.com') ||
      url.host.includes('accounts.google.com') ||
      url.host.includes('gstatic.com') ||
      event.request.method !== 'GET') {
    return;   // dejar al navegador manejar
  }
  // Estrategia: network-first con fallback al cache, para que las actualizaciones del HTML
  // se vean rápidamente cuando hay red, pero la app abra offline si no hay red.
  event.respondWith(
    fetch(event.request).then(resp => {
      // Cache de oportunidad: si la respuesta es OK, actualizar el cache
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
      }
      return resp;
    }).catch(() =>
      caches.match(event.request).then(cached => cached || caches.match('./index.html'))
    )
  );
});

// Mensaje desde la página para forzar actualización inmediata (skipWaiting + activate)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
