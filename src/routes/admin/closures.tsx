import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { format, parseISO, isAfter, isBefore, isToday, startOfDay } from "date-fns";
import {
  CalendarX,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Ban,
  CalendarDays,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  type SalonClosure,
  getAllClosures,
  addClosure,
  deleteClosure,
} from "@/lib/closures-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/closures")({
  head: () => ({ meta: [{ title: "Closure Manager - Admin" }] }),
  component: AdminClosuresPage,
});

const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const CARD_WHITE = "oklch(0.998 0.004 85)";
const TEXT_DARK = "oklch(0.25 0.05 50)";
const TEXT_MUTED = "oklch(0.55 0.04 50)";

const QUICK_PRESETS = [
  "Diwali Holiday",
  "National Holiday",
  "Salon Maintenance",
  "Deep Cleaning & Sanitization",
  "Staff Training Day",
  "Private Event / VIP Booking",
];

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmReopenModal({
  open,
  closure,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  closure: SalonClosure | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || !closure) return null;

  const dateText =
    closure.startDate === closure.endDate
      ? format(parseISO(closure.startDate), "dd MMMM yyyy")
      : `${format(parseISO(closure.startDate), "dd MMM yyyy")} – ${format(parseISO(closure.endDate), "dd MMM yyyy")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{ background: "oklch(0.25 0.05 50 / 55%)", backdropFilter: "blur(6px)" }}
        onClick={onCancel}
      />
      {/* Modal Card */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: CARD_WHITE,
          border: "1px solid oklch(0.84 0.042 80 / 60%)",
        }}
      >
        <div
          className="px-6 py-4"
          style={{
            background: "linear-gradient(135deg, oklch(0.45 0.20 27), oklch(0.55 0.18 22))",
          }}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-white" />
            <h2 className="text-base font-bold text-white font-serif">Reopen Blocked Date?</h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
            Are you sure you want to remove the closure for{" "}
            <span className="font-semibold text-neutral-900">{dateText}</span> ({closure.reason})?
            Clients will immediately be able to book appointment slots on this date.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2 text-sm font-medium transition cursor-pointer"
              style={{
                border: "1px solid oklch(0.84 0.042 80)",
                color: TEXT_DARK,
                background: "oklch(0.97 0.01 85)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition cursor-pointer"
              style={{
                background: "linear-gradient(135deg, oklch(0.48 0.22 27), oklch(0.58 0.20 25))",
              }}
            >
              <Trash2 className="h-4 w-4" />
              Reopen Date
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Closures Page Component ─────────────────────────────────────────────
function AdminClosuresPage() {
  const [closures, setClosures] = useState<SalonClosure[]>(() => getAllClosures());
  const [query, setQuery] = useState("");
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);

  const [closureToDelete, setClosureToDelete] = useState<SalonClosure | null>(null);

  const loadClosures = () => {
    setClosures(getAllClosures());
  };

  useEffect(() => {
    loadClosures();
    const handleUpdate = () => loadClosures();
    window.addEventListener("salon-closures-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("salon-closures-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Today in YYYY-MM-DD (min selectable date)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const handleAddClosure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      toast.error("Please pick a start date.");
      return;
    }
    if (startDate < todayStr) {
      toast.error("Cannot select past dates. Please pick today or a future date.");
      return;
    }
    const finalEnd = isRangeMode && endDate ? endDate : startDate;
    if (isRangeMode && endDate && endDate < startDate) {
      toast.error("End date cannot be earlier than start date.");
      return;
    }
    if (finalEnd < todayStr) {
      toast.error("Cannot select past dates. Please pick today or a future date.");
      return;
    }

    const cleanReason = reason.trim() || "Salon Holiday / Maintenance";

    setSaving(true);
    try {
      addClosure({
        startDate,
        endDate: finalEnd,
        reason: cleanReason,
      });
      toast.success(`Date closure for "${cleanReason}" scheduled successfully!`);
      // Reset form
      setStartDate("");
      setEndDate("");
      setReason("");
      loadClosures();
    } catch {
      toast.error("Failed to add closure.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!closureToDelete) return;
    deleteClosure(closureToDelete.id);
    toast.success("Closure removed. Date has been reopened for bookings.");
    setClosureToDelete(null);
    loadClosures();
  };

  // Automatic expiry filter: only keep closures that are active today or in the future (endDate >= todayStr)
  const activeAndUpcomingClosures = useMemo(() => {
    return closures.filter((c) => {
      const closureEnd = c.endDate || c.startDate;
      return closureEnd >= todayStr;
    });
  }, [closures, todayStr]);

  // Filter active/upcoming closures by search query
  const filteredClosures = useMemo(() => {
    return activeAndUpcomingClosures.filter((c) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.reason.toLowerCase().includes(q) ||
        c.startDate.includes(q) ||
        c.endDate.includes(q)
      );
    });
  }, [activeAndUpcomingClosures, query]);

  // Calculate upcoming / active counts from active & upcoming closures
  const activeTodayCount = useMemo(
    () =>
      activeAndUpcomingClosures.filter(
        (c) => todayStr >= c.startDate && todayStr <= c.endDate,
      ).length,
    [activeAndUpcomingClosures, todayStr],
  );

  const upcomingCount = useMemo(
    () => activeAndUpcomingClosures.filter((c) => c.startDate > todayStr).length,
    [activeAndUpcomingClosures, todayStr],
  );

  return (
    <>
      {/* Delete / Reopen Confirmation Dialog */}
      <ConfirmReopenModal
        open={Boolean(closureToDelete)}
        closure={closureToDelete}
        onConfirm={confirmDelete}
        onCancel={() => setClosureToDelete(null)}
      />

      <div className="relative min-h-full -mx-4 sm:-mx-6 lg:-mx-12 -my-4 sm:-my-6 lg:-my-8 px-4 sm:px-6 lg:px-12 py-6 sm:py-8 overflow-hidden">
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

        <div className="space-y-4 sm:space-y-6 max-w-[1400px] mx-auto relative z-0">
          {/* Header matching Admin layout */}
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 animate-fade-up">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
            >
              Closure Manager
            </h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: TEXT_MUTED }}>
              {activeAndUpcomingClosures.length} scheduled closure{activeAndUpcomingClosures.length !== 1 ? "s" : ""} · Blocked
              dates automatically disable time slots on the booking engine
            </p>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={loadClosures}
              className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm transition min-h-[44px] cursor-pointer"
              style={{
                border: "1px solid oklch(0.84 0.042 80)",
                background: CARD_WHITE,
                color: "oklch(0.45 0.04 50)",
                boxShadow: "0 2px 8px oklch(0.35 0.15 22 / 4%)",
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition min-h-[44px] cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
              }}
            >
              <CalendarX className="h-4 w-4" />
              {showAddForm ? "Hide Form" : "Block New Date"}
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3 animate-fade-up delay-100">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
            style={{
              border: "1px solid oklch(0.84 0.042 80 / 70%)",
              background: CARD_WHITE,
            }}
          >
            <CalendarX className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.04 50)" }} />
            <span style={{ color: TEXT_MUTED }}>
              <span className="font-semibold" style={{ color: TEXT_DARK }}>
                {activeAndUpcomingClosures.length}
              </span>{" "}
              active &amp; upcoming closures
            </span>
          </div>

          <div
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
            style={{
              border: "1px solid oklch(0.35 0.15 22 / 20%)",
              background:
                "linear-gradient(135deg, oklch(0.35 0.15 22 / 6%), oklch(0.68 0.13 68 / 4%))",
            }}
          >
            <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span style={{ color: "oklch(0.45 0.08 40)" }}>
              <span className="font-semibold">{upcomingCount}</span> upcoming ·{" "}
              <span className="font-semibold">{activeTodayCount}</span> active today
            </span>
          </div>

          <div
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
            style={{
              border: "1px solid oklch(0.84 0.042 80 / 70%)",
              background: CARD_WHITE,
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span style={{ color: TEXT_MUTED }}>
              <span className="font-semibold text-emerald-700">Real-Time Booking Sync</span> active
            </span>
          </div>
        </div>

        {/* Add Closure Card / Form */}
        {showAddForm && (
          <div
            className="rounded-2xl p-5 sm:p-6 shadow-sm border transition-all animate-fade-up"
            style={{
              background: CARD_WHITE,
              borderColor: "oklch(0.84 0.042 80 / 70%)",
              boxShadow: "0 4px 20px oklch(0.35 0.15 22 / 5%)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-4 mb-5 border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs"
                  style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold font-serif" style={{ color: TEXT_DARK }}>
                    Block Date or Schedule Holiday
                  </h2>
                  <p className="text-xs" style={{ color: TEXT_MUTED }}>
                    Appointments will be blocked on the chosen dates.
                  </p>
                </div>
              </div>

              {/* Toggle Single vs Range */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 border border-neutral-200 text-xs">
                <button
                  type="button"
                  onClick={() => setIsRangeMode(false)}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    !isRangeMode
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Single Day
                </button>
                <button
                  type="button"
                  onClick={() => setIsRangeMode(true)}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    isRangeMode
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Date Range
                </button>
              </div>
            </div>

            <form onSubmit={handleAddClosure} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600 block">
                    {isRangeMode ? "From Date" : "Date to Block"} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    min={todayStr}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-10 text-xs rounded-xl bg-white border-neutral-200"
                  />
                </div>

                {/* End Date (if Range) */}
                {isRangeMode && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600 block">
                      To Date (Inclusive) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate && startDate > todayStr ? startDate : todayStr}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="h-10 text-xs rounded-xl bg-white border-neutral-200"
                    />
                  </div>
                )}

                {/* Reason input */}
                <div className={`space-y-1.5 ${isRangeMode ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-1 lg:col-span-2"}`}>
                  <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600 block">
                    Closure Reason / Label <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder='e.g., "Diwali Festival", "Annual Salon Maintenance"'
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="h-10 text-xs rounded-xl bg-white border-neutral-200"
                  />
                </div>
              </div>

              {/* Quick Preset Pills */}
              <div className="pt-1">
                <span className="text-[11px] font-medium text-neutral-400 block mb-1.5">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReason(p)}
                      className="px-2.5 py-1 rounded-lg text-xs border border-neutral-200 bg-neutral-50/80 hover:bg-neutral-100 text-neutral-700 transition cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 text-xs font-semibold rounded-xl text-white shadow-md flex items-center gap-2 cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
                >
                  <Lock className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Block & Synchronize Dates"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="relative animate-fade-up delay-200">
          <Search
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "oklch(0.65 0.04 50)" }}
          />
          <input
            type="text"
            placeholder="Search by reason, holiday, or date (YYYY-MM-DD)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition"
            style={{
              background: CARD_WHITE,
              border: "1px solid oklch(0.84 0.042 80)",
              color: TEXT_DARK,
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = GOLD;
              (e.currentTarget as HTMLInputElement).style.boxShadow =
                "0 0 0 3px oklch(0.68 0.13 68 / 12%)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "oklch(0.84 0.042 80)";
              (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
            }}
          />
        </div>

        {/* Closures Table */}
        <div
          className="rounded-2xl border overflow-hidden shadow-xs animate-fade-up delay-300"
          style={{
            background: CARD_WHITE,
            borderColor: "oklch(0.84 0.042 80 / 60%)",
          }}
        >
          {filteredClosures.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarDays className="mx-auto h-9 w-9 text-neutral-300 mb-2" />
              <p className="text-sm font-semibold" style={{ color: TEXT_DARK }}>
                No closures scheduled
              </p>
              <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
                {query.trim()
                  ? `No closures match "${query}". Try another search term.`
                  : "All days are currently open for client appointments."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/90 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Date / Range</th>
                    <th className="py-3.5 px-4">Reason / Holiday</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredClosures.map((item) => {
                    const isSingle = item.startDate === item.endDate;
                    const startParsed = parseISO(item.startDate);
                    const endParsed = parseISO(item.endDate);

                    const isActive = todayStr >= item.startDate && todayStr <= item.endDate;
                    const isPast = item.endDate < todayStr;
                    const isUpcoming = item.startDate > todayStr;

                    // Calculate number of days
                    const daysCount = isSingle
                      ? 1
                      : Math.round(
                          (endParsed.getTime() - startParsed.getTime()) / (1000 * 3600 * 24),
                        ) + 1;

                    return (
                      <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                        {/* Date column */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80 flex-shrink-0">
                              <CalendarX className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-900 text-xs sm:text-sm">
                                {isSingle
                                  ? format(startParsed, "dd MMM yyyy")
                                  : `${format(startParsed, "dd MMM yyyy")} – ${format(endParsed, "dd MMM yyyy")}`}
                              </p>
                              <p className="text-[10px] text-neutral-400 mt-0.5">
                                {isSingle ? format(startParsed, "EEEE") : `${daysCount} consecutive days`}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-4 px-4">
                          <span
                            className="font-medium text-xs text-neutral-800"
                            style={{ fontFamily: "var(--font-serif)" }}
                          >
                            {item.reason}
                          </span>
                        </td>

                        {/* Duration pill */}
                        <td className="py-4 px-4">
                          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
                            {daysCount} {daysCount === 1 ? "day" : "days"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                              Active Today
                            </span>
                          ) : isUpcoming ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Upcoming
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                              Past
                            </span>
                          )}
                        </td>

                        {/* Action: Reopen / Delete */}
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setClosureToDelete(item)}
                            title="Reopen Date"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:text-red-600 hover:bg-red-50 border border-neutral-200 hover:border-red-200 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Reopen Date</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  );
}
