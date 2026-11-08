const CACHE_NAME = 'st-pauls-mobile-v1'; // Do not increment; using a Network-First strategy
const PRECACHE_ASSETS = [
    '/',
    '/site.webmanifest',
    '/css/app.css',
    '/js/app.js',
    '/images/android-chrome-192x192.png',
    '/images/android-chrome-512x512.png',
    '/images/icon-192x192-monochrome.png',
    '/images/icon-96x96-monochrome.png',
    '/images/apple-touch-icon.png',
    '/images/favicon-32x32.png',
    '/images/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // Bypass caching on localhost during development
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return;
    }

    // Bypass caching for API, authentication, and admin endpoints
    if (
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/auth') ||
        url.pathname.startsWith('/admin')
    ) {
        return;
    }

    // Navigation requests (HTML pages): Network-first with cache fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return caches.match('/');
                })
        );
        return;
    }

    // Static assets (CSS, JS, images, fonts): Network-first with cache fallback
    if (
        url.pathname.startsWith('/css/') ||
        url.pathname.startsWith('/js/') ||
        url.pathname.startsWith('/images/') ||
        url.pathname === '/site.webmanifest'
    ) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(request))
        );
        return;
    }
});

// --- Web Push Notifications ---

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (e) {
        payload = {
            title: "St Paul's League",
            body: event.data ? event.data.text() : 'Leaderboard ranking update!'
        };
    }

    const title = payload.title || "St Paul's League";
    const options = {
        body: payload.body || 'Your leaderboard ranking has changed!',
        icon: '/images/android-chrome-192x192.png',
        badge: '/images/icon-96x96-monochrome.png',
        tag: 'leaderboard-rank-change',
        renotify: true,
        data: {
            url: payload.url || '/'
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
