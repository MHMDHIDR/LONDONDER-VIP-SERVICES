self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const title = data.title || 'New Notification';
    const options = {
      body: data.message || 'You have a new notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || `notification-${Date.now()}`,
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: data.link || '/',
      },
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        if ('setAppBadge' in navigator) {
          (navigator as any).setAppBadge().catch(() => {});
        }
      })
    );
  } catch (error) {
    console.error('Error parsing push event data:', error);
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: event.data.text(),
        icon: '/favicon.ico',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    (navigator as any).clearAppBadge().catch(() => {});
  }

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
