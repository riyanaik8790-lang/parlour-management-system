/**
 * src/lib/push.ts — Web Push browser utilities
 *
 * All functions are safe to call even when push isn't supported — they return
 * early without throwing so callers never need to guard individually.
 */

import { api } from "./api";

const VITE_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// ── Support detection ─────────────────────────────────────────────────────────

/** Returns true only when the current browser fully supports Web Push. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current Notification permission: 'granted' | 'denied' | 'default' */
export function getPushPermission(): NotificationPermission {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

// ── Service worker registration ───────────────────────────────────────────────

let _swReg: ServiceWorkerRegistration | null = null;

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    console.log("[push] Registering service worker at /sw.js …");
    _swReg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    // Force the new SW version to activate immediately (in case an old one is waiting)
    if (_swReg.waiting) {
      _swReg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    // Wait until the SW is fully active before returning
    await navigator.serviceWorker.ready;
    _swReg = await navigator.serviceWorker.getRegistration("/") ?? _swReg;
    console.log("[push] SW registered & active ✔ scope:", _swReg.scope, "state:", _swReg.active?.state);
    return _swReg;
  } catch (err) {
    console.error("[push] SW registration FAILED:", err);
    return null;
  }
}

async function getSWReg(): Promise<ServiceWorkerRegistration | null> {
  if (_swReg && _swReg.active) return _swReg;
  if (!isPushSupported()) return null;
  try {
    // navigator.serviceWorker.ready resolves only once a SW is active & controlling
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      // Timeout after 4 s so we don't hang forever
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SW ready timeout")), 4000)
      ),
    ]) as ServiceWorkerRegistration;
    _swReg = ready;
    console.log("[push] getSWReg() → ready SW found:", _swReg.scope, "active state:", _swReg.active?.state);
    return _swReg;
  } catch (_readyErr) {
    // Fallback: just try getRegistration
    try {
      _swReg = (await navigator.serviceWorker.getRegistration("/")) ?? null;
      console.log("[push] getSWReg() fallback →", _swReg ? ("found: " + _swReg.scope) : "none registered");
      return _swReg;
    } catch (err) {
      console.error("[push] getSWReg() error:", err);
      return null;
    }
  }
}

// ── urlBase64ToUint8Array helper ──────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// ── Subscribe ─────────────────────────────────────────────────────────────────

/**
 * Ask the user for permission (if not yet decided), create a PushSubscription,
 * and POST it to the backend.
 * Returns 'granted' | 'denied' | 'already' | 'error'.
 */
export async function subscribeToPush(): Promise<"granted" | "denied" | "already" | "error"> {
  console.log("[push] subscribeToPush() called.");

  if (!isPushSupported()) {
    console.error("[push] Push NOT supported in this browser (missing serviceWorker / PushManager / Notification).");
    return "error";
  }

  if (!VITE_VAPID_KEY) {
    console.error("[push] VITE_VAPID_PUBLIC_KEY is not set in .env.local — push will not work.");
    return "error";
  }
  console.log("[push] VAPID public key present ✔ (first 20 chars):", VITE_VAPID_KEY.slice(0, 20));

  // ── Hard permission guard ──────────────────────────────────────────────────
  if (Notification.permission === "denied") {
    console.error("[push] Push Notifications are blocked by the browser. User must unblock in browser settings.");
    return "denied";
  }

  // Request permission — must be called from inside a user gesture click handler.
  console.log("[push] Current Notification.permission:", Notification.permission, "— calling requestPermission()…");
  const permission = await Notification.requestPermission();
  console.log("[push] requestPermission() result:", permission);

  if (permission !== "granted") {
    console.warn("[push] Permission not granted. Returned:", permission);
    return "denied";
  }

  try {
    // Get or register the service worker
    let reg = await getSWReg();
    if (!reg) {
      console.log("[push] No existing SW registration — registering now…");
      reg = await registerSW();
    }
    if (!reg) {
      console.error("[push] Service worker registration failed — cannot subscribe to push.");
      return "error";
    }
    console.log("[push] SW registration ready:", reg.scope);

    // Check if already subscribed
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      console.log("[push] Already subscribed to push ✔ endpoint:", existing.endpoint.slice(0, 60) + "…");
      // Re-POST subscription to backend in case it was lost from DB
      const json = existing.toJSON();
      await api.subscribePush({
        endpoint: json.endpoint!,
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
      });
      return "already";
    }

    // Create new subscription
    console.log("[push] Creating new pushManager.subscribe()…");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VITE_VAPID_KEY) as unknown as BufferSource,
    });
    console.log("[push] pushManager.subscribe() success ✔ endpoint:", sub.endpoint.slice(0, 60) + "…");

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh || "";
    const auth   = json.keys?.auth   || "";
    console.log("[push] Sending subscription to backend — p256dh present:", !!p256dh, "auth present:", !!auth);

    if (!p256dh || !auth) {
      console.error("[push] Subscription is missing crypto keys — not saving to backend (subscription invalid).");
      return "error";
    }

    await api.subscribePush({
      endpoint: json.endpoint!,
      p256dh,
      auth,
    });
    console.log("[push] Subscription saved to backend ✔");

    return "granted";
  } catch (err) {
    console.error("[push] subscribeToPush() caught an error:", err);
    return "error";
  }
}

// ── Unsubscribe ───────────────────────────────────────────────────────────────

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    console.log("[push] unsubscribeFromPush() called.");
    const reg = await getSWReg();
    if (!reg) {
      console.warn("[push] No SW registration found — nothing to unsubscribe.");
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      console.warn("[push] No active push subscription found in browser.");
      return;
    }
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    console.log("[push] Browser push subscription removed ✔");
    await api.unsubscribePush(endpoint);
    console.log("[push] Backend subscription record for this device deleted ✔");
  } catch (err) {
    console.error("[push] unsubscribeFromPush() error:", err);
  }
}

// ── Convenience: is the current browser already subscribed? ──────────────────

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await getSWReg();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    console.log("[push] isSubscribed():", sub !== null);
    return sub !== null;
  } catch {
    return false;
  }
}
