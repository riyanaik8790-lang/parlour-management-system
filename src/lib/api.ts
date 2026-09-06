// Small typed fetch wrapper around the local Flask backend.
// Configure VITE_API_BASE at build time; falls back to localhost:5000 for XAMPP dev.
//
// DEMO MOCK MODE:
// When the backend is unreachable (network error / TypeError from fetch) or a
// request times out, every API method transparently falls back to realistic
// mock data so the entire UI is clickable in preview environments where the
// Python/MySQL backend is not available. Real backend responses are preferred
// when reachable; mocks only kick in on failure.

import { SERVICE_CATEGORIES } from "./services-data";

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  ""; // Empty = use Vite proxy (/api → http://localhost:5000)

const TOKEN_KEY = "salon_token";
const USER_KEY = "salon_user";
const REMEMBER_KEY = "salon_remember";      // "1" = remember me was checked
const SESSION_FLAG_KEY = "salon_session_alive"; // sessionStorage sentinel (gone on full browser close)
const ADMIN_TOKEN_KEY = "salon_admin_token";
const ADMIN_USER_KEY = "salon_admin_user";
const MOCK_BOOKINGS_KEY = "salon_mock_bookings";
const MOCK_ANALYSES_KEY = "salon_mock_analyses";
const REQUEST_TIMEOUT_MS = 8000;

// Once we've confirmed the backend is unreachable, skip further fetch attempts
// so login/register/etc. respond instantly with mock data instead of stalling.
let backendReachable: boolean | null = null;
function markBackendDown() { backendReachable = false; }
function isBackendKnownDown() { return backendReachable === false; }

export type StoredUser = { id: number; name: string; email: string; role?: string };

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const remembered = window.localStorage.getItem(REMEMBER_KEY) === "1";
  if (!remembered) {
    // Session-only mode: the sessionStorage flag must still be alive.
    // If it's gone the browser was fully closed - treat as logged out.
    const alive = window.sessionStorage.getItem(SESSION_FLAG_KEY);
    if (!alive) {
      // Clean up the stale token so we don't re-check every call
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(REMEMBER_KEY);
      return null;
    }
  }
  return token;
}

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  // Reuse getToken() logic - it already handles the session-flag check
  if (!getToken()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

/**
 * Persist the session.
 * @param remember true  → localStorage only (survives browser restart)
 *                false → localStorage token + sessionStorage sentinel flag
 *                        (survives refresh & tab switches; lost only when all
 *                         browser windows are closed)
 */
export function setSession(token: string, user: StoredUser, remember = true) {
  // Always clear both stores first
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(REMEMBER_KEY);
  window.sessionStorage.removeItem(SESSION_FLAG_KEY);

  // Always write to localStorage so refresh never logs out
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (remember) {
    // Persist across browser restarts
    window.localStorage.setItem(REMEMBER_KEY, "1");
  } else {
    // Session-only: write the sentinel flag to sessionStorage.
    // sessionStorage is shared across tabs of the same origin in the same
    // browser session - it only disappears when ALL windows/tabs close.
    window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  }

  window.dispatchEvent(new Event("salon-auth-change"));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(REMEMBER_KEY);
  window.sessionStorage.removeItem(SESSION_FLAG_KEY);
  
  // Clear Try-On session state so it doesn't bleed into other accounts
  window.sessionStorage.removeItem("skin-advisor-result");
  window.sessionStorage.removeItem("skin-advisor-image");
  
  window.dispatchEvent(new Event("salon-auth-change"));
}

// --------------------------------------------------------------------------
// Admin session helpers (stored separately from customer session)
// --------------------------------------------------------------------------

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ADMIN_USER_KEY);
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

export function setAdminSession(token: string, user: StoredUser) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("salon-admin-auth-change"));
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_USER_KEY);
  window.dispatchEvent(new Event("salon-admin-auth-change"));
}

export function isAdminAuthenticated(): boolean {
  const token = getAdminToken();
  const user = getAdminUser();
  return !!token && !!user && user.role === "ADMIN";
}

// --------------------------------------------------------------------------
// Mock helpers
// --------------------------------------------------------------------------

