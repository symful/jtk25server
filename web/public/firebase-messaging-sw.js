// Firebase Messaging Service Worker for JTK25 Web SPA
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
importScripts('firebase-config.js');

firebase.initializeApp(self.FIREBASE_CONFIG);

const messaging = firebase.messaging();

// Handle background messages.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'JTK25';
  const body = payload.notification?.body || 'Ada pembaruan baru.';
  const url = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url },
  });
});

// Handle notification click — open/focus the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
