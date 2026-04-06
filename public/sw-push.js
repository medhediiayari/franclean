// Custom service worker for Bipbip push notifications
// This file is injected into the Workbox-generated SW via vite-plugin-pwa

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, url, tag } = data;

    const options = {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      tag: tag || 'bipbip-notification',
      renotify: true,
      data: { url: url || '/' },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Ouvrir' },
      ],
    };

    event.waitUntil(self.registration.showNotification(title || 'Bipbip', options));
  } catch (err) {
    console.error('Push event error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
