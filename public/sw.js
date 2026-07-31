importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyC28heBX9KUAK--AvXe1bTy06J9sss_C2Q",
  authDomain: "ckkk-576e7.firebaseapp.com",
  projectId: "ckkk-576e7",
  storageBucket: "ckkk-576e7.firebasestorage.app",
  messagingSenderId: "174398232186",
  appId: "1:174398232186:web:a94c68480f27e25a668dc3"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || "Circle K Notification";
  const notificationBody = payload.notification?.body || payload.data?.body || "Tap to view update.";
  const clickUrl = payload.data?.url || payload.notification?.click_action || '/financials/inputs/overview';

  const actions = payload.notification?.actions || [
    { action: 'open_overview', title: '💸 Safe Balance & Overview' }
  ];

  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-manager.png',
    badge: '/icons8-circled-k-50.png',
    vibrate: [200, 100, 200],
    data: { url: clickUrl },
    actions: actions,
    tag: payload.data?.tag || `circlek-alert-${Date.now()}`,
    renotify: true,
    requireInteraction: true
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let urlToOpen = event.notification.data?.url || '/financials/inputs/overview';

  if (event.action === 'open_overview') {
    urlToOpen = '/financials/inputs/overview';
  } else if (event.action === 'open_deposits') {
    urlToOpen = '/financials/inputs/deposits';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

const CACHE_NAME = 'circlek-pwa-v5';
const OFFLINE_URLS = [
  '/',
  '/manifest-manager.json',
  '/icon-manager.png',
  '/icons8-circled-k-50.png',
  '/shift-reports/manager',
  '/voids/manager',
  '/financials/inputs/overview',
  '/admin/product-lookup'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin.includes('firestore.googleapis.com') || 
      url.origin.includes('identitytoolkit') || 
      url.protocol === 'chrome-extension:') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          if (cachedPage) return cachedPage;

          const rootPage = await caches.match('/');
          if (rootPage) return rootPage;

          const shiftPage = await caches.match('/shift-reports/manager');
          if (shiftPage) return shiftPage;

          return new Response(
            `<!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <style>
                  body { background: #09090b; color: #fff; font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; }
                  .card { background: #18181b; border: 1px solid #27272a; padding: 24px; border-radius: 20px; max-width: 360px; margin: 40px auto; }
                  h2 { color: #e11937; margin: 0 0 10px 0; font-size: 20px; }
                  p { color: #a1a1aa; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5; }
                  button { background: #e11937; color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; font-size: 14px; cursor: pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h2>Circle K Offline</h2>
                  <p>Open app once with internet connection to cache pages for offline use.</p>
                  <button onclick="window.location.reload()">Retry Connection</button>
                </div>
              </body>
            </html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('', { status: 404 });
        });
    })
  );
});
