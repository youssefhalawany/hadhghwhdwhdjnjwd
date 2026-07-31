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

// 1. FCM Background Push Notification Listener
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

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

// 2. PWA OFFLINE CACHING & NAVIGATION FALLBACK ENGINE
const CACHE_NAME = 'circlek-pwa-v3';
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

  // Skip Firebase backend services
  if (url.origin.includes('firestore.googleapis.com') || 
      url.origin.includes('identitytoolkit') || 
      url.protocol === 'chrome-extension:') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/shift-reports/manager');
          }
        });
      })
  );
});