function isNetworkError(err: unknown): boolean {
  // fetch throws TypeError on network failures / CORS / DNS. Also handle abort.
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  const msg = (err as Error)?.message?.toLowerCase() ?? "";
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed") ||
    msg.includes("aborted")
  );
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function allServices() {
  return SERVICE_CATEGORIES.flatMap((c) => c.items);
}

function serviceNameFor(id: string): string {
  const svc = allServices().find((s) => s.id === id);
  return svc?.name ?? "Salon Service";
}

// --------------------------------------------------------------------------
// Fetch wrapper with timeout
// --------------------------------------------------------------------------

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // SSR guard: never fire authenticated requests server-side (no localStorage)
  if (typeof window === "undefined") throw new Error("SSR: skipping client-only request");

  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  console.log(`[request] ${init.method ?? "GET"} ${path} | token: ${token ? token.slice(0, 40) + "..." : "NULL - NO TOKEN IN localStorage"}`);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      // Backend may return { error: "..." } (single) OR { errors: { field: "..." } } (per-field)
      if (data?.errors && typeof data.errors === "object") {
        // Serialize per-field errors so callers (e.g. RegisterPage) can re-hydrate them
        throw new Error(JSON.stringify({ errors: data.errors }));
      }
      throw new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try the real API; if it fails with a network/timeout error, use the mock
 * factory instead. Real HTTP errors (4xx/5xx with a response body) still
 * propagate so validation errors surface normally when the backend IS up.
 */
async function withMock<T>(realCall: () => Promise<T>, mock: () => T | Promise<T>): Promise<T> {
  if (isBackendKnownDown()) return await mock();
  try {
    const result = await realCall();
    backendReachable = true;
    return result;
  } catch (err) {
    if (isNetworkError(err)) {
      markBackendDown();
      // eslint-disable-next-line no-console
      console.info("[api] backend unreachable - using mock data");
      return await mock();
    }
    throw err;
  }
}

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type Swatch = { name: string; hex: string };
export type Palette = {
  undertone: "warm" | "cool" | "neutral";
  summary: string;
  hair: Swatch[];
  lips: Swatch[];
  blush: Swatch[];
  outfits: Swatch[];
  services: string[];
};
export type SavedAnalysis = {
  id: number;
  hex: string;
  depth: string;
  undertone: "warm" | "cool" | "neutral";
  created_at: string;
};

export type SkinAnalysisResponse = {
  /** e.g. "Medium Warm" */
  skin_tone: string;
  undertone: "warm" | "cool" | "neutral";
  /** Representative hex of the sampled skin area, e.g. "#c4855a" */
  hex: string;
  /** One-sentence personalised copy for the undertone */
  summary: string;
  hair:    { name: string; hex: string }[];
  lips:    { name: string; hex: string }[];
  blush:   { name: string; hex: string }[];
  outfits: { name: string; hex: string }[];
  services: string[];
  /** How consistent the readings were across sampled face regions */
  confidence?: "high" | "medium" | "low";
  /** Human-readable reason when confidence is medium or low */
  confidence_reason?: string | null;
  /** Set when lighting quality is poor; null/undefined when lighting is good */
  lighting_warning?: string | null;
};

// --------------------------------------------------------------------------
// Mock factories
// --------------------------------------------------------------------------

