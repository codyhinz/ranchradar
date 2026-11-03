/* Push handling for the service worker that vite-plugin-pwa generates (imported via
   workbox.importScripts in vite.config.ts). Payloads come from the send-reminders Edge Function:
   { title, body, tag, url }. Everything is shown as plain text by the system. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === 'string' && data.title ? data.title : 'RanchRadar';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    renotify: typeof data.tag === 'string',
    data: { url: typeof data.url === 'string' ? data.url : '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only ever open a page on this site.
  let target = new URL('/', self.location.origin);
  try {
    const url = new URL(event.notification.data?.url ?? '/', self.location.origin);
    if (url.origin === self.location.origin) target = url;
  } catch { /* keep the home page */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
