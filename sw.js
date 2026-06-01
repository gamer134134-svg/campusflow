const CACHE_NAME = 'campusflow-cache-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './syllabus.json',
    './manifest.json',
    './app_icon.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    // If requesting the sync API, let it pass through to the local server
    if (e.request.url.includes('/api/sync')) {
        return;
    }
    
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            return cachedResponse || fetch(e.request).catch(() => {
                // Return cached index.html as fallback for navigations when offline
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
