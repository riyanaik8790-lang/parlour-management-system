/**
 * src/lib/push.ts — Web Push browser utilities
 *
 * All functions are safe to call even when push isn't supported — they return
 * early without throwing so callers never need to guard individually.
 */

import { getToken } from "./api";

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
    _swReg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return _swReg;
  } catch (err) {
    console.warn("[push] SW registration failed:", err);
    return null;
  }
}

async function getSWReg(): Promise<ServiceWorkerRegistration | null> {
  if (_swReg) return _swReg;
  if (!isPushSupported()) return null;
  try {
    _swReg = (await navigator.serviceWorker.getRegistration("/")) ?? null;
    return _swReg;
  } catch {
    return null;
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
  if (!isPushSupported()) return "error";
  if (!VITE_VAPID_KEY) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY is not set");
    return "error";
  }

  // Request permission — browsers only show the dialog when this is called from
  // a user gesture, so we call it inside the "Enable" button click handler.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const reg = await getSWReg() ?? await registerSW();
    if (!reg) return "error";

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VITE_VAPID_KEY),
    });

    const json = sub.toJSON();
    const token = getToken();
    if (!token) return "error";

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });

    if (!res.ok) return "error";
    return "granted";
  } catch (err) {
    console.warn("[push] subscribe error:", err);
    return "error";
  }
}

// ── Unsubscribe ───────────────────────────────────────────────────────────────

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await getSWReg();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await sub.unsubscribe();

    const token = getToken();
    if (!token) return;
    await fetch("/api/push/unsubscribe", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.warn("[push] unsubscribe error:", err);
  }
}

// ── Convenience: is the current browser already subscribed? ──────────────────

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await getSWReg();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}
