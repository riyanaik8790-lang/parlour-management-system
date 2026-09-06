/**
 * public/sw.js — Web Push Service Worker
 *
 * This file MUST live in /public/ so Vite copies it to the web root at build time.
 * It handles:
 *  - push events  → display a system notification (even when tab is not visible)
 *  - notificationclick → focus or open the app tab
 */

const APP_ORIGIN = self.location.origin;
const ICON = APP_ORIGIN + "/favicon.png";

// ── Push event ───────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Hemangi Makeover", body: "You have a new notification." };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "",
    icon: ICON,
    badge: ICON,
    tag: data.tag || "hemangi-notification",   // collapses duplicates
    renotify: true,
    data: { url: data.url || APP_ORIGIN },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : APP_ORIGIN;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing open tab if possible
        for (const client of windowClients) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Activate: take control immediately ───────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
