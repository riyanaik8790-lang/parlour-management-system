import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Calendar, Sparkles, Clock, BellRing, X, Info, History } from "lucide-react";
import { api, type AppNotification, getToken } from "@/lib/api";
import { isPushSupported, getPushPermission, subscribeToPush, isSubscribed } from "@/lib/push";
import { toast } from "sonner";

const BURGUNDY = "oklch(0.35 0.15 22)";
const GOLD = "oklch(0.68 0.13 68)";

// ── Local storage key to remember "user dismissed the push prompt" ────────────
const PUSH_PROMPT_DISMISSED_KEY = "push_prompt_dismissed_v1";

function parseNotifDate(raw: string): Date {
  return new Date(raw.replace(" ", "T") + (raw.includes("Z") || raw.includes("+") ? "" : "Z"));
}

function isToday(raw: string): boolean {
  try {
    const d = parseNotifDate(raw);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
}

function fmtTime(raw: string) {
  const d = parseNotifDate(raw);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function NotifIcon({ type }: { type: string }) {
  if (type === "new_booking")
    return <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: BURGUNDY }} />;
  if (type === "appointment_reminder")
    return <Clock className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />;
  if (type === "booking_status_update")
    return <Info className="h-4 w-4 flex-shrink-0" style={{ color: BURGUNDY }} />;
  return <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />;
}

// ── Push Permission Banner ────────────────────────────────────────────────────

