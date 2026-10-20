/**
 * public/service-worker.js — Web Push Service Worker
 *
 * Handles:
 *  - push events  → display a system notification strictly wrapped in event.waitUntil()
 *  - notificationclick → open / focus app tab strictly wrapped in event.waitUntil()
 */

const APP_ORIGIN = self.location.origin;
const ICON = APP_ORIGIN + "/favicon.png";

// ── Install: activate immediately ───────────────────────────────────────────
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

// ── Activate: claim all clients immediately ─────────────────────────────────
self.addEventListener("activate", function (event) {
  event.waitUntil(clients.claim());
});

// ── Push Event: Mobile Keep-Alive with event.waitUntil() ─────────────────────
self.addEventListener("push", function (event) {
  let title = "New Alert";
  let body = "Check your dashboard.";
  let url = APP_ORIGIN;
  let tag = "hemangi-notification";

  if (event.data) {
    try {
      const data = event.data.json();
      if (data && typeof data === "object") {
        if (data.title) title = data.title;
        if (data.body) body = data.body;
        if (data.url) url = data.url;
        if (data.tag) tag = data.tag;
      }
    } catch (err) {
      // If payload is plain text instead of JSON
      try {
        const rawText = event.data.text();
        if (rawText) body = rawText;
      } catch (_) {}
    }
  }

  const options = {
    body: body,
    icon: ICON,
    badge: ICON,
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: url },
  };

  // Strictly wrap showNotification inside event.waitUntil so mobile OS does not terminate the SW early
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click: Focus or Open App ───────────────────────────────────
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : APP_ORIGIN;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      // Focus existing tab if open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
