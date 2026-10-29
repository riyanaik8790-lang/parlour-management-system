// ── Salon Closures / Holiday Blocking Manager ────────────────────────────
// Allows admin to block dates, public holidays, and maintenance days.
// Synchronizes in real time with the booking engine (/book).

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

export function getAllClosures(): SalonClosure[] {
  if (typeof window === "undefined") return DEFAULT_CLOSURES;
  try {
    const raw = localStorage.getItem(CLOSURES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
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
  localStorage.setItem(CLOSURES_STORAGE_KEY, JSON.stringify(closures));
  window.dispatchEvent(new Event("salon-closures-updated"));
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

  const updated = [newClosure, ...current].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  saveAllClosures(updated);
  return newClosure;
}

export function deleteClosure(id: string): void {
  const current = getAllClosures();
  const updated = current.filter((c) => c.id !== id);
  saveAllClosures(updated);
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