function PushPromptBanner({
  onEnable,
  onDismiss,
}: {
  onEnable: () => void;
  onDismiss: () => void;
}) {
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

export function NotificationBell({ autoRefreshMs }: { autoRefreshMs?: number } = {}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [marking, setMarking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Today's notifications only for main dropdown
  const todayItems = items.filter((n) => isToday(n.created_at));
  const todayUnread = todayItems.filter((n) => !n.is_read).length;

  // ── Audio Alert Setup & Autoplay Unlock ─────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevUnreadRef = useRef<number | null>(null);

  // Audio unlock state: user interaction unlocks browser AudioContext
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("salon_audio_unlocked") === "true";
    }
    return false;
  });

  // Keep alert sound state synchronized with settings changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "salon_audio_unlocked") {
        setIsAudioUnlocked(e.newValue === "true");
      }
    };
    const handleCustomChange = () => {
      if (typeof window !== "undefined") {
        setIsAudioUnlocked(localStorage.getItem("salon_audio_unlocked") === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("salon-audio-toggle", handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("salon-audio-toggle", handleCustomChange);
    };
  }, []);

  useEffect(() => {
    // Create HTML5 Audio instance for notification sound
    audioRef.current = new Audio("/notification-ding.mp3");
  }, []);

  // Helper to play /notification-ding.mp3 and trigger device vibration
  const playAlertSoundAndVibrate = useCallback(() => {
    // 1. Play custom HTML5 notification sound
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/notification-ding.mp3");
      }
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1;
      audioRef.current
        .play()
        .then(() => console.log("[NotifBell] /notification-ding.mp3 played successfully ✔"))
        .catch((err) => console.error("[NotifBell] Audio play error:", err));
    } catch (err) {
      console.error("[NotifBell] Failed to play audio:", err);
    }

    // 2. Trigger physical device vibration
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
      console.log("[NotifBell] Device vibration triggered: [200, 100, 200] ✔");
    }
  }, []);

  const handleUnlockAudio = async () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/notification-ding.mp3");
      }
      // Play audio file directly via user interaction to bypass browser autoplay policies
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1;
      await audioRef.current.play();

      // Trigger test vibration
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      setIsAudioUnlocked(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("salon_audio_unlocked", "true");
      }
      toast.success("Alert sounds & vibration enabled! 🔔");
      console.log("[NotifBell] Audio unlocked via trusted user interaction ✔");
    } catch (err) {
      console.error("[NotifBell] Failed to unlock audio:", err);
      // Still enable the state so subsequent real notifications attempt to play
      setIsAudioUnlocked(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("salon_audio_unlocked", "true");
      }
      toast.success("Alert sounds enabled! 🔔");
    }
  };

  const toggleAudioUnlock = async () => {
    if (isAudioUnlocked) {
      setIsAudioUnlocked(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("salon_audio_unlocked", "false");
      }
      toast.info("Alert sounds muted.");
    } else {
      await handleUnlockAudio();
    }
  };

  // Play audio alert and vibrate when a new booking arrives today (today's unread count increases)
  useEffect(() => {
    if (prevUnreadRef.current !== null && todayUnread > prevUnreadRef.current) {
      console.log(`[NotifBell] New booking arrived! Today's unread count rose ${prevUnreadRef.current} → ${todayUnread}.`);
      if (isAudioUnlocked) {
        playAlertSoundAndVibrate();
      } else {
        console.warn("[NotifBell] Alert sounds are locked or muted. Click 'Enable Alert Sounds' to unlock.");
      }
    }
    prevUnreadRef.current = todayUnread;
  }, [todayUnread, isAudioUnlocked, playAlertSoundAndVibrate]);

  // Listen for Service Worker push messages when the app tab is open in foreground
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "BOOKING_NOTIFICATION") {
        console.log("[NotifBell] Foreground push message from Service Worker received:", event.data);
        if (isAudioUnlocked) {
          playAlertSoundAndVibrate();
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [isAudioUnlocked, playAlertSoundAndVibrate]);

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
    } catch {
      /* backend not ready yet */
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh (for live updates across users and admin)
  useEffect(() => {
    // Poll every 15 seconds if not explicitly set, or use custom ms
    const pollInterval = autoRefreshMs || 15000;
    const id = setInterval(load, pollInterval);
    return () => clearInterval(id);
  }, [autoRefreshMs, load]);

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
    } catch {
      /* silent */
    } finally {
      setMarking(false);
    }
  }

  async function handleEnablePush() {
    setPushEnabling(true);
    try {
      const result = await subscribeToPush();
      if (result === "granted") {
        setShowPushPrompt(false);
        localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
        toast.success("Push notifications enabled!");
      } else if (result === "denied") {
        setShowPushPrompt(false);
        localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
        toast.info("Push notifications were denied.");
      } else if (result === "error") {
        toast.error("Failed to enable push notifications. Check your VAPID keys or console.");
      }
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
    <div ref={ref}>
      {/* Bell button */}
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
        style={{
          background: open ? "oklch(0.35 0.15 22 / 8%)" : "transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.35 0.15 22 / 8%)";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
      >
        <Bell className="h-5 w-5" style={{ color: BURGUNDY }} />
        {todayUnread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: BURGUNDY, boxShadow: `0 2px 6px oklch(0.35 0.15 22 / 50%)` }}
          >
            {todayUnread > 9 ? "9+" : todayUnread}
          </span>
        )}
      </button>

      {/* Push permission prompt — shown below bell */}
      {showPushPrompt && !open && (
        <div className="absolute right-0 top-full z-50">
          <PushPromptBanner onEnable={handleEnablePush} onDismiss={handleDismissPush} />
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
              className="absolute right-0 top-full mt-2 z-[9999] origin-top-right overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/5 w-[300px] max-w-[85vw] sm:w-80 md:w-96"
              style={{
                border: "1px solid oklch(0.88 0.030 82)",
                background: "oklch(0.998 0.004 85)",
                boxShadow: "0 16px 48px oklch(0.35 0.15 22 / 18%)",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: "oklch(0.91 0.025 82)", background: "oklch(0.995 0.006 84)" }}
              >
                <span
                  className="text-sm font-semibold tracking-wide"
                  style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                >
                  Today's Notifications
                </span>
                {todayUnread > 0 && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      background: "oklch(0.68 0.13 68 / 12%)",
                      color: GOLD,
                    }}
                  >
                    {todayUnread} new
                  </span>
                )}
              </div>

              {/* Push enable row — inside dropdown when open */}
              {showPushPrompt && (
                <div
                  className="flex items-center gap-2 border-b px-4 py-2.5"
                  style={{
                    borderColor: "oklch(0.91 0.025 82)",
                    background: "oklch(0.35 0.15 22 / 3%)",
                  }}
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

              {/* List: Today's notifications only */}
              <div className="max-h-80 overflow-y-auto">
                {todayItems.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center"
                    style={{ color: "oklch(0.68 0.04 55)" }}
                  >
                    <Bell className="h-7 w-7 opacity-30" />
                    <p className="text-xs font-medium">No alerts for today</p>
                    <p className="text-[11px] text-muted-foreground">
                      Check your Notification History for earlier alerts.
                    </p>
                  </div>
                ) : (
                  todayItems.map((n) => (
                    <div
                      key={n.id}
                      className="flex gap-3 border-b px-4 py-3 transition-colors duration-100"
                      style={{
                        borderColor: "oklch(0.93 0.020 83)",
                        background: n.is_read ? "transparent" : "oklch(0.35 0.15 22 / 4%)",
                      }}
                    >
                      {/* Icon dot */}
                      <div
                        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                        style={{
                          background:
                            n.type === "new_booking"
                              ? "oklch(0.35 0.15 22 / 10%)"
                              : "oklch(0.68 0.13 68 / 10%)",
                        }}
                      >
                        <NotifIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs leading-snug"
                          style={{ color: n.is_read ? "oklch(0.50 0.04 50)" : "oklch(0.25 0.05 50)" }}
                        >
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-[10px]" style={{ color: "oklch(0.70 0.04 50)" }}>
                          {fmtTime(n.created_at)}
                        </p>
                      </div>
                      {!n.is_read && (
                        <div
                          className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: BURGUNDY }}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer: Notification History Link */}
              <div
                className="border-t px-4 py-2.5 flex items-center justify-between"
                style={{
                  borderColor: "oklch(0.91 0.025 82)",
                  background: "oklch(0.985 0.008 85)",
                }}
              >
                <Link
                  to="/settings"
                  search={{ section: "notifications", view: "history" }}
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-lg transition-colors hover:bg-black/5"
                  style={{ color: BURGUNDY }}
                >
                  <History className="h-3.5 w-3.5" />
                  <span>View Notification History &rarr;</span>
                </Link>
              </div>
            </div>
          )}
    </div>
  );
}
