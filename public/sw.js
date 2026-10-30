/**
 * public/sw.js — Web Push Service Worker
 *
 * Design goals:
 *  1. ALWAYS show a real OS-level notification popup via showNotification(),
 *     regardless of whether the app tab is focused, backgrounded, or closed.
 *  2. ALSO notify any open foreground tabs via postMessage so the in-app bell
 *     can refresh — but postMessage failure must NEVER cancel the OS popup.
 *  3. Each notification gets a unique tag so multiple rapid pushes all appear.
 *  4. Appointment reminders use requireInteraction so they don't
 *     auto-dismiss after a few seconds.
 */

const APP_ORIGIN = self.location.origin;
const LOGO_ICON  = APP_ORIGIN + "/logo.png";
const STATUS_BADGE = APP_ORIGIN + "/badge.png";

// ── Install: activate immediately ────────────────────────────────────────────
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

// ── Activate: claim all clients immediately ──────────────────────────────────
self.addEventListener("activate", function (event) {
  event.waitUntil(clients.claim());
});

// ── Push Event ───────────────────────────────────────────────────────────────
self.addEventListener("push", function (event) {
  // ── 1. Parse payload ───────────────────────────────────────────────────────
  let title = "New Appointment!";
  let body  = "A new appointment has been booked.";
  let url   = APP_ORIGIN + "/admin";
  let type  = ""; // e.g. "reminder" | "appointment_reminder" | "new_booking"
  let icon  = LOGO_ICON;
  let badge = STATUS_BADGE;

  let actions = [
    { action: "open", title: "View Details" },
  ];

  let targetUserId = null;

  if (event.data) {
    try {
      const data = event.data.json();
      if (data && typeof data === "object") {
        if (data.title)  title  = data.title;
        if (data.body)   body   = data.body;
        if (data.url)    url    = data.url;
        if (data.type)   type   = data.type;
        if (data.target_user_id) targetUserId = data.target_user_id;
        if (data.icon)   icon   = data.icon.startsWith("http") ? data.icon : APP_ORIGIN + (data.icon.startsWith("/") ? "" : "/") + data.icon;
        if (data.badge)  badge  = data.badge.startsWith("http") ? data.badge : APP_ORIGIN + (data.badge.startsWith("/") ? "" : "/") + data.badge;
        if (Array.isArray(data.actions) && data.actions.length > 0) {
          actions = data.actions;
        }
      }
    } catch (_) {
      // Plain-text fallback
      try { body = event.data.text(); } catch (_2) {}
    }
  }

  // ── 2. Build unique tag so every push shows (not collapses) ───────────────
  const tag = "hemangi-" + (type || "notification") + "-" + Date.now();

  // ── 3. requireInteraction for time-sensitive push types ───────────────────
  const needsInteraction =
    type === "reminder" || type === "appointment_reminder";

  const notifOptions = {
    body:              body,
    icon:              icon,
    badge:             badge,
    tag:               tag,
    renotify:          true,
    requireInteraction: needsInteraction,
    vibrate:           [200, 100, 200],
    data:              { url: url, type: type, target_user_id: targetUserId },
    actions:           actions,
  };

  // ── 4. ALWAYS show OS popup first — waitUntil keeps SW alive for it ────────
  //    postMessage to foreground tabs is best-effort; errors are swallowed so
  //    they cannot prevent the OS notification from being shown.
  event.waitUntil(
    self.registration
      .showNotification(title, notifOptions)
      .then(function () {
        // Notify open foreground tabs so the in-app bell can refresh.
        return clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then(function (windowClients) {
            windowClients.forEach(function (client) {
              try {
                client.postMessage({ type: "BOOKING_NOTIFICATION", title: title, body: body });
              } catch (_) {}
            });
          })
          .catch(function () {}); // swallow — postMessage must not kill the push
      })
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || APP_ORIGIN + "/my-bookings";

  // Normalize relative paths to absolute URLs so clients.openWindow / clients.matchAll works reliably
  // and append target_user_id param so client app can verify logged-in account
  const resolveUrl = function (u) {
    if (!u) u = APP_ORIGIN + "/my-bookings";
    let fullUrl = /^https?:\/\//i.test(u) ? u : (APP_ORIGIN + (u.startsWith("/") ? "" : "/") + u);
    if (notifData.target_user_id && fullUrl.startsWith(APP_ORIGIN)) {
      try {
        const parsed = new URL(fullUrl);
        parsed.searchParams.set("notif_user_id", String(notifData.target_user_id));
        fullUrl = parsed.toString();
      } catch (_) {}
    }
    return fullUrl;
  };

  targetUrl = resolveUrl(targetUrl);

  // Check if target is external link
  const isExternal = /^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith(APP_ORIGIN);

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        if (!isExternal) {
          // If an existing window/tab of the salon app is open, focus it and navigate
          for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            if (client.url.startsWith(APP_ORIGIN) && "focus" in client) {
              if ("navigate" in client && client.url !== targetUrl) {
                return client.navigate(targetUrl).then(function (c) {
                  return c ? c.focus() : client.focus();
                });
              }
              return client.focus();
            }
          }
        }
        // If app is closed or target is external, reliably open a new tab/window via clients.openWindow
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
      .catch(function (err) {
        console.error("[sw] notificationclick error:", err);
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
