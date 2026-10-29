import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import {
  SERVICE_CATEGORIES,
  TIME_SLOTS,
  BUFFER_MINS,
  getAllServiceCategories,
  saveCustomServiceCategory,
  deleteServiceCategory,
  deleteSubService,
  calculateCategoryStartingPrice,
  type ServiceCategory,
  type Service,
} from "@/lib/services-data";
import { isDateClosed } from "@/lib/closures-data";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  Scissors,
  ArrowRight,
  Sparkles,
  PlusCircle,
  X,
  CalendarIcon,
  Loader2,
  Phone,
  User,
  Image as ImageIcon,
  Layers,
  CalendarX,
  Trash2,
  Plus,
  Upload,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  ShoppingCart,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Brand palette tokens ──────────────────────────────────────────────────────
const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const GOLD_LIGHT = "oklch(0.80 0.10 72)";
const CARD_WHITE = "rgba(255,255,255,0.92)";
const TEXT_DARK = "oklch(0.25 0.05 50)";
const TEXT_MUTED = "oklch(0.58 0.04 60)";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard - Admin | Hemangi Glam Salon" }] }),
  component: AdminDashboard,
});

type Stats = {
  total_users: number;
  bookings_today: number;
  total_services: number;
  bookings_mtd: number;
  total_bookings: number;
};

