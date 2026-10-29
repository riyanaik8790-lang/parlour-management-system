import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

export type SalonClosure = {
  id: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  reason: string;
  createdAt: string;
};

/**
 * Returns today's date string in "YYYY-MM-DD" format.
 * Formats using device's local calendar and ensures alignment with IST (salon timezone),
 * preventing UTC ISO-string offsets from erroneously allowing yesterday's date.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const localDate = `${year}-${month}-${day}`;

  try {
    const istDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return istDate > localDate ? istDate : localDate;
  } catch {
    return localDate;
  }
}

export const CLOSURES_STORAGE_KEY = "salon_closures_v1";
export const BROADCAST_CHANNEL_NAME = "salon_closures_broadcast_v1";

export const DEFAULT_CLOSURES: SalonClosure[] = [
  {
    id: "closure-diwali-2026",
    startDate: "2026-11-08",
    endDate: "2026-11-10",
    reason: "Diwali Festival Holiday",
    createdAt: "2026-10-15T10:00:00Z",
  },
  {
    id: "closure-maint-2026",
    startDate: "2026-11-25",
    endDate: "2026-11-25",
    reason: "Salon Deep Cleaning & Equipment Maintenance",
    createdAt: "2026-10-20T10:00:00Z",
  },
];

// ── In-Memory Subscriber Store ────────────────────────────────────────────────
const listeners = new Set<(closures: SalonClosure[]) => void>();

function notifyListeners(closures: SalonClosure[]) {
  listeners.forEach((listener) => {
    try {
      listener(closures);
    } catch (e) {
      console.error("Error in closure listener callback", e);
    }
  });
}

export function subscribeToClosures(listener: (closures: SalonClosure[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── BroadcastChannel for Real-Time Cross-Tab / Cross-Iframe Sync ───────────────
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "SALON_CLOSURES_UPDATED" && Array.isArray(event.data?.payload)) {
        notifyListeners(event.data.payload);
      } else {
        notifyListeners(getAllClosures());
      }
    };
  } catch (e) {
    console.warn("BroadcastChannel not available:", e);
  }
}

// ── Cross-Frame window.postMessage sync (for preview iframes & viewports) ───────
if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.data?.type === "SALON_CLOSURES_SYNC_REQUEST") {
      const current = getAllClosures();
      try {
        (event.source as WindowProxy | null)?.postMessage(
          { type: "SALON_CLOSURES_SYNC_RESPONSE", payload: current },
          "*"
        );
      } catch {}
    } else if (
      (event.data?.type === "SALON_CLOSURES_UPDATED" ||
        event.data?.type === "SALON_CLOSURES_SYNC_RESPONSE") &&
      Array.isArray(event.data?.payload)
    ) {
      try {
        const stored = localStorage.getItem(CLOSURES_STORAGE_KEY);
        const incomingJson = JSON.stringify(event.data.payload);
        if (stored !== incomingJson) {
          localStorage.setItem(CLOSURES_STORAGE_KEY, incomingJson);
        }
      } catch {}
      notifyListeners(event.data.payload);
    }
  });
}

/**
 * Asynchronously fetch closures from the centralized Supabase database.
 * Syncs the remote records into local storage, notifies in-memory subscribers,
 * and ensures all mobile and desktop viewports are perfectly aligned.
 */
export async function fetchRemoteClosures(): Promise<SalonClosure[]> {
  try {
    const { data, error } = await supabase
      .from("salon_closures")
      .select("*")
      .order("start_date", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: SalonClosure[] = data.map((r: {
        id: string;
        start_date: string;
        end_date: string;
        reason: string;
        created_at?: string;
      }) => ({
        id: r.id,
        startDate: r.start_date,
        endDate: r.end_date,
        reason: r.reason,
        createdAt: r.created_at || new Date().toISOString(),
      }));

      // Update local storage cache
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CLOSURES_STORAGE_KEY, JSON.stringify(mapped));
        } catch {}
      }

      notifyListeners(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn("[closures] Remote fetch failed, using local cache:", err);
  }
  return getAllClosures();
}

