/**
 * public/sw.js — Web Push Service Worker
 *
 * Professional rich notification configuration:
 *  - High-res logo icon & Android monochrome status-bar badge
 *  - Short punchy title and clean body
 *  - Interactive Action buttons ('View Dashboard')
 *  - Reliable event.waitUntil keep-alive
 */

const APP_ORIGIN = self.location.origin;
const LOGO_ICON = APP_ORIGIN + "/logo.png";
const STATUS_BADGE = APP_ORIGIN + "/badge.png";

// ── Install: activate immediately ───────────────────────────────────────────
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

// ── Activate: claim all clients immediately ─────────────────────────────────
self.addEventListener("activate", function (event) {
  event.waitUntil(clients.claim());
});

// ── Push Event: Rich Notification Configuration ─────────────────────────────
self.addEventListener("push", function (event) {
  let title = "New Appointment!";
  let body = "A new appointment has been booked.";
  let url = APP_ORIGIN + "/admin";
  let tag = "hemangi-appointment";
  let icon = LOGO_ICON;
  let badge = STATUS_BADGE;

  if (event.data) {
    try {
      const data = event.data.json();
      if (data && typeof data === "object") {
        if (data.title) title = data.title;
        if (data.body) body = data.body;
        if (data.url) url = data.url;
        if (data.tag) tag = data.tag;
        if (data.icon) icon = data.icon;
        if (data.badge) badge = data.badge;
      }
    } catch (err) {
      // Plain text fallback
      try {
        const rawText = event.data.text();
        if (rawText) body = rawText;
      } catch (_) {}
    }
  }

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: url,
    },
    actions: [
      {
        action: "open_dashboard",
        title: "View Dashboard",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click: Handle Action Buttons & Keep-Alive ──────────────────
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  let targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : APP_ORIGIN + "/admin";

  // If user clicked the 'View Dashboard' action button explicitly
  if (event.action === "open_dashboard") {
    targetUrl = APP_ORIGIN + "/admin";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      // Focus existing tab if open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(APP_ORIGIN) && "focus" in client) {
          if ("navigate" in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
