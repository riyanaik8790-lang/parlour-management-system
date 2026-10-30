import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { api, type AdminBooking } from "@/lib/api";
import {
  CalendarCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  UserX,
  ChevronDown,
  MessageCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Bookings - Admin" }] }),
  component: AdminBookingsPage,
});

const SALON_WHATSAPP = "918208576165"; // Hemangi Glam Salon

/** Strip non-digits and ensure country code for wa.me */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`; // Indian mobile
  if (digits.length >= 11) return digits;
  return null;
}

/** Open WhatsApp click-to-chat with pre-filled text */
function openWhatsApp(phone: string, text: string) {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank", "noopener,noreferrer");
}

/** WhatsApp Reminder button – for confirmed bookings */
function WaReminderBtn({ booking }: { booking: AdminBooking }) {
  const phone = normalizePhone(booking.offline_phone ?? booking.user_phone) ?? SALON_WHATSAPP;
  const name = booking.offline_name ?? booking.user_name;
  const text =
    `Hi ${name}! This is a friendly reminder from Hemangi Glam Salon 🌸\n\n` +
    `📋 Your Upcoming Appointment:\n` +
    `• Service: ${booking.service_name}\n` +
    `• Date: ${new Date(booking.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}\n` +
    `• Time: ${booking.time}\n\n` +
    `We look forward to seeing you! If you have any questions, reply to this message. 😊`;
  return (
    <button
      type="button"
      id={`admin-wa-remind-${booking.id}`}
      title="Send WhatsApp reminder to customer"
      onClick={() => openWhatsApp(phone, text)}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 min-h-[38px] cursor-pointer"
      style={{
        background: "#25D366",
        color: "white",
        border: "1px solid #1ebe5e",
        boxShadow: "0 2px 8px #25D36630",
      }}
      aria-label="Send WhatsApp reminder"
    >
      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
      <span>Remind</span>
    </button>
  );
}

/** WhatsApp Feedback button – for completed bookings */
function WaFeedbackBtn({ booking }: { booking: AdminBooking }) {
  const phone = normalizePhone(booking.offline_phone ?? booking.user_phone) ?? SALON_WHATSAPP;
  const name = booking.offline_name ?? booking.user_name;
  const text =
    `Hi ${name}! Thank you for visiting Hemangi Glam Salon 💖\n\n` +
    `We hope you loved your ${booking.service_name} session!\n\n` +
    `We'd really appreciate it if you could leave us a Google review – it helps us serve you better:\n` +
    `🔗 https://g.page/r/HemAngiGlamSalon/review\n\n` +
    `Your feedback means the world to us! ✨`;
  return (
    <button
      type="button"
      id={`admin-wa-feedback-${booking.id}`}
      title="Request feedback via WhatsApp"
      onClick={() => openWhatsApp(phone, text)}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 min-h-[38px] cursor-pointer"
      style={{
        background: "#25D366",
        color: "white",
        border: "1px solid #1ebe5e",
        boxShadow: "0 2px 8px #25D36630",
      }}
      aria-label="Request feedback via WhatsApp"
    >
      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
      <span>Feedback</span>
    </button>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses", color: "text-white/60" },
  { value: "confirmed", label: "Confirmed", color: "text-emerald-400" },
  { value: "completed", label: "Completed", color: "text-blue-400" },
  { value: "cancelled", label: "Cancelled", color: "text-red-400" },
  { value: "no-show", label: "No Show", color: "text-amber-400" },
];

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    confirmed: {
      bg: "bg-emerald-500/15 ring-emerald-500/30",
      text: "text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    completed: {
      bg: "bg-blue-500/15 ring-blue-500/30",
      text: "text-blue-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    cancelled: {
      bg: "bg-red-500/15 ring-red-500/30",
      text: "text-red-400",
      icon: <XCircle className="h-3 w-3" />,
    },
    "no-show": {
      bg: "bg-amber-500/15 ring-amber-500/30",
      text: "text-amber-400",
      icon: <UserX className="h-3 w-3" />,
    },
  };
  const s = map[status] ?? {
    bg: "bg-white/10 ring-white/10",
    text: "text-white/50",
    icon: <Clock className="h-3 w-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${s.bg} ${s.text}`}
    >
      {s.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Status change dropdown ─────────────────────────────────────────────────
function StatusDropdown({
  booking,
  onUpdate,
}: {
  booking: AdminBooking;
  onUpdate: (id: number, status: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const options = ["confirmed", "completed", "cancelled", "no-show"];

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        right: document.documentElement.clientWidth - rect.right - window.scrollX,
      });
    }
  }, [open]);

  async function pick(s: string) {
    if (s === booking.status) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setOpen(false);
    await onUpdate(booking.id, s);
    setBusy(false);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition disabled:opacity-40 min-h-[44px]"
        style={{
          border: "1px solid oklch(0.84 0.042 80)",
          background: "oklch(0.92 0.030 83 / 50%)",
          color: "oklch(0.45 0.04 50)",
        }}
      >
        {busy ? (
          <span
            className="h-3 w-3 animate-spin rounded-full"
            style={{
              border: "1px solid oklch(0.84 0.042 80)",
              borderTopColor: "oklch(0.35 0.15 22)",
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        Edit
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
            <div
              className="absolute z-50 mt-1 w-36 overflow-hidden rounded-xl shadow-2xl"
              style={{
                top: coords.top,
                right: coords.right,
                background: "oklch(0.998 0.004 85)",
                border: "1px solid oklch(0.84 0.042 80 / 80%)",
                boxShadow: "0 16px 48px oklch(0.35 0.15 22 / 12%)",
              }}
            >
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => pick(opt)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs transition min-h-[44px]"
                  style={{
                    color: opt === booking.status ? "oklch(0.35 0.15 22)" : "oklch(0.55 0.04 50)",
                    fontWeight: opt === booking.status ? 600 : 400,
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "oklch(0.92 0.030 83 / 60%)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  {opt === booking.status && (
                    <CheckCircle2 className="h-3 w-3" style={{ color: "oklch(0.50 0.14 160)" }} />
                  )}
                  <span className={opt === booking.status ? "ml-0" : "ml-5"}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetAllBookings();
      setBookings(data.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const [autoWhatsApp, setAutoWhatsApp] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("admin_auto_wa") !== "false";
  });

  async function handleStatusUpdate(id: number, status: string) {
    const booking = bookings.find((b) => b.id === id);
    try {
      await api.adminUpdateBookingStatus(id, status);
      toast.success(`Booking #${id} marked as ${status}`);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

      // Automated actions upon status change (100% free)
      if (booking && autoWhatsApp) {
        const phone = normalizePhone(booking.offline_phone ?? booking.user_phone);
        const name = booking.offline_name ?? booking.user_name;

        if (status === "completed") {
          const feedbackText =
            `Hi ${name}! Thank you for visiting Hemangi Glam Salon 💖\n\n` +
            `We hope you loved your ${booking.service_name} session!\n\n` +
            `We'd really appreciate it if you could leave us a Google review – it helps us serve you better:\n` +
            `🔗 https://g.page/r/HemAngiGlamSalon/review\n\n` +
            `Your feedback means the world to us! ✨`;

          if (phone) {
            toast.info(`Auto-launching WhatsApp review request for ${name}...`, {
              action: {
                label: "Open Now",
                onClick: () => openWhatsApp(phone, feedbackText),
              },
            });
            openWhatsApp(phone, feedbackText);
          }
        } else if (status === "confirmed") {
          const reminderText =
            `Hi ${name}! This is a friendly reminder from Hemangi Glam Salon 🌸\n\n` +
            `📋 Your Upcoming Appointment:\n` +
            `• Service: ${booking.service_name}\n` +
            `• Date: ${new Date(booking.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}\n` +
            `• Time: ${booking.time}\n\n` +
            `We look forward to seeing you! If you have any questions, reply to this message. 😊`;

          if (phone) {
            toast.info(`Auto-launching WhatsApp confirmation for ${name}...`, {
              action: {
                label: "Open Now",
                onClick: () => openWhatsApp(phone, reminderText),
              },
            });
            openWhatsApp(phone, reminderText);
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  const filtered = bookings.filter((b) => {
    if (statusFilter !== "all" && b.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      (b.offline_name ?? b.user_name).toLowerCase().includes(q) ||
      b.user_email.toLowerCase().includes(q) ||
      (b.offline_phone ?? b.user_phone ?? "").includes(q) ||
      b.service_name.toLowerCase().includes(q) ||
      String(b.id).includes(q)
    );
  });

  // Summary counts
  const counts = {
    all: bookings.length,
    confirmed: bookings.filter((b) => b.status?.toLowerCase() === "confirmed").length,
    completed: bookings.filter((b) => b.status?.toLowerCase() === "completed").length,
    cancelled: bookings.filter((b) => b.status?.toLowerCase() === "cancelled").length,
    "no-show": bookings.filter((b) => b.status?.toLowerCase() === "no-show").length,
  };

  const [refreshing, setRefreshing] = useState(false);

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      const data = await api.adminGetAllBookings();
      setBookings(data.bookings);
      toast.success("Bookings data refreshed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh bookings");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="relative min-h-full -mx-4 sm:-mx-6 lg:-mx-12 -my-4 sm:-my-6 lg:-my-8 px-5 sm:px-8 lg:px-12 py-6 sm:py-8 overflow-hidden">
      {/* ── Luxury floral/geometric background texture watermark ── */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 mix-blend-multiply opacity-85"
        style={{
          backgroundImage: "url('/admin-floral-bg.png')",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundSize: "480px auto",
        }}
        aria-hidden="true"
      />

      <div className="space-y-4 sm:space-y-6 max-w-[1400px] mx-auto px-1 sm:px-0 relative z-0">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 animate-fade-up">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: "oklch(0.25 0.05 50)", fontFamily: "var(--font-serif)" }}
            >
              All Bookings
            </h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>
              {loading
                ? "Loading…"
                : `${bookings.length} total · ${counts.confirmed} confirmed · ${counts.completed} completed · ${counts.cancelled} cancelled`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !autoWhatsApp;
                setAutoWhatsApp(next);
                localStorage.setItem("admin_auto_wa", next ? "true" : "false");
                toast.info(next ? "Auto-launch WhatsApp on status change enabled" : "Auto-launch WhatsApp disabled");
              }}
              className="flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition min-h-[44px] cursor-pointer"
              style={{
                border: autoWhatsApp ? "1.5px solid #25D366" : "1px solid oklch(0.84 0.042 80)",
                background: autoWhatsApp ? "#25D36615" : "oklch(0.998 0.004 85)",
                color: autoWhatsApp ? "#15803d" : "oklch(0.55 0.04 50)",
                boxShadow: autoWhatsApp ? "0 2px 10px #25D36625" : "0 2px 8px oklch(0.35 0.15 22 / 4%)",
              }}
              title="Automatically launch WhatsApp with pre-filled reminder or review link when appointment status changes"
            >
              <Zap className={`h-4 w-4 ${autoWhatsApp ? "text-[#25D366] fill-[#25D366]" : "text-muted-foreground"}`} />
              <span>Auto-WhatsApp: <strong className={autoWhatsApp ? "text-[#16a34a]" : ""}>{autoWhatsApp ? "ON" : "OFF"}</strong></span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm transition disabled:opacity-40 min-h-[44px] cursor-pointer"
              style={{
                border: "1px solid oklch(0.84 0.042 80)",
                background: "oklch(0.998 0.004 85)",
                color: "oklch(0.45 0.04 50)",
                boxShadow: "0 2px 8px oklch(0.35 0.15 22 / 4%)",
              }}
            >
              <RefreshCw className={`h-4 w-4 ${loading || refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* 100% Free Background Automation Status Banner */}
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl p-3 sm:p-4 text-xs sm:text-sm shadow-sm"
          style={{
            background: "linear-gradient(135deg, oklch(0.98 0.015 85), oklch(0.96 0.025 88))",
            border: "1px solid oklch(0.88 0.030 82)",
            color: "oklch(0.35 0.08 40)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-semibold" style={{ color: "oklch(0.30 0.12 145)" }}>
              Free Background Automation Active
            </span>
            <span className="text-muted-foreground hidden md:inline">
              • APScheduler runs every 60s in background to send Web Push reminders & post-treatment review alerts with zero manual admin clicks.
            </span>
          </div>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              background: "#25D36618",
              color: "#16a34a",
              border: "1px solid #25D36640",
            }}
          >
            100% Free Tier
          </span>
        </div>

        {/* Status filter chips - Horizontal swipeable/scrollable bar */}
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1.5 pt-0.5 -mx-1 px-1 scroll-smooth animate-fade-up delay-100"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {STATUS_OPTIONS.map(({ value, label }) => {
            const count = counts[value as keyof typeof counts] ?? 0;
            const active = statusFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all min-h-[38px] sm:min-h-[44px] shrink-0 whitespace-nowrap cursor-pointer select-none"
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
                        color: "#ffffff",
                        border: "1.5px solid oklch(0.35 0.15 22)",
                        boxShadow: "0 4px 14px oklch(0.35 0.15 22 / 25%)",
                      }
                    : {
                        background: "oklch(0.998 0.004 85)",
                        color: "oklch(0.45 0.04 50)",
                        border: "1px solid oklch(0.84 0.042 80 / 80%)",
                      }
                }
              >
                {label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={
                    active
                      ? {
                          background: "oklch(0.68 0.13 68 / 35%)",
                          color: "#ffffff",
                        }
                      : {
                          background: "oklch(0.92 0.030 83)",
                          color: "oklch(0.50 0.04 50)",
                        }
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      {/* Search */}
      <div className="relative animate-fade-up delay-200">
        <Search
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "oklch(0.65 0.04 50)" }}
        />
        <input
          type="text"
          placeholder="Search by name, email, phone or service…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition"
          style={{
            background: "oklch(0.998 0.004 85)",
            border: "1px solid oklch(0.84 0.042 80)",
            color: "oklch(0.25 0.05 50)",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "oklch(0.68 0.13 68)";
            (e.currentTarget as HTMLInputElement).style.boxShadow =
              "0 0 0 3px oklch(0.68 0.13 68 / 12%)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "oklch(0.84 0.042 80)";
            (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-2xl p-4 text-sm"
          style={{
            background: "oklch(0.577 0.245 27.325 / 8%)",
            border: "1px solid oklch(0.577 0.245 27.325 / 20%)",
            color: "oklch(0.45 0.18 27)",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: "oklch(0.998 0.004 85)",
            border: "1px solid oklch(0.84 0.042 80 / 60%)",
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-4"
              style={{ borderBottom: "1px solid oklch(0.90 0.030 83)" }}
            >
              <div
                className="h-9 w-9 animate-pulse rounded-full"
                style={{ background: "oklch(0.90 0.030 83)" }}
              />
              <div className="flex-1 space-y-2">
                <div
                  className="h-3 w-40 animate-pulse rounded"
                  style={{ background: "oklch(0.90 0.030 83)" }}
                />
                <div
                  className="h-2 w-56 animate-pulse rounded"
                  style={{ background: "oklch(0.93 0.020 83)" }}
                />
              </div>
              <div
                className="h-3 w-24 animate-pulse rounded"
                style={{ background: "oklch(0.90 0.030 83)" }}
              />
              <div
                className="h-5 w-20 animate-pulse rounded-full"
                style={{ background: "oklch(0.90 0.030 83)" }}
              />
              <div
                className="h-7 w-16 animate-pulse rounded-lg"
                style={{ background: "oklch(0.90 0.030 83)" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Table / Cards */}
      {!loading && !error && (
        <div
          className="overflow-hidden rounded-2xl animate-fade-up delay-300"
          style={{
            background: "oklch(0.998 0.004 85)",
            border: "1px solid oklch(0.84 0.042 80 / 60%)",
            boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
          }}
        >
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-20"
              style={{ color: "oklch(0.70 0.04 50)" }}
            >
              <CalendarCheck className="h-12 w-12" style={{ color: "oklch(0.80 0.030 83)" }} />
              <p className="text-sm">
                {query
                  ? "No bookings match your search."
                  : statusFilter !== "all"
                    ? `No ${statusFilter} bookings.`
                    : "No bookings yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card layout (hidden on sm+) */}
              <div className="sm:hidden divide-y" style={{ borderColor: "oklch(0.93 0.020 83)" }}>
                {filtered.map((b) => (
                  <div key={b.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background: b.offline_name
                              ? "linear-gradient(135deg, oklch(0.68 0.13 68), oklch(0.55 0.11 65))"
                              : "linear-gradient(135deg, oklch(0.45 0.13 240), oklch(0.40 0.15 255))",
                            color: "oklch(0.99 0.01 85)",
                          }}
                        >
                          {b.offline_name ? "🚶" : b.user_name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: "oklch(0.25 0.05 50)" }}
                            >
                              {b.offline_name ?? b.user_name}
                            </p>
                            {b.offline_name && (
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{
                                  background: "oklch(0.68 0.13 68 / 15%)",
                                  color: "oklch(0.50 0.12 65)",
                                }}
                              >
                                Walk-in
                              </span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: "oklch(0.55 0.04 50)" }}>
                            {b.offline_phone ?? b.user_email}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs" style={{ color: "oklch(0.70 0.04 50)" }}>
                        #{b.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span
                          className="block font-semibold uppercase tracking-wide"
                          style={{ color: "oklch(0.65 0.04 50)" }}
                        >
                          Service
                        </span>
                        <span style={{ color: "oklch(0.30 0.05 50)" }}>{b.service_name}</span>
                      </div>
                      <div>
                        <span
                          className="block font-semibold uppercase tracking-wide"
                          style={{ color: "oklch(0.65 0.04 50)" }}
                        >
                          Date
                        </span>
                        <span style={{ color: "oklch(0.30 0.05 50)" }}>
                          {new Date(b.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div>
                        <span
                          className="block font-semibold uppercase tracking-wide"
                          style={{ color: "oklch(0.65 0.04 50)" }}
                        >
                          Time
                        </span>
                        <span style={{ color: "oklch(0.30 0.05 50)" }}>{b.time}</span>
                      </div>
                      <div>
                        <span
                          className="block font-semibold uppercase tracking-wide"
                          style={{ color: "oklch(0.65 0.04 50)" }}
                        >
                          Price
                        </span>
                        <span style={{ color: "oklch(0.45 0.04 50)" }}>
                          {b.service_price === "On request" ? (
                            <em>On request</em>
                          ) : (
                            `₹${b.service_price}`
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusBadge(b.status)}
                        {b.status === "confirmed" && <WaReminderBtn booking={b} />}
                        {b.status === "completed" && <WaFeedbackBtn booking={b} />}
                      </div>
                      <StatusDropdown booking={b} onUpdate={handleStatusUpdate} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table (hidden on mobile) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(0.90 0.030 83)" }}>
                      {[
                        "#",
                        "Customer",
                        "Service",
                        "Date & Time",
                        "Price",
                        "Status",
                        "Booked On",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest"
                          style={{ color: "oklch(0.65 0.04 50)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr
                        key={b.id}
                        className="group transition-colors"
                        style={{ borderBottom: "1px solid oklch(0.93 0.020 83)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            "oklch(0.96 0.018 83 / 50%)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                        }}
                      >
                        <td
                          className="px-6 py-4 font-mono text-xs"
                          style={{ color: "oklch(0.70 0.04 50)" }}
                        >
                          #{b.id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-md"
                              style={{
                                background: b.offline_name
                                  ? "linear-gradient(135deg, oklch(0.68 0.13 68), oklch(0.55 0.11 65))"
                                  : "linear-gradient(135deg, oklch(0.45 0.13 240), oklch(0.40 0.15 255))",
                                color: "oklch(0.99 0.01 85)",
                              }}
                            >
                              {b.offline_name ? "🚶" : b.user_name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium" style={{ color: "oklch(0.25 0.05 50)" }}>
                                  {b.offline_name ?? b.user_name}
                                </p>
                                {b.offline_name && (
                                  <span
                                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{
                                      background: "oklch(0.68 0.13 68 / 15%)",
                                      color: "oklch(0.50 0.12 65)",
                                    }}
                                  >
                                    Walk-in
                                  </span>
                                )}
                              </div>
                              {b.offline_name ? (
                                <p className="text-xs" style={{ color: "oklch(0.55 0.04 50)" }}>
                                  {b.offline_phone ? `📞 ${b.offline_phone}` : "No phone"}
                                </p>
                              ) : (
                                <>
                                  <p className="text-xs" style={{ color: "oklch(0.55 0.04 50)" }}>
                                    {b.user_email}
                                  </p>
                                  <p className="text-xs" style={{ color: "oklch(0.65 0.04 50)" }}>
                                    {b.user_phone}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium" style={{ color: "oklch(0.30 0.05 50)" }}>
                            {b.service_name}
                          </p>
                          <p className="text-xs" style={{ color: "oklch(0.65 0.04 50)" }}>
                            {b.category}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium" style={{ color: "oklch(0.30 0.05 50)" }}>
                            {new Date(b.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-xs" style={{ color: "oklch(0.55 0.04 50)" }}>
                            {b.time}
                          </p>
                        </td>
                        <td className="px-6 py-4" style={{ color: "oklch(0.45 0.04 50)" }}>
                          {b.service_price === "On request" ? (
                            <span className="italic" style={{ color: "oklch(0.65 0.04 50)" }}>
                              On request
                            </span>
                          ) : (
                            `₹${b.service_price}`
                          )}
                        </td>
                        <td className="px-6 py-4">{statusBadge(b.status)}</td>
                        <td className="px-6 py-4 text-xs" style={{ color: "oklch(0.55 0.04 50)" }}>
                          {new Date(b.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            {b.status === "confirmed" && <WaReminderBtn booking={b} />}
                            {b.status === "completed" && <WaFeedbackBtn booking={b} />}
                            <StatusDropdown booking={b} onUpdate={handleStatusUpdate} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
