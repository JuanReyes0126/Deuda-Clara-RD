/**
 * Service Worker para Deuda Clara RD
 * Implementa cache-first strategy para assets estáticos
 * y network-first para datos dinámicos
 */

const CACHE_NAME = 'deuda-clara-v1';
const STATIC_CACHE = 'deuda-clara-static-v1';
const DYNAMIC_CACHE = 'deuda-clara-dynamic-v1';

// Recursos críticos para cachear inmediatamente
const CRITICAL_ASSETS = [
  '/',
  '/manifest.json',
  '/brand/deuda-clara-logo-20260408.png',
  '/brand/deuda-clara-favicon-20260408.ico',
];

// Instalación - Cachear recursos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Cacheando recursos críticos');
      return cache.addAll(CRITICAL_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación - Limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[Service Worker] Eliminando cache antiguo:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Estrategia híbrida
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar solicitudes del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // Ignorar solicitudes que no sean GET
  if (request.method !== 'GET') {
    return;
  }

  // Estrategia Cache First para assets estáticos
  if (
    request.url.includes('/brand/') ||
    request.url.includes('.png') ||
    request.url.includes('.ico') ||
    request.url.includes('.css') ||
    request.url.includes('.js')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          // Clonar la respuesta para cachear
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        });
      }).catch(() => {
        // Fallback offline
        if (request.destination === 'image') {
          return caches.match('/brand/deuda-clara-logo-20260408.png');
        }
      })
    );
    return;
  }

  // Estrategia Network First para HTML y API
  if (
    request.url.includes('/api/') ||
    request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Default: Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, networkResponse.clone());
        });
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background Sync (para cuando esté disponible)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-deudas') {
    event.waitUntil(syncDeudas());
  }
});

async function syncDeudas() {
  // Lógica de sincronización en segundo plano
  console.log('[Service Worker] Sincronizando deudas...');
}