function mockPalette(undertone: "warm" | "cool" | "neutral" = "warm"): Palette {
  const palettes: Record<Palette["undertone"], Palette> = {
    warm: {
      undertone: "warm",
      summary:
        "You have a warm undertone with golden, peachy warmth. Earthy, sun-kissed shades will make your complexion glow.",
      hair: [
        { name: "Honey Caramel", hex: "#a9743b" },
        { name: "Warm Chestnut", hex: "#6b3f21" },
        { name: "Copper Auburn", hex: "#b5651d" },
      ],
      lips: [
        { name: "Peach Nude", hex: "#e2a07a" },
        { name: "Terracotta", hex: "#c96b52" },
        { name: "Warm Berry", hex: "#a24a5f" },
      ],
      blush: [
        { name: "Peach Nude", hex: "#e2a07a" },
        { name: "Terracotta", hex: "#c96b52" },
        { name: "Warm Berry", hex: "#a24a5f" },
      ],
      outfits: [
        { name: "Camel", hex: "#c19a6b" },
        { name: "Olive", hex: "#6b7a3a" },
        { name: "Rust", hex: "#b7410e" },
        { name: "Cream", hex: "#f3e5c3" },
      ],
      services: ["Gold Bleach", "Fruit Cleanup", "Party Makeup"],
    },
    cool: {
      undertone: "cool",
      summary:
        "You have a cool undertone with pink or bluish notes. Jewel tones and soft pastels will flatter your skin beautifully.",
      hair: [
        { name: "Ash Brown", hex: "#5a4a3f" },
        { name: "Cool Espresso", hex: "#3b2a24" },
        { name: "Platinum Blonde", hex: "#e5e4e2" },
      ],
      lips: [
        { name: "Rose Pink", hex: "#d97a95" },
        { name: "Berry Wine", hex: "#7b2a3d" },
        { name: "Mauve", hex: "#a76a8a" },
      ],
      blush: [
        { name: "Rose Pink", hex: "#d97a95" },
        { name: "Berry Wine", hex: "#7b2a3d" },
        { name: "Mauve", hex: "#a76a8a" },
      ],
      outfits: [
        { name: "Sapphire", hex: "#0f52ba" },
        { name: "Emerald", hex: "#046a38" },
        { name: "Icy Lavender", hex: "#c8b6d6" },
        { name: "Charcoal", hex: "#36454f" },
      ],
      services: ["Herbal / Oxy Bleach", "Party Makeup", "Facial"],
    },
    neutral: {
      undertone: "neutral",
      summary:
        "You have a balanced neutral undertone. A wide range of colors flatters you - try muted, versatile shades.",
      hair: [
        { name: "Natural Brown", hex: "#6f4e37" },
        { name: "Soft Mahogany", hex: "#8b3a3a" },
        { name: "Warm Black", hex: "#1c1c1c" },
      ],
      lips: [
        { name: "Rosy Nude", hex: "#c98a8a" },
        { name: "Dusty Rose", hex: "#c48b8b" },
        { name: "Soft Plum", hex: "#734f5b" },
      ],
      blush: [
        { name: "Rosy Nude", hex: "#c98a8a" },
        { name: "Dusty Rose", hex: "#c48b8b" },
        { name: "Soft Plum", hex: "#734f5b" },
      ],
      outfits: [
        { name: "Dusty Blue", hex: "#6a8caf" },
        { name: "Blush", hex: "#dea5a4" },
        { name: "Sage", hex: "#9caf88" },
        { name: "Taupe", hex: "#8b7d6b" },
      ],
      services: ["Fruit Cleanup", "Bridal Makeup", "Facial"],
    },
  };
  return palettes[undertone];
}

function mockSkinAnalysis(): SkinAnalysisResponse {
  return {
    skin_tone: "Medium Warm",
    hex: "#c19a6b",
    confidence: "high",
    confidence_reason: null,
    lighting_warning: null,
    ...mockPalette("warm"),
  };
}

// --------------------------------------------------------------------------
// Skin analysis (multipart)
// --------------------------------------------------------------------------