export function getAllClosures(): SalonClosure[] {
  if (typeof window === "undefined") return DEFAULT_CLOSURES;
  try {
    const raw = localStorage.getItem(CLOSURES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Seed initial defaults into localStorage
    localStorage.setItem(CLOSURES_STORAGE_KEY, JSON.stringify(DEFAULT_CLOSURES));
    return DEFAULT_CLOSURES;
  } catch {
    return DEFAULT_CLOSURES;
  }
}

export function saveAllClosures(closures: SalonClosure[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CLOSURES_STORAGE_KEY, JSON.stringify(closures));
  } catch (err) {
    console.error("Failed to save closures to localStorage", err);
  }

  // 1. Notify in-memory subscribers in the active window
  notifyListeners(closures);

  // 2. Dispatch event for same-window listeners
  try {
    window.dispatchEvent(new CustomEvent("salon-closures-updated", { detail: closures }));
  } catch {}

  // 3. Broadcast to all other windows / tabs / viewports via BroadcastChannel
  try {
    broadcastChannel?.postMessage({
      type: "SALON_CLOSURES_UPDATED",
      payload: closures,
    });
  } catch {}

  // 4. Post message to parent/top frames in case of preview simulators
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "SALON_CLOSURES_UPDATED", payload: closures },
        "*"
      );
    }
  } catch {}
}

export function addClosure(data: {
  startDate: string;
  endDate?: string;
  reason: string;
}): SalonClosure {
  const current = getAllClosures();
  const start = data.startDate;
  const end = data.endDate && data.endDate >= start ? data.endDate : start;

  const newClosure: SalonClosure = {
    id: `closure-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    startDate: start,
    endDate: end,
    reason: data.reason.trim() || "Salon Holiday / Closure",
    createdAt: new Date().toISOString(),
  };

  const updated = [newClosure, ...current.filter((c) => c.id !== newClosure.id)].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  saveAllClosures(updated);

  // Sync to remote Supabase database immediately
  (async () => {
    try {
      const { error } = await supabase.from("salon_closures").upsert({
        id: newClosure.id,
        start_date: newClosure.startDate,
        end_date: newClosure.endDate,
        reason: newClosure.reason,
      });
      if (error) console.warn("[closures] Remote upsert failed:", error.message);
    } catch (err) {
      console.warn("[closures] Remote upsert error:", err);
    }
  })();

  return newClosure;
}

export function deleteClosure(id: string): void {
  const current = getAllClosures();
  const updated = current.filter((c) => c.id !== id);
  saveAllClosures(updated);

  // Sync delete to remote Supabase database immediately
  (async () => {
    try {
      const { error } = await supabase
        .from("salon_closures")
        .delete()
        .eq("id", id);
      if (error) console.warn("[closures] Remote delete failed:", error.message);
    } catch (err) {
      console.warn("[closures] Remote delete error:", err);
    }
  })();
}

export function isDateClosed(dateStr: string): boolean {
  if (!dateStr) return false;
  const closures = getAllClosures();
  return closures.some((c) => dateStr >= c.startDate && dateStr <= c.endDate);
}

export function getClosureForDate(dateStr: string): SalonClosure | undefined {
  if (!dateStr) return undefined;
  const closures = getAllClosures();
  return closures.find((c) => dateStr >= c.startDate && dateStr <= c.endDate);
}

/**
 * React hook for unified, real-time cross-view closure synchronization.
 * Automatically stays synchronized across mobile/desktop viewports,
 * resize events, storage changes, tab focus, BroadcastChannel updates,
 * and Supabase centralized database changes.
 */
export function useClosures() {
  const [closures, setClosures] = useState<SalonClosure[]>(() => getAllClosures());

  const refresh = useCallback(async () => {
    // 1. Immediately return local state
    const local = getAllClosures();
    setClosures(local);
    // 2. Immediately fetch from centralized store
    const remote = await fetchRemoteClosures();
    setClosures(remote);
    return remote;
  }, []);

  useEffect(() => {
    // Initial sync from local storage and remote centralized store
    setClosures(getAllClosures());
    fetchRemoteClosures();

    const unsubscribe = subscribeToClosures((updated) => {
      setClosures(updated);
    });

    const handleSync = () => {
      setClosures(getAllClosures());
      fetchRemoteClosures();
    };

    // Cross-tab / cross-window storage event
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === CLOSURES_STORAGE_KEY) {
        setClosures(getAllClosures());
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("salon-closures-updated", handleSync);
    window.addEventListener("resize", handleSync);
    window.addEventListener("focus", handleSync);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Supabase Realtime Channel: Instantly syncs across devices when a closure is added or removed
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("salon_closures_realtime_sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "salon_closures" },
          () => {
            fetchRemoteClosures();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[closures] Realtime channel subscription failed:", e);
    }

    // Request synchronization from parent/sibling preview frames if present
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "SALON_CLOSURES_SYNC_REQUEST" }, "*");
      }
    } catch {}

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("salon-closures-updated", handleSync);
      window.removeEventListener("resize", handleSync);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { closures, refresh };
}
