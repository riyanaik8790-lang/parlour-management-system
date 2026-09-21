import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { SERVICE_CATEGORIES, TIME_SLOTS } from "@/lib/services-data";
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
  const [phoneError, setPhoneError] = useState("");
  const [nameError, setNameError] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [preBridalBooked, setPreBridalBooked] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isoDate = useMemo(() => (date ? format(date, "yyyy-MM-dd") : ""), [date]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setOfflineName("");
      setOfflinePhone("");
      setPhoneError("");
      setNameError("");
      setServiceId("");
      setDate(undefined);
      setTime("");
      setTaken([]);
      setPreBridalBooked(false);
    }
  }, [open]);

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
    let hasError = false;

    if (!offlineName.trim()) {
      setNameError("Customer name is required.");
      hasError = true;
    }
    const trimPhone = offlinePhone.trim().replace(/\D/g, "");
    if (!trimPhone) {
      setPhoneError("Phone number is required.");
      hasError = true;
    } else if (!INDIAN_PHONE_RE.test(trimPhone)) {
      setPhoneError("Enter a valid 10-digit Indian mobile number (starting with 6–9).");
      hasError = true;
    }
    if (!serviceId) {
      toast.error("Please select a service.");
      hasError = true;
    }
    if (!isoDate) {
      toast.error("Please select a date.");
      hasError = true;
    }
    if (!time) {
      toast.error("Please select a time slot.");
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      await api.adminBookOffline({
        service_id: serviceId,
        date: isoDate,
        time,
        offline_name: offlineName.trim(),
        offline_phone: trimPhone,
      });
      toast.success(`Walk-in booking saved for ${offlineName.trim()}!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save booking");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedService = SERVICE_CATEGORIES.flatMap((c) => c.items).find(
    (s) => s.id === serviceId,
  );
  const isPreBridalSelected = serviceId === "pk-prebridal" || serviceId === "pb-package";

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
              style={{ color: nameError ? "oklch(0.577 0.245 27.325)" : TEXT_MUTED }}
            >
              <User className="h-3 w-3" /> Customer Name <span style={{ color: BURGUNDY }}>*</span>
            </label>
            <Input
              id="offline-customer-name"
              placeholder="e.g. Priya Sharma"
              value={offlineName}
              onChange={(e) => {
                setOfflineName(e.target.value);
                if (e.target.value.trim()) setNameError("");
              }}
              required
              className="h-10"
              style={nameError ? { borderColor: "oklch(0.577 0.245 27.325)", boxShadow: "0 0 0 3px oklch(0.577 0.245 27.325 / 12%)" } : {}}
            />
            {nameError && (
              <p className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.577 0.245 27.325)" }}>
                <span>✕</span> {nameError}
              </p>
            )}
          </div>

          {/* Customer Phone */}
          <div className="space-y-1.5">
            <label
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: phoneError ? "oklch(0.577 0.245 27.325)" : TEXT_MUTED }}
            >
              <Phone className="h-3 w-3" /> Customer Phone <span style={{ color: BURGUNDY }}>*</span>
            </label>
            <Input
              id="offline-customer-phone"
              placeholder="e.g. 9876543210"
              value={offlinePhone}
              onChange={(e) => {
                const val = e.target.value;
                setOfflinePhone(val);
                // Live validation: clear error once valid
                const digits = val.trim().replace(/\D/g, "");
                if (INDIAN_PHONE_RE.test(digits)) setPhoneError("");
                else if (!val.trim()) setPhoneError("Phone number is required.");
              }}
              type="tel"
              maxLength={13}
              className="h-10"
              style={phoneError ? { borderColor: "oklch(0.577 0.245 27.325)", boxShadow: "0 0 0 3px oklch(0.577 0.245 27.325 / 12%)" } : {}}
            />
            {phoneError ? (
              <p className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.577 0.245 27.325)" }}>
                <span>✕</span> {phoneError}
              </p>
            ) : (
              <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
                10-digit Indian mobile number (starts with 6, 7, 8, or 9)
              </p>
            )}
          </div>

          {/* Service */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              Service <span style={{ color: BURGUNDY }}>*</span>
            </label>
            <Select
              value={serviceId}
              onValueChange={(v) => {
                setServiceId(v);
                setTime("");
              }}
            >
              <SelectTrigger id="offline-service" className="w-full h-10">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((cat) => (
                  <SelectGroup key={cat.name}>
                    <SelectLabel>{cat.name}</SelectLabel>
                    {cat.items.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.price !== "On request" ? ` — ₹${s.price}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
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
                    return d < today || d.getDay() === 5;
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
              Fridays are closed.
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
                {TIME_SLOTS.map((t, index) => {
                  const isTaken = taken.includes(t);
                  const prevSlot = index > 0 ? TIME_SLOTS[index - 1] : null;
                  const isBuffer = prevSlot ? taken.includes(prevSlot) : false;
                  const isSelected = time === t;

                  const istNow = getISTNow();
                  const istTodayStr = format(istNow, "yyyy-MM-dd");
                  let isPast = false;
                  if (isoDate === istTodayStr) {
                    const [h, m] = t.split(":").map(Number);
                    isPast = h * 60 + m <= istNow.getHours() * 60 + istNow.getMinutes();
                  }

                  const isDisabled = isTaken || isBuffer || isPast;

                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setTime(t)}
                      className={cn(
                        "rounded-md border py-2 text-xs transition min-h-[36px]",
                        (isTaken || isBuffer) &&
                          "cursor-not-allowed border-muted bg-muted text-muted-foreground line-through",
                        isPast &&
                          !(isTaken || isBuffer) &&
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
          {serviceId && date && time && (
            <div
              className="rounded-xl px-4 py-3 text-xs space-y-1"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.35 0.15 22 / 5%), oklch(0.68 0.13 68 / 5%))",
                border: "1px solid oklch(0.88 0.030 82)",
              }}
            >
              <p className="font-semibold" style={{ color: BURGUNDY }}>
                Booking Summary
              </p>
              <p style={{ color: TEXT_MUTED }}>
                <span className="font-medium" style={{ color: TEXT_DARK }}>
                  {offlineName || "—"}
                </span>
                {offlinePhone && <> · {offlinePhone}</>}
              </p>
              <p style={{ color: TEXT_MUTED }}>
                {selectedService?.name} · {format(date, "d MMM yyyy")} · {time}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={
                submitting ||
                !offlineName ||
                !serviceId ||
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

  function loadStats() {
    api
      .adminGetStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"));
  }

  useEffect(() => {
    loadStats();
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
      value: stats ? String(stats.total_services) : "53",
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
  ];

  return (
    <div className="space-y-10 px-4 sm:px-8 lg:px-12 py-8 max-w-[1400px] mx-auto">
      {/* Walk-in modal */}
      <WalkinModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={loadStats} />

      {/* Header */}
      <div className="animate-fade-up flex flex-wrap items-start justify-between gap-4">
        <div>
          <span
            className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
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
            className="text-4xl font-bold leading-tight"
            style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
          >
            Dashboard
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
            Welcome back! Here&apos;s what&apos;s happening at Hemangi Glam.
          </p>
        </div>

        {/* ── Walk-in CTA button ── */}
        <button
          id="admin-add-walkin-btn"
          onClick={() => setModalOpen(true)}
          className="group inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
            boxShadow: `0 6px 24px oklch(0.35 0.15 22 / 30%)`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              `0 10px 32px oklch(0.35 0.15 22 / 40%)`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              `0 6px 24px oklch(0.35 0.15 22 / 30%)`;
          }}
        >
          <PlusCircle className="h-4 w-4 transition-transform group-hover:rotate-90 duration-200" />
          Add Walk-in / Offline Booking
        </button>
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

      {/* Gold divider */}
      <div className="gold-divider animate-fade-up delay-100" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 animate-fade-up delay-200">
        {STATS.map(({ label, value, icon: Icon, iconBg, glowColor, decorColor }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5"
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
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-60 transition-opacity group-hover:opacity-100"
              style={{ background: decorColor }}
            />
            <div
              className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full blur-xl opacity-30"
              style={{ background: decorColor }}
            />
            <div
              className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
              style={{ background: iconBg }}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
            <p
              className="text-4xl font-bold leading-none"
              style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
            >
              {value === "-" && !stats ? (
                <span
                  className="inline-block h-9 w-14 animate-pulse rounded-lg"
                  style={{ background: "oklch(0.91 0.025 82)" }}
                />
              ) : (
                value
              )}
            </p>
            <p className="mt-2 text-sm font-medium" style={{ color: TEXT_MUTED }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Premium total bookings banner */}
      {stats && (
        <div
          className="relative overflow-hidden rounded-2xl animate-fade-up delay-300"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.35 0.15 22 / 6%) 0%, oklch(0.68 0.13 68 / 8%) 50%, oklch(0.35 0.15 22 / 4%) 100%)",
            boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
            border: "1px solid oklch(0.35 0.15 22 / 10%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ background: GOLD }}
          />
          <div
            className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full blur-3xl opacity-15"
            style={{ background: BURGUNDY }}
          />
          <div className="relative flex items-center gap-5 px-6 py-5">
            <div
              className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-2xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
            >
              <span
                className="text-2xl font-bold leading-none text-white"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {stats.total_bookings}
              </span>
            </div>
            <div className="flex-1">
              <p
                className="text-base font-semibold"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                Total Appointments
              </p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: TEXT_MUTED }}>
                Across all time — confirmed, completed &amp; active bookings
              </p>
            </div>
            <span
              className="hidden sm:inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                color: "white",
                boxShadow: `0 4px 14px oklch(0.68 0.13 68 / 35%)`,
              }}
            >
              All Time
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="animate-fade-up delay-400">
        <h2
          className="mb-5 text-xs font-semibold uppercase tracking-widest"
          style={{ color: GOLD }}
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Manage Users */}
          <Link
            to="/admin/users"
            className="group flex items-center gap-4 rounded-2xl p-6 transition-all duration-300"
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
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
            >
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p
                className="font-semibold"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                Manage Users
              </p>
              <p className="mt-0.5 text-sm" style={{ color: TEXT_MUTED }}>
                {stats
                  ? `${stats.total_users} registered customer${stats.total_users !== 1 ? "s" : ""}`
                  : "View all registered customers"}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
              style={{ color: GOLD }}
            />
          </Link>

          {/* Manage Bookings */}
          <Link
            to="/admin/bookings"
            className="group flex items-center gap-4 rounded-2xl p-6 transition-all duration-300"
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
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}
            >
              <CalendarCheck className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p
                className="font-semibold"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                Manage Bookings
              </p>
              <p className="mt-0.5 text-sm" style={{ color: TEXT_MUTED }}>
                {stats
                  ? `${stats.bookings_today} booking${stats.bookings_today !== 1 ? "s" : ""} today`
                  : "View and manage appointments"}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
              style={{ color: GOLD }}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