export async function analyzeSkinImage(file: File): Promise<SkinAnalysisResponse> {
  const form = new FormData();
  form.append("image", file);
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/analyze-skin`, {
      method: "POST",
      body: form,
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
    }
    return data as SkinAnalysisResponse;
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------------------------
// API surface
// --------------------------------------------------------------------------

export const api = {
  // register & login throw a user-friendly error if the backend is unreachable.
  register: async (body: { name: string; email: string; password: string; phone: string }) => {
    try {
      return await request<{ token: string; user: StoredUser }>("/api/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        throw new Error("Cannot connect to the server. Please make sure the backend is running.");
      }
      // Re-throw as-is so the RegisterPage can inspect the message for per-field errors
      throw err;
    }
  },

  getProfile: () =>
    request<{ id: number; name: string; email: string; phone: string; role: string }>("/api/profile"),

  updateProfile: (body: {
    name?: string;
    phone?: string;
    current_password?: string;
    new_password?: string;
  }) =>
    request<{ ok: boolean; user: StoredUser; profile: { id: number; name: string; email: string; phone: string; role: string } }>(
      "/api/profile",
      { method: "PUT", body: JSON.stringify(body) }
    ),

  getNotifications: () =>
    request<{ notifications: AppNotification[]; unread: number }>("/api/notifications"),

  markAllRead: () =>
    request<{ ok: boolean }>("/api/notifications/read-all", { method: "PUT" }),

  deleteAccount: (password: string) =>
    request<{ ok: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),

  login: async (body: { email: string; password: string }) => {
    try {
      return await request<{ token: string; user: StoredUser }>("/api/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        throw new Error("Cannot connect to the server. Please make sure the backend is running.");
      }
      throw err;
    }
  },

  slots: (date: string) =>
    withMock(
      () => request<{ taken: string[] }>(`/api/slots?date=${encodeURIComponent(date)}`),
      () => {
        // Deterministic "taken" slots for the given date so the UI feels real.
        const seed = date.split("-").reduce((a, b) => a + Number(b), 0);
        const pool = ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30"];
        const taken = pool.filter((_, i) => (seed + i) % 3 === 0);
        // Also block any locally-booked mock slots for this date.
        const local = readJSON<
          { id: number; service_name: string; date: string; time: string; status: string }[]
        >(MOCK_BOOKINGS_KEY, []);
        for (const b of local) if (b.date === date) taken.push(b.time);
        return { taken: Array.from(new Set(taken)) };
      },
    ),

  book: (body: { service_id: string; date: string; time: string }) =>
    withMock(
      () =>
        request<{ id: number }>("/api/book", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      () => {
        const list = readJSON<
          { id: number; service_name: string; date: string; time: string; status: string }[]
        >(MOCK_BOOKINGS_KEY, []);
        const id = Date.now();
        list.unshift({
          id,
          service_name: serviceNameFor(body.service_id),
          date: body.date,
          time: body.time,
          status: "confirmed",
        });
        writeJSON(MOCK_BOOKINGS_KEY, list);
        return { id };
      },
    ),

  myBookings: () =>
    withMock(
      () =>
        request<{
          bookings: {
            id: number;
            service_name: string;
            date: string;
            time: string;
            status: string;
          }[];
        }>("/api/my-bookings"),
      () => ({
        bookings: readJSON<
          { id: number; service_name: string; date: string; time: string; status: string }[]
        >(MOCK_BOOKINGS_KEY, []),
      }),
    ),

  updateBooking: (id: number, body: { date: string; time: string }) =>
    withMock(
      () =>
        request<{ ok: true }>(`/api/bookings/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }),
      () => {
        const list = readJSON<
          { id: number; service_name: string; date: string; time: string; status: string }[]
        >(MOCK_BOOKINGS_KEY, []);
        const idx = list.findIndex((b) => b.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], date: body.date, time: body.time };
          writeJSON(MOCK_BOOKINGS_KEY, list);
        }
        return { ok: true as const };
      },
    ),

  cancelBooking: (id: number) =>
    withMock(
      () =>
        request<{ ok: true }>(`/api/bookings/${id}`, { method: "DELETE" }),
      () => {
        const list = readJSON<
          { id: number; service_name: string; date: string; time: string; status: string }[]
        >(MOCK_BOOKINGS_KEY, []);
        writeJSON(MOCK_BOOKINGS_KEY, list.filter((b) => b.id !== id));
        return { ok: true as const };
      },
    ),



  recommendations: (undertone: "warm" | "cool" | "neutral") =>
    withMock(
      () => request<Palette>(`/api/recommendations?undertone=${undertone}`),
      () => mockPalette(undertone),
    ),

  saveSkinAnalysis: (body: {
    hex: string;
    depth: string;
    undertone: "warm" | "cool" | "neutral";
  }) =>
    withMock(
      () =>
        request<{ id: number } & Palette>("/api/skin-analysis", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      () => {
        const id = Date.now();
        const list = readJSON<SavedAnalysis[]>(MOCK_ANALYSES_KEY, []);
        list.unshift({
          id,
          hex: body.hex,
          depth: body.depth,
          undertone: body.undertone,
          created_at: new Date().toISOString(),
        });
        writeJSON(MOCK_ANALYSES_KEY, list);
        return { id, ...mockPalette(body.undertone) };
      },
    ),

  myAnalyses: () =>
    withMock(
      () => request<{ analyses: SavedAnalysis[] }>("/api/skin-analysis"),
      () => ({ analyses: readJSON<SavedAnalysis[]>(MOCK_ANALYSES_KEY, []) }),
    ),

  // --------------------------------------------------------------------------
  // Admin-only API calls - use the admin token, not the customer token
  // --------------------------------------------------------------------------

  adminLogin: async (body: { email: string; password: string }) => {
    try {
      return await request<{ token: string; user: StoredUser }>("/api/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        throw new Error("Cannot connect to the server. Please make sure the backend is running.");
      }
      throw err;
    }
  },

  adminGetUsers: () => {
    // SSR guard: localStorage is not available server-side
    if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
    const token = getAdminToken() ?? getToken();
    console.log("[adminGetUsers] Admin token from storage:", token ? `${token.slice(0, 40)}...` : "❌ NO TOKEN FOUND");
    console.log("[adminGetUsers] Admin token key (salon_admin_token):", localStorage.getItem("salon_admin_token")?.slice(0, 40));
    console.log("[adminGetUsers] Regular token key (salon_token):", localStorage.getItem("salon_token")?.slice(0, 40));
    return fetch(`${API_BASE}/api/admin/users`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch users");
      return data as { total: number; users: AdminUser[] };
    });
  },

  adminPromoteUser: (userId: number) => {
    if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
    const token = getAdminToken() ?? getToken();
    console.log("[adminPromoteUser] Sending token:", token ? `${token.slice(0, 40)}...` : "❌ NO TOKEN");
    return fetch(`${API_BASE}/api/admin/users/${userId}/promote`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to promote user");
      return data as { ok: boolean; message: string };
    });
  },

  adminSetUserRole: (userId: number, role: "ADMIN" | "USER") => {
    if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
    const token = getAdminToken() ?? getToken();
    console.log("[adminSetUserRole] userId:", userId, "role:", role, "token:", token ? `${token.slice(0, 40)}...` : "❌ NO TOKEN");
    return fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user role");
      return data as { ok: boolean; message: string; user: { id: number; name: string; email: string; role: string } };
    });
  },

  adminResetPassword: (userId: number) => {
    if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
    const token = getAdminToken() ?? getToken();
    return fetch(`${API_BASE}/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      return data as { password: string };
    });
  },

  adminDeleteUser: (userId: number) => {
    if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
    const token = getAdminToken() ?? getToken();
    return fetch(`${API_BASE}/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      return data as { ok: boolean; message: string };
    });
  },


  adminGetAllBookings: (status?: string) => {
    const token = getAdminToken() ?? getToken();
    console.log("[adminGetAllBookings] Sending token:", token ? `${token.slice(0, 40)}...` : "❌ NO TOKEN");
    const url = status && status !== "all"
      ? `${API_BASE}/api/admin/bookings?status=${encodeURIComponent(status)}`
      : `${API_BASE}/api/admin/bookings`;
    return fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch bookings");
      return data as { total: number; bookings: AdminBooking[] };
    });
  },

  adminUpdateBookingStatus: (bookingId: number, status: string) => {
    if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
    const token = getAdminToken() ?? getToken();
    return fetch(`${API_BASE}/api/admin/bookings/${bookingId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update booking status");
      return data as { ok: boolean };
    });
  },

  adminGetStats: () => {
    const token = getAdminToken() ?? getToken();
    console.log("[adminGetStats] Sending token:", token ? `${token.slice(0, 40)}...` : "❌ NO TOKEN");
    return fetch(`${API_BASE}/api/admin/stats`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch stats");
      return data as {
        total_users: number;
        bookings_today: number;
        total_services: number;
        bookings_mtd: number;
        total_bookings: number;
      };
    });
  },

};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
};

export type AdminBooking = {
  id: number;
  date: string;
  time: string;
  status: string;
  created_at: string;
  user_id: number;
  user_name: string;
  user_email: string;
  user_phone: string;
  service_id: string;
  service_name: string;
  service_price: string;
  category: string;
};

export type AppNotification = {
  id: number;
  type: "new_booking" | "appointment_reminder" | string;
  message: string;
  is_read: boolean;
  booking_id: number | null;
  created_at: string;
};