// ── Walk-in Booking Modal ─────────────────────────────────────────────────────
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
function getISTNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function WalkinModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [offlineName, setOfflineName] = useState("");
  const [offlinePhone, setOfflinePhone] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [preBridalBooked, setPreBridalBooked] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live service categories (sync with service management)
  const [categories, setCategories] = useState<ServiceCategory[]>(() => getAllServiceCategories());

  useEffect(() => {
    const handleSync = () => setCategories(getAllServiceCategories());
    window.addEventListener("salon-services-updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("salon-services-updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const isoDate = useMemo(() => (date ? format(date, "yyyy-MM-dd") : ""), [date]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setOfflineName("");
      setOfflinePhone("");
      setSelectedIds([]);
      setDate(undefined);
      setTime("");
      setTaken([]);
      setPreBridalBooked(false);
    }
  }, [open]);

  const allServices = useMemo(() => categories.flatMap((c) => c.items), [categories]);
  const selectedServices = useMemo(
    () => allServices.filter((s) => selectedIds.includes(s.id)),
    [allServices, selectedIds],
  );
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.durationMins || 30), 0),
    [selectedServices],
  );

  function toggleService(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setTime("");
  }

  function toMins(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function isBlockUnavailable(t: string): boolean {
    if (totalDuration === 0) return false;

    const takenMinutes = new Set<number>();
    for (const tk of taken) {
      const start = toMins(tk);
      for (let m = start; m < start + 30; m++) takenMinutes.add(m);
    }

    const requiredEnd = toMins(t) + totalDuration + BUFFER_MINS;
    if (requiredEnd > 17 * 60) return true;

    for (let m = toMins(t); m < requiredEnd; m++) {
      if (takenMinutes.has(m)) return true;
    }
    return false;
  }

  // Fetch taken slots + pre-bridal flag whenever date changes
  useEffect(() => {
    if (!isoDate) {
      setTaken([]);
      setPreBridalBooked(false);
      return;
    }
    let alive = true;
    setLoadingSlots(true);
    setTime("");
    api
      .slots(isoDate)
      .then((res) => {
        if (alive) {
          setTaken(res.taken);
          setPreBridalBooked(res.pre_bridal_booked ?? false);
        }
      })
      .catch(() => {
        if (alive) {
          setTaken([]);
          setPreBridalBooked(false);
        }
      })
      .finally(() => {
        if (alive) setLoadingSlots(false);
      });
    return () => {
      alive = false;
    };
  }, [isoDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!offlineName.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    const trimPhone = offlinePhone.trim().replace(/\D/g, "");
    if (!trimPhone) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!INDIAN_PHONE_RE.test(trimPhone)) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Please select at least one service.");
      return;
    }
    if (!isoDate) {
      toast.error("Please select a date.");
      return;
    }
    if (!time) {
      toast.error("Please select a time slot.");
      return;
    }

    setSubmitting(true);
    try {
      await api.adminBookOffline({
        service_id: selectedIds[0],
        services: selectedIds,
        total_duration: totalDuration,
        date: isoDate,
        time,
        offline_name: offlineName.trim(),
        offline_phone: trimPhone,
      });
      toast.success(
        `Walk-in booking for ${selectedIds.length} service${selectedIds.length > 1 ? "s" : ""} saved for ${offlineName.trim()}!`,
      );
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save booking");
    } finally {
      setSubmitting(false);
    }
  }

  const isPreBridalSelected = selectedIds.some(
    (id) => id === "pk-prebridal" || id === "pb-package",
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto p-0 gap-0"
        style={{
          borderRadius: "1.25rem",
          border: "1px solid oklch(0.88 0.030 82)",
          boxShadow: "0 24px 80px oklch(0.35 0.15 22 / 14%), 0 8px 32px oklch(0.35 0.15 22 / 8%)",
        }}
      >
        {/* Modal header */}
        <DialogHeader
          className="px-6 pt-6 pb-4"
          style={{
            background: `linear-gradient(135deg, oklch(0.35 0.15 22 / 5%) 0%, oklch(0.68 0.13 68 / 6%) 100%)`,
            borderBottom: "1px solid oklch(0.90 0.025 82)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
            >
              <PlusCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle
                className="text-lg font-bold leading-tight"
                style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
              >
                Add Walk-in / Offline Booking
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>
                Log a phone or in-salon booking. All slot rules apply.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Customer Name */}
          <div className="space-y-1.5">
            <label
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              <User className="h-3 w-3" /> Customer Name <span style={{ color: BURGUNDY }}>*</span>
            </label>
            <Input
              id="offline-customer-name"
              placeholder="e.g. Priya Sharma"
              value={offlineName}
              onChange={(e) => setOfflineName(e.target.value)}
              required
              className="h-10"
            />
          </div>

          {/* Customer Phone */}
          <div className="space-y-1.5">
            <label
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              <Phone className="h-3 w-3" /> Customer Phone <span style={{ color: BURGUNDY }}>*</span>
            </label>
            <Input
              id="offline-customer-phone"
              placeholder="e.g. 9876543210"
              value={offlinePhone}
              onChange={(e) => setOfflinePhone(e.target.value)}
              type="tel"
              maxLength={13}
              className="h-10"
            />
          </div>

          {/* Service multi-select (checkboxes) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
                style={{ color: TEXT_MUTED }}
              >
                <Scissors className="h-3.5 w-3.5" style={{ color: GOLD }} />
                Services <span style={{ color: BURGUNDY }}>*</span>
              </label>
              {selectedIds.length > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    background: "oklch(0.35 0.15 22 / 10%)",
                    color: BURGUNDY,
                  }}
                >
                  {selectedIds.length} selected ({totalDuration}m)
                </span>
              )}
            </div>

            <div
              className="space-y-3 max-h-60 overflow-y-auto pr-3 sm:pr-3.5 [scrollbar-gutter:stable] p-2.5 rounded-xl border"
              style={{
                borderColor: "oklch(0.88 0.030 82)",
                background: "oklch(0.99 0.005 85)",
              }}
            >
              {categories.map((cat) => (
                <div key={cat.name}>
                  <p
                    className="mb-1 text-[11px] font-bold uppercase tracking-wider px-1 text-muted-foreground"
                  >
                    {cat.name}
                  </p>
                  <div className="space-y-1">
                    {cat.items.map((svc) => {
                      const checked = selectedIds.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          htmlFor={`admin-svc-${svc.id}`}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors",
                            checked
                              ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                              : "border-border bg-white hover:border-accent hover:bg-accent/5",
                          )}
                        >
                          <input
                            id={`admin-svc-${svc.id}`}
                            type="checkbox"
                            className="h-4 w-4 accent-primary rounded cursor-pointer shrink-0"
                            checked={checked}
                            onChange={() => toggleService(svc.id)}
                          />
                          <span className="flex-1 truncate">{svc.name}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {svc.price !== "On request" ? `₹${svc.price}` : "On request"}
                            {" · "}
                            {svc.durationMins} min
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              Date <span style={{ color: BURGUNDY }}>*</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="offline-date"
                  variant="outline"
                  className={cn(
                    "w-full h-10 justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" style={{ color: GOLD }} />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setTime("");
                  }}
                  disabled={(d) => {
                    const today = getISTNow();
                    today.setHours(0, 0, 0, 0);
                    const dStr = format(d, "yyyy-MM-dd");
                    return d < today || d.getDay() === 5 || isDateClosed(dStr);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
              Fridays and closed holiday dates are unavailable.
            </p>
          </div>

          {/* Time slots */}
          <div className="space-y-1.5">
            <label
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              Time Slot <span style={{ color: BURGUNDY }}>*</span>
              {loadingSlots && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
            </label>

            {!date ? (
              <div
                className="rounded-lg flex items-center justify-center h-12 text-xs"
                style={{
                  background: "oklch(0.96 0.010 82)",
                  border: "1px dashed oklch(0.84 0.042 80)",
                  color: TEXT_MUTED,
                }}
              >
                Select a date first
              </div>
            ) : isPreBridalSelected && preBridalBooked ? (
              /* Pre-Bridal fully-booked warning */
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
                ⚠️ The Pre-Bridal Package is fully booked for this date. Please select another day.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_SLOTS.map((t) => {
                  const isTaken = taken.includes(t);
                  const isBlockBusy = isBlockUnavailable(t);
                  const isSelected = time === t;

                  const istNow = getISTNow();
                  const istTodayStr = format(istNow, "yyyy-MM-dd");
                  let isPast = false;
                  if (isoDate === istTodayStr) {
                    const [h, m] = t.split(":").map(Number);
                    isPast = h * 60 + m <= istNow.getHours() * 60 + istNow.getMinutes();
                  }

                  const isDisabled = isTaken || isBlockBusy || isPast;

                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setTime(t)}
                      className={cn(
                        "rounded-md border py-2 text-xs transition min-h-[36px]",
                        (isTaken || isBlockBusy) &&
                          "cursor-not-allowed border-muted bg-muted text-muted-foreground line-through",
                        isPast &&
                          !(isTaken || isBlockBusy) &&
                          "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground/50",
                        !isDisabled &&
                          !isSelected &&
                          "border-border bg-background hover:border-accent hover:text-primary",
                        isSelected &&
                          "border-primary bg-primary text-primary-foreground font-semibold",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary strip */}
          {selectedIds.length > 0 && date && time && (
            <div
              className="rounded-xl px-4 py-3 text-xs space-y-1.5"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.35 0.15 22 / 5%), oklch(0.68 0.13 68 / 5%))",
                border: "1px solid oklch(0.88 0.030 82)",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold" style={{ color: BURGUNDY }}>
                  Booking Summary
                </p>
                <span className="font-bold" style={{ color: BURGUNDY }}>
                  {totalDuration} mins
                </span>
              </div>
              <p style={{ color: TEXT_MUTED }}>
                <span className="font-medium" style={{ color: TEXT_DARK }}>
                  {offlineName || "—"}
                </span>
                {offlinePhone && <> · {offlinePhone}</>}
              </p>
              <p className="font-medium" style={{ color: TEXT_DARK }}>
                {selectedServices.map((s) => s.name).join(", ")}
              </p>
              <p style={{ color: TEXT_MUTED }}>
                {format(date, "d MMM yyyy")} · {time}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={
                submitting ||
                !offlineName.trim() ||
                selectedIds.length === 0 ||
                !isoDate ||
                !time ||
                (isPreBridalSelected && preBridalBooked)
              }
              className="flex-1 min-h-[44px] gap-2 font-semibold"
              style={{
                background: submitting
                  ? undefined
                  : `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
                boxShadow: "0 4px 14px oklch(0.35 0.15 22 / 25%)",
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save Booking"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[44px] px-5"
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Categories list for stats & card preview
  const [allCategories, setAllCategories] = useState<ServiceCategory[]>(() => getAllServiceCategories());
  const [totalServicesCount, setTotalServicesCount] = useState<number>(() => {
    return getAllServiceCategories().flatMap((c) => c.items).length;
  });

  function loadStats() {
    api
      .adminGetStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"));
    const cats = getAllServiceCategories();
    setAllCategories(cats);
    setTotalServicesCount(cats.flatMap((c) => c.items).length);
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      const cats = getAllServiceCategories();
      setAllCategories(cats);
      setTotalServicesCount(cats.flatMap((c) => c.items).length);
    };
    window.addEventListener("salon-services-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("salon-services-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const STATS = [
    {
      label: "Total Users",
      value: stats ? String(stats.total_users) : "-",
      icon: Users,
      iconBg: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
      glowColor: BURGUNDY,
      decorColor: "oklch(0.35 0.15 22 / 10%)",
    },
    {
      label: "Bookings Today",
      value: stats ? String(stats.bookings_today) : "-",
      icon: CalendarCheck,
      iconBg: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
      glowColor: GOLD,
      decorColor: "oklch(0.68 0.13 68 / 10%)",
    },
    {
      label: "Services Available",
      value: String(totalServicesCount),
      icon: Scissors,
      iconBg: "linear-gradient(135deg, oklch(0.42 0.14 18), oklch(0.55 0.12 28))",
      glowColor: "oklch(0.42 0.14 18)",
      decorColor: "oklch(0.42 0.14 18 / 9%)",
    },
    {
      label: "Bookings This Month",
      value: stats ? String(stats.bookings_mtd) : "-",
      icon: TrendingUp,
      iconBg: "linear-gradient(135deg, oklch(0.60 0.10 55), oklch(0.72 0.14 65))",
      glowColor: "oklch(0.60 0.10 55)",
      decorColor: "oklch(0.60 0.10 55 / 9%)",
    },
    {
      label: "Total Appointments",
      value: stats ? String(stats.total_bookings) : "-",
      icon: CalendarCheck,
      iconBg: `linear-gradient(135deg, ${BURGUNDY}, ${GOLD})`,
      glowColor: GOLD,
      decorColor: "oklch(0.68 0.13 68 / 12%)",
    },
  ];

  return (
    <div className="relative min-h-full -mx-4 sm:-mx-6 lg:-mx-12 -my-4 sm:-my-6 lg:-my-8 px-5 sm:px-8 lg:px-12 py-6 sm:py-8 overflow-hidden">
      {/* ── Subtle, executive floral lattice background pattern ── */}
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

      <div className="space-y-8 sm:space-y-10 max-w-[1400px] mx-auto px-1 sm:px-0 relative z-0">
        {/* Walk-in modal */}
        <WalkinModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={loadStats} />

        {/* Header */}
        <div className="animate-fade-up flex flex-wrap items-start justify-between gap-4">
          <div>
            <span
              className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.35 0.15 22 / 8%), oklch(0.68 0.13 68 / 6%))",
                color: BURGUNDY,
                border: "1px solid oklch(0.35 0.15 22 / 18%)",
              }}
            >
              <Sparkles className="h-3 w-3" style={{ color: GOLD }} />
              Admin Overview
            </span>
            <h1
              className="text-2xl sm:text-4xl font-bold leading-tight"
              style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
            >
              Dashboard
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
              Welcome back! Here&apos;s what&apos;s happening at Hemangi Glam.
            </p>
          </div>

          {/* ── Header Action Buttons ── */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            {/* Manage Services Link */}
            <Link
              to="/admin/services"
              id="admin-manage-services-btn"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-200 flex-1 sm:flex-none"
              style={{
                background: "oklch(0.998 0.004 85)",
                color: BURGUNDY,
                border: `1.5px solid ${GOLD}`,
                boxShadow: "0 4px 16px oklch(0.68 0.13 68 / 18%)",
              }}
            >
              <Layers className="h-4 w-4" style={{ color: GOLD }} />
              Manage Services
            </Link>

            {/* Walk-in CTA button */}
            <button
              id="admin-add-walkin-btn"
              onClick={() => setModalOpen(true)}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-lg transition-all duration-200 flex-1 sm:flex-none cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
                boxShadow: `0 6px 24px oklch(0.35 0.15 22 / 30%)`,
              }}
            >
              <PlusCircle className="h-4 w-4 transition-transform group-hover:rotate-90 duration-200" />
              <span>Add Walk-in Booking</span>
            </button>
          </div>
        </div>

        {error && (
          <div
            className="rounded-2xl p-4 text-sm animate-fade-up"
            style={{
              background: "oklch(0.577 0.245 27.325 / 8%)",
              border: "1px solid oklch(0.577 0.245 27.325 / 20%)",
              color: "oklch(0.45 0.18 27)",
            }}
          >
            ⚠️ Could not load live stats — ensure the backend is running. {error}
          </div>
        )}

        {/* Stat cards - 2 columns on mobile */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5 animate-fade-up delay-100">
          {STATS.map(({ label, value, icon: Icon, iconBg, glowColor, decorColor }) => (
            <div
              key={label}
              className="group relative overflow-hidden rounded-2xl p-4 sm:p-7 transition-all duration-300 hover:-translate-y-1.5"
              style={{
                background: CARD_WHITE,
                boxShadow: "0 4px 30px oklch(0.35 0.15 22 / 7%), 0 1px 4px oklch(0.35 0.15 22 / 4%)",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  `0 16px 48px ${glowColor}25, 0 4px 16px oklch(0.35 0.15 22 / 8%)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "0 4px 30px oklch(0.35 0.15 22 / 7%), 0 1px 4px oklch(0.35 0.15 22 / 4%)";
              }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 sm:h-24 sm:w-24 rounded-full blur-2xl opacity-60 transition-opacity group-hover:opacity-100"
                style={{ background: decorColor }}
              />
              <div
                className="pointer-events-none absolute -bottom-4 -left-4 h-12 w-12 sm:h-16 sm:w-16 rounded-full blur-xl opacity-30"
                style={{ background: decorColor }}
              />
              <div
                className="mb-3 sm:mb-5 inline-flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl shadow-md"
                style={{ background: iconBg }}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <p
                className="text-2xl sm:text-4xl font-bold leading-none"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                {value === "-" && !stats ? (
                  <span
                    className="inline-block h-7 w-12 sm:h-9 sm:w-14 animate-pulse rounded-lg"
                    style={{ background: "oklch(0.91 0.025 82)" }}
                  />
                ) : (
                  value
                )}
              </p>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium leading-snug" style={{ color: TEXT_MUTED }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Actions - 2 columns on mobile */}
        <div className="animate-fade-up delay-400">
          <h2
            className="mb-3.5 sm:mb-5 text-xs font-semibold uppercase tracking-widest"
            style={{ color: GOLD }}
          >
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Manage Users */}
            <Link
              to="/admin/users"
              className="group flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 rounded-2xl p-3.5 sm:p-6 transition-all duration-300"
              style={{
                background: CARD_WHITE,
                boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 12px 40px oklch(0.35 0.15 22 / 12%)";
                el.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 4px 24px oklch(0.35 0.15 22 / 6%)";
                el.style.transform = "translateY(0)";
              }}
            >
              <div
                className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
                style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
              >
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <p
                  className="font-semibold text-xs sm:text-base leading-tight"
                  style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
                >
                  Manage Users
                </p>
                <p className="mt-1 text-[11px] sm:text-sm line-clamp-2" style={{ color: TEXT_MUTED }}>
                  {stats
                    ? `${stats.total_users} registered customer${stats.total_users !== 1 ? "s" : ""}`
                    : "View all registered customers"}
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 hidden sm:block opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
                style={{ color: GOLD }}
              />
            </Link>

            {/* Manage Bookings */}
            <Link
              to="/admin/bookings"
              className="group flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 rounded-2xl p-3.5 sm:p-6 transition-all duration-300"
              style={{
                background: CARD_WHITE,
                boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 12px 40px oklch(0.68 0.13 68 / 16%)";
                el.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 4px 24px oklch(0.35 0.15 22 / 6%)";
                el.style.transform = "translateY(0)";
              }}
            >
              <div
                className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
                style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}
              >
                <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <p
                  className="font-semibold text-xs sm:text-base leading-tight"
                  style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
                >
                  Manage Bookings
                </p>
                <p className="mt-1 text-[11px] sm:text-sm line-clamp-2" style={{ color: TEXT_MUTED }}>
                  {stats
                    ? `${stats.bookings_today} booking${stats.bookings_today !== 1 ? "s" : ""} today`
                    : "View and manage appointments"}
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 hidden sm:block opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
                style={{ color: GOLD }}
              />
            </Link>

            {/* Manage Services */}
            <Link
              to="/admin/services"
              className="group flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 rounded-2xl p-3.5 sm:p-6 transition-all duration-300 text-left cursor-pointer"
              style={{
                background: CARD_WHITE,
                boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 12px 40px oklch(0.35 0.15 22 / 12%)";
                el.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 4px 24px oklch(0.35 0.15 22 / 6%)";
                el.style.transform = "translateY(0)";
              }}
            >
              <div
                className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
                style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${GOLD})` }}
              >
                <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <p
                  className="font-semibold text-xs sm:text-base leading-tight"
                  style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
                >
                  Manage Services
                </p>
                <p className="mt-1 text-[11px] sm:text-sm line-clamp-2" style={{ color: TEXT_MUTED }}>
                  {totalServicesCount} sub-services across {allCategories.length} categories
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 hidden sm:block opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
                style={{ color: GOLD }}
              />
            </Link>

            {/* Closure Manager */}
            <Link
              to="/admin/closures"
              className="group flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 rounded-2xl p-3.5 sm:p-6 transition-all duration-300 text-left cursor-pointer"
              style={{
                background: CARD_WHITE,
                boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 12px 40px oklch(0.45 0.20 27 / 14%)";
                el.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 4px 24px oklch(0.35 0.15 22 / 6%)";
                el.style.transform = "translateY(0)";
              }}
            >
              <div
                className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
                style={{
                  background: "linear-gradient(135deg, oklch(0.45 0.20 27), oklch(0.55 0.18 22))",
                }}
              >
                <CalendarX className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <p
                  className="font-semibold text-xs sm:text-base leading-tight"
                  style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
                >
                  Closure Manager
                </p>
                <p className="mt-1 text-[11px] sm:text-sm line-clamp-2" style={{ color: TEXT_MUTED }}>
                  Block dates, holidays &amp; salon maintenance
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 hidden sm:block opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
                style={{ color: GOLD }}
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
