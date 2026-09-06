import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCheck, Calendar, Sparkles, Clock, BellRing, X } from "lucide-react";
import { api, type AppNotification, getToken } from "@/lib/api";
import { isPushSupported, getPushPermission, subscribeToPush, isSubscribed } from "@/lib/push";

const BURGUNDY = "oklch(0.35 0.15 22)";
const GOLD = "oklch(0.68 0.13 68)";

// ── Local storage key to remember "user dismissed the push prompt" ────────────
const PUSH_PROMPT_DISMISSED_KEY = "push_prompt_dismissed_v1";

function fmtTime(raw: string) {
  const d = new Date(raw.replace(" ", "T") + (raw.includes("Z") || raw.includes("+") ? "" : "Z"));
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: true, timeZone: "Asia/Kolkata",
  });
}

function NotifIcon({ type }: { type: string }) {
  if (type === "new_booking") return <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: BURGUNDY }} />;
  if (type === "appointment_reminder") return <Clock className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />;
  return <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />;
}

// ── Push Permission Banner ────────────────────────────────────────────────────

function PushPromptBanner({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs shadow-md"
      style={{
        background: "oklch(0.997 0.006 85)",
        border: "1px solid oklch(0.86 0.030 82)",
        boxShadow: "0 4px 16px oklch(0.35 0.15 22 / 10%)",
        minWidth: 240,
      }}
    >
      <BellRing className="h-4 w-4 shrink-0" style={{ color: BURGUNDY }} />
      <span className="flex-1 font-medium" style={{ color: "oklch(0.30 0.05 50)" }}>
        Enable push notifications?
      </span>
      <button
        id="push-enable-btn"
        onClick={onEnable}
        className="rounded-lg px-2.5 py-1 font-semibold text-white transition-opacity hover:opacity-85"
        style={{ background: BURGUNDY, fontSize: 11 }}
      >
        Enable
      </button>
      <button
        id="push-dismiss-btn"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-muted"
        style={{ color: "oklch(0.65 0.03 55)" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [marking, setMarking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Push prompt state
  // Show if: push supported + permission not yet decided + user hasn't permanently dismissed
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushEnabling, setPushEnabling] = useState(false);

  // Determine whether to show the push banner on mount
  useEffect(() => {
    if (!isPushSupported()) return;
    if (!getToken()) return; // only for logged-in users
    if (getPushPermission() !== "default") return; // already decided
    if (localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY)) return; // permanently dismissed

    // Check if already subscribed (e.g. after page refresh)
    isSubscribed().then((subscribed) => {
      if (!subscribed) setShowPushPrompt(true);
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setItems(res.notifications);
      setUnread(res.unread);
    } catch { /* backend not ready yet */ }
  }, []);

  // Fetch on mount
  useEffect(() => { load(); }, [load]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle() {
    if (!open) load(); // re-fetch when opening
    setOpen((v) => !v);
  }

  async function markAll() {
    setMarking(true);
    try {
      await api.markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* silent */ }
    finally { setMarking(false); }
  }

  async function handleEnablePush() {
    setPushEnabling(true);
    try {
      const result = await subscribeToPush();
      if (result === "granted") {
        setShowPushPrompt(false);
        localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
      } else if (result === "denied") {
        // User denied in the native dialog — hide banner so we don't pester them
        setShowPushPrompt(false);
        localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
      }
      // "error" — leave banner visible; user can retry by toggling bell again
    } finally {
      setPushEnabling(false);
    }
  }

  function handleDismissPush() {
    setShowPushPrompt(false);
    // Only session-dismiss (no localStorage): banner can reappear on next login
    // To permanently dismiss, set the key:
    // localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
        style={{
          background: open ? "oklch(0.35 0.15 22 / 8%)" : "transparent",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.35 0.15 22 / 8%)"; }}
        onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <Bell className="h-5 w-5" style={{ color: BURGUNDY }} />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: BURGUNDY, boxShadow: `0 2px 6px oklch(0.35 0.15 22 / 50%)` }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Push permission prompt — shown below bell, outside the notifications dropdown */}
      {showPushPrompt && !open && (
        <div className="absolute right-0 top-full z-50">
          <PushPromptBanner
            onEnable={handleEnablePush}
            onDismiss={handleDismissPush}
          />
          {pushEnabling && (
            <p className="mt-1 text-center text-[10px]" style={{ color: "oklch(0.65 0.03 55)" }}>
              Requesting permission…
            </p>
          )}
        </div>
      )}

      {/* Notifications dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl shadow-2xl"
          style={{
            background: "oklch(0.998 0.004 85)",
            border: "1px solid oklch(0.88 0.030 82)",
            boxShadow: "0 16px 48px oklch(0.35 0.15 22 / 18%)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "oklch(0.91 0.025 82)", background: "oklch(0.995 0.006 84)" }}
          >
            <span className="text-sm font-semibold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>
              Notifications {unread > 0 && <span className="ml-1 text-xs font-normal" style={{ color: GOLD }}>({unread} new)</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={marking}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: BURGUNDY, background: "oklch(0.35 0.15 22 / 6%)" }}
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Push enable row — inside dropdown when open */}
          {showPushPrompt && (
            <div
              className="flex items-center gap-2 border-b px-4 py-2.5"
              style={{ borderColor: "oklch(0.91 0.025 82)", background: "oklch(0.35 0.15 22 / 3%)" }}
            >
              <BellRing className="h-3.5 w-3.5 shrink-0" style={{ color: BURGUNDY }} />
              <span className="flex-1 text-xs" style={{ color: "oklch(0.40 0.05 50)" }}>
                Enable push notifications?
              </span>
              <button
                id="push-enable-dropdown-btn"
                onClick={handleEnablePush}
                disabled={pushEnabling}
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50"
                style={{ background: BURGUNDY }}
              >
                {pushEnabling ? "…" : "Enable"}
              </button>
              <button
                onClick={handleDismissPush}
                aria-label="Dismiss"
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-muted"
                style={{ color: "oklch(0.65 0.03 55)" }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10" style={{ color: "oklch(0.68 0.04 55)" }}>
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className="flex gap-3 border-b px-4 py-3 transition-colors duration-100"
                  style={{
                    borderColor: "oklch(0.93 0.020 83)",
                    background: n.is_read ? "transparent" : "oklch(0.35 0.15 22 / 4%)",
                  }}
                >
                  {/* Icon dot */}
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: n.type === "new_booking" ? "oklch(0.35 0.15 22 / 10%)" : "oklch(0.68 0.13 68 / 10%)" }}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug" style={{ color: n.is_read ? "oklch(0.50 0.04 50)" : "oklch(0.25 0.05 50)" }}>
                      {n.message}
                    </p>
                    <p className="mt-0.5 text-[10px]" style={{ color: "oklch(0.70 0.04 50)" }}>
                      {fmtTime(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: BURGUNDY }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
