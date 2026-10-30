/**
 * public/sw.js — Web Push Service Worker
 *
 * Design goals:
 *  1. ALWAYS show a real OS-level notification popup via showNotification(),
 *     regardless of whether the app tab is focused, backgrounded, or closed.
 *  2. ALSO notify any open foreground tabs via postMessage so the in-app bell
 *     can refresh — but postMessage failure must NEVER cancel the OS popup.
 *  3. Each notification gets a unique tag so multiple rapid pushes all appear.
 *  4. Reminders and feedback requests use requireInteraction so they don't
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
  let type  = ""; // e.g. "reminder" | "feedback" | "new_booking"
  let icon  = LOGO_ICON;
  let badge = STATUS_BADGE;

  let actions = [
    { action: "open", title: "View Details" },
  ];
  let reviewUrl = "https://g.page/r/HemAngiGlamSalon/review";

  if (event.data) {
    try {
      const data = event.data.json();
      if (data && typeof data === "object") {
        if (data.title)  title  = data.title;
        if (data.body)   body   = data.body;
        if (data.url)    url    = data.url;
        if (data.type)   type   = data.type;
        if (data.icon)   icon   = data.icon;
        if (data.badge)  badge  = data.badge;
        if (Array.isArray(data.actions) && data.actions.length > 0) {
          actions = data.actions;
        }
        if (data.review_url) reviewUrl = data.review_url;
      }
    } catch (_) {
      // Plain-text fallback
      try { body = event.data.text(); } catch (_2) {}
    }
  }

  // If this is a feedback notification and no specific actions provided, ensure direct review action
  if ((type === "feedback" || type === "post_treatment_feedback") && actions.length === 1 && actions[0].action === "open") {
    actions = [
      { action: "leave_review", title: "⭐ Leave Review" },
      { action: "open", title: "View Booking" }
    ];
  }

  // ── 2. Build unique tag so every push shows (not collapses) ───────────────
  const tag = "hemangi-" + (type || "notification") + "-" + Date.now();

  // ── 3. requireInteraction for time-sensitive push types ───────────────────
  const needsInteraction =
    type === "reminder" || type === "feedback" || type === "post_treatment_feedback" || type === "appointment_reminder";

  const notifOptions = {
    body:              body,
    icon:              icon,
    badge:             badge,
    tag:               tag,
    renotify:          true,
    requireInteraction: needsInteraction,
    vibrate:           [200, 100, 200],
    data:              { url: url, review_url: reviewUrl, type: type },
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

  // If user clicked the "Leave Review" action button directly
  if (event.action === "leave_review") {
    targetUrl = notifData.review_url || "https://g.page/r/HemAngiGlamSalon/review";
  } else if (event.action === "open") {
    targetUrl = notifData.url || APP_ORIGIN + "/my-bookings";
  } else if (!event.action) {
    // Tapping the main notification body:
    // If it's a feedback notification, navigate directly to review URL
    if (notifData.type === "feedback" || notifData.type === "post_treatment_feedback") {
      targetUrl = notifData.review_url || notifData.url || "https://g.page/r/HemAngiGlamSalon/review";
    }
  }

  // Check if target is external link (e.g. Google review)
  const isExternal = /^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith(APP_ORIGIN);

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        if (!isExternal) {
          // Focus and navigate an existing app tab if possible
          for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            if (client.url.startsWith(APP_ORIGIN) && "focus" in client) {
              if ("navigate" in client && client.url !== targetUrl) {
                client.navigate(targetUrl);
              }
              return client.focus();
            }
          }
        }
        // Otherwise open a new tab/window directly to the target URL
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
