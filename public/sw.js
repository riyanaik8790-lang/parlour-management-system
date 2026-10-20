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

console.log("[SW] Service worker script loaded. Origin:", APP_ORIGIN);

// ── Install: log so we know the SW file was parsed ───────────────────────────

self.addEventListener("install", (event) => {
  console.log("[SW] Install event fired — skipWaiting to activate immediately.");
  self.skipWaiting();
});

// ── Activate: take control immediately ───────────────────────────────────────

self.addEventListener("activate", (event) => {
  console.log("[SW] Activate event fired — claiming all clients.");
  event.waitUntil(clients.claim());
});

// ── Push event ───────────────────────────────────────────────────────────────

self.addEventListener("push", function (event) {
  // ── DEBUG: log raw push data ─────────────────────────────────────────────
  const rawText = event.data ? event.data.text() : "(no data)";
  console.log("[SW] Push received! Raw payload text:", rawText);

  let data = { title: "Hemangi Makeover", body: "You have a new notification." };

  if (event.data) {
    try {
      data = event.data.json();
      console.log("[SW] Push payload parsed as JSON:", data);
    } catch (parseErr) {
      data.body = rawText;
      console.warn("[SW] Push payload is not JSON, using raw text as body. Parse error:", parseErr);
    }
  } else {
    console.warn("[SW] Push event had no data attached.");
  }

  const options = {
    body: data.body || "",
    icon: ICON,
    badge: ICON,
    tag: data.tag || "hemangi-notification", // collapses duplicates
    renotify: true,
    data: { url: data.url || APP_ORIGIN },
  };

  console.log("[SW] Calling showNotification with title:", data.title, "| options:", options);

  event.waitUntil(
    self.registration
      .showNotification(data.title, options)
      .then(() => console.log("[SW] showNotification() resolved ✔"))
      .catch((err) => console.error("[SW] showNotification() FAILED:", err))
  );
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.notification.title);
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : APP_ORIGIN;

  console.log("[SW] Navigating to:", targetUrl);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing open tab if possible
      for (const client of windowClients) {
        if (client.url === targetUrl && "focus" in client) {
          console.log("[SW] Focusing existing tab:", client.url);
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        console.log("[SW] Opening new tab:", targetUrl);
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
