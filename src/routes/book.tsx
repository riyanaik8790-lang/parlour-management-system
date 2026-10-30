import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarIcon, CheckCircle2, ShoppingCart, X, Ban, CalendarX, Bell, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, getUser, clearSession } from "@/lib/api";
import {
  ALL_SERVICES,
  SERVICE_CATEGORIES,
  TIME_SLOTS,
  BUFFER_MINS,
  getAllServiceCategories,
  REMINDER_OPTIONS,
  formatReminderLabel,
  type ServiceCategory,
} from "@/lib/services-data";
import {
  isDateClosed,
  getClosureForDate,
  useClosures,
  type SalonClosure,
} from "@/lib/closures-data";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    // ?service=Gold+Bleach   (passed by the Skin Advisor page)
    service: typeof search.service === "string" ? search.service : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book an Appointment - Hemangi Glam Salon" },
      {
        name: "description",
        content: "Pick your service, date and time. No double bookings, ever.",
      },
      { property: "og:title", content: "Book an Appointment - Hemangi Glam Salon" },
      { property: "og:description", content: "Pick your service, date and time." },
    ],
  }),
  component: BookPage,
});

function getISTNow(): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(str);
}

/** Convert "HH:MM" to total minutes since midnight */
function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function BookPage() {
  const navigate = useNavigate();
  const { service: preselectedService } = Route.useSearch();

  // ── Service Cart state ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("");
  // User reminder preference (defaults to saved localStorage pref or 30 mins)
  const [reminderMinutes, setReminderMinutes] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("salon_reminder_pref");
      if (saved) return Number(saved);
    }
    return 30;
  });
  // taken: array of "HH:MM" strings that are already booked for the chosen date
  const [taken, setTaken] = useState<string[]>([]);
  const [preBridalFullyBooked, setPreBridalFullyBooked] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ready prevents a flash of the form before auth check completes
  const [ready, setReady] = useState(false);

  const isPresetReminder = REMINDER_OPTIONS.some((o) => o.value === reminderMinutes);
  const [isCustomReminder, setIsCustomReminder] = useState<boolean>(!isPresetReminder);
  const [customReminderVal, setCustomReminderVal] = useState<number>(() => {
    if (!isPresetReminder) {
      if (reminderMinutes >= 1440 && reminderMinutes % 1440 === 0) return reminderMinutes / 1440;
      if (reminderMinutes >= 60 && reminderMinutes % 60 === 0) return reminderMinutes / 60;
      return reminderMinutes;
    }
    return 45;
  });
  const [customReminderUnit, setCustomReminderUnit] = useState<"mins" | "hours" | "days">(() => {
    if (!isPresetReminder) {
      if (reminderMinutes >= 1440 && reminderMinutes % 1440 === 0) return "days";
      if (reminderMinutes >= 60 && reminderMinutes % 60 === 0) return "hours";
    }
    return "mins";
  });

  const [savingCustomReminder, setSavingCustomReminder] = useState(false);
  const [customReminderSaved, setCustomReminderSaved] = useState(false);

  const handleSelectPresetReminder = (mins: number) => {
    setIsCustomReminder(false);
    setReminderMinutes(mins);
    localStorage.setItem("salon_reminder_pref", String(mins));
    setCustomReminderSaved(false);
  };

  const handleSelectCustomReminder = () => {
    setIsCustomReminder(true);
    const m =
      customReminderUnit === "days"
        ? customReminderVal * 1440
        : customReminderUnit === "hours"
          ? customReminderVal * 60
          : customReminderVal;
    setReminderMinutes(m);
    localStorage.setItem("salon_reminder_pref", String(m));
  };

  const handleUpdateCustomReminder = (val: number, unit: "mins" | "hours" | "days") => {
    const safeVal = Math.max(1, val);
    setCustomReminderVal(safeVal);
    setCustomReminderUnit(unit);
    setCustomReminderSaved(false);
    const m =
      unit === "days"
        ? safeVal * 1440
        : unit === "hours"
          ? safeVal * 60
          : safeVal;
    setReminderMinutes(m);
    localStorage.setItem("salon_reminder_pref", String(m));
  };

  const handleSaveCustomReminder = async () => {
    const safeVal = Math.max(1, customReminderVal);
    setCustomReminderVal(safeVal);
    const m =
      customReminderUnit === "days"
        ? safeVal * 1440
        : customReminderUnit === "hours"
          ? safeVal * 60
          : safeVal;
    setReminderMinutes(m);
    localStorage.setItem("salon_reminder_pref", String(m));
    setSavingCustomReminder(true);
    try {
      const u = getUser();
      if (u) {
        await api.updateProfile({ default_reminder_minutes: m }).catch(() => {});
      }
      setCustomReminderSaved(true);
      toast.success(`Reminder set to ${formatReminderLabel(m)}`);
      setTimeout(() => setCustomReminderSaved(false), 2500);
    } catch {
      toast.success(`Reminder set to ${formatReminderLabel(m)}`);
    } finally {
      setSavingCustomReminder(false);
    }
  };

  // Sync reminder preference with user profile if authenticated
  useEffect(() => {
    const user = getUser();
    if (user) {
      api
        .getProfile()
        .then((p) => {
          if (p.default_reminder_minutes) {
            const m = p.default_reminder_minutes;
            setReminderMinutes(m);
            localStorage.setItem("salon_reminder_pref", String(m));
            const preset = REMINDER_OPTIONS.some((o) => o.value === m);
            if (!preset) {
              setIsCustomReminder(true);
              if (m >= 1440 && m % 1440 === 0) {
                setCustomReminderVal(m / 1440);
                setCustomReminderUnit("days");
              } else if (m >= 60 && m % 60 === 0) {
                setCustomReminderVal(m / 60);
                setCustomReminderUnit("hours");
              } else {
                setCustomReminderVal(m);
                setCustomReminderUnit("mins");
              }
            } else {
              setIsCustomReminder(false);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const isoDate = useMemo(() => (date ? format(date, "yyyy-MM-dd") : ""), [date]);

  // Live categories & services
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

  // Live salon closures (synchronized across all devices/viewports)
  const { closures } = useClosures();

  const dateClosure = useMemo(
    () => (isoDate ? getClosureForDate(isoDate) : undefined),
    [isoDate, closures],
  );

  const allLiveServices = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  // ── Derived cart values ────────────────────────────────────────────────────
  const selectedServices = useMemo(
    () => allLiveServices.filter((s) => selectedIds.includes(s.id)),
    [allLiveServices, selectedIds],
  );

  /** Sum of all selected service durations in minutes */
  const totalDuration = useMemo(
    () => selectedServices.reduce((acc, s) => acc + s.durationMins, 0),
    [selectedServices],
  );

  /**
   * Numeric total price (only counting services with a plain numeric price).
   * Returns null if no services are selected or all prices are "On request".
   */
  const totalPrice = useMemo(() => {
    if (selectedServices.length === 0) return null;
    let sum = 0;
    let hasNumeric = false;
    for (const s of selectedServices) {
      // price may be "500", "200 - 300" (take lower), or "On request"
      const match = s.price.match(/\d+/);
      if (match) {
        sum += Number(match[0]);
        hasNumeric = true;
      }
    }
    return hasNumeric ? sum : null;
  }, [selectedServices]);

  // Auth guard: show inline login prompt if not logged in (no silent redirect)
  useEffect(() => {
    setReady(true);
  }, []);

  // Pre-select service passed from the Skin Advisor (via ?service= search param)
  useEffect(() => {
    if (!preselectedService) return;
    const match = ALL_SERVICES.find(
      (s) => s.name.toLowerCase() === preselectedService.toLowerCase(),
    );
    if (match) setSelectedIds([match.id]);
  }, [preselectedService]);

  const user = ready ? getUser() : null;

  // Load already-booked slots so the UI can grey them out and prevent double-booking.
  useEffect(() => {
    if (!isoDate) {
      setTaken([]);
      setPreBridalFullyBooked(false);
      return;
    }
    let alive = true;
    setLoadingSlots(true);
    api
      .slots(isoDate)
      .then((res) => {
        if (alive) {
          setTaken(res.taken);
          setPreBridalFullyBooked(res.pre_bridal_booked ?? false);
        }
      })
      .catch(() => {
        if (alive) {
          setTaken([]);
          setPreBridalFullyBooked(false);
        }
      })
      .finally(() => alive && setLoadingSlots(false));
    return () => {
      alive = false;
    };
  }, [isoDate]);

  // ── Continuous-block availability check ───────────────────────────────────
  /**
   * Returns true when slot `t` does NOT have a free continuous block of
   * (totalDuration + BUFFER_MINS) minutes starting at that time.
   *
   * Algorithm: build a Set of taken minute-values, then walk every minute
   * in [slotStart, slotStart + totalDuration + BUFFER) and check if it's
   * occupied by any taken slot's half-hour window.
   */
  function isBlockUnavailable(t: string): boolean {
    if (totalDuration === 0) return false; // no services selected → no constraint

    const takenMinutes = new Set<number>();
    for (const tk of taken) {
      const start = toMins(tk);
      // Each taken slot occupies 30 minutes
      for (let m = start; m < start + 30; m++) takenMinutes.add(m);
    }

    const requiredEnd = toMins(t) + totalDuration + BUFFER_MINS;
    // Also block slots that would push past salon close (17:00 = 1020 min)
    if (requiredEnd > 17 * 60) return true;

    // Check every minute in the required block
    for (let m = toMins(t); m < requiredEnd; m++) {
      if (takenMinutes.has(m)) return true;
    }
    return false;
  }

  // ── Service cart toggle ────────────────────────────────────────────────────
  function toggleService(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    // Clear the selected time whenever the cart changes (duration may differ)
    setTime("");
  }

  // ── Form submission ────────────────────────────────────────────────────────
  async function submit() {
    if (selectedIds.length === 0 || !isoDate || !time) {
      toast.error("Please select at least one service, a date, and a time.");
      return;
    }

    // Strict IST Time check
    const istNow = getISTNow();
    const istTodayStr = format(istNow, "yyyy-MM-dd");
    if (isoDate < istTodayStr) {
      toast.error("Cannot book an appointment in the past.");
      return;
    }
    if (isoDate === istTodayStr) {
      const [h, m] = time.split(":").map(Number);
      const slotMinutes = h * 60 + m;
      const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
      if (slotMinutes <= currentMinutes) {
        toast.error("Cannot book an appointment in the past.");
        return;
      }
    }

    // Salon closure check
    if (isDateClosed(isoDate)) {
      const cl = getClosureForDate(isoDate);
      toast.error(
        `Salon is closed on this date (${cl?.reason || "Holiday"}). Please select another day.`,
      );
      return;
    }

    const user = getUser();
    if (!user) {
      toast.error("Please login first.");
      navigate({ to: "/login" });
      return;
    }
    setSubmitting(true);
    // 15-second timeout so the button never stays frozen on a slow network
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      await api.book({
        services: selectedIds,
        total_duration: totalDuration,
        date: isoDate,
        time,
        reminder_minutes: reminderMinutes,
      });
      toast.success("Appointment booked!");
      navigate({ to: "/my-bookings" });
    } catch (e) {
      const isAborted =
        e instanceof DOMException && e.name === "AbortError";
      const isOffline =
        !navigator.onLine ||
        (e instanceof TypeError && e.message.toLowerCase().includes("fetch"));

      if (isAborted) {
        toast.error("Request timed out. The server took too long — please try again.");
      } else if (isOffline) {
        toast.error("Network error. Please check your internet connection and try again.");
      } else {
        const msg = e instanceof Error ? e.message : "Booking failed";
        // If the backend rejected the token (expired / invalid), clear the stale
        // session so the Navbar updates and send the user back to login.
        const isAuthError =
          msg.includes("Invalid or expired session") ||
          msg.includes("Login required") ||
          msg.includes("User not found");
        if (isAuthError) {
          clearSession();
          toast.error("Your session has expired. Please log in again.");
          navigate({ to: "/login" });
        } else {
          toast.error(msg);
        }
      }
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  // Don't render the form until we've confirmed the user is authenticated
  if (!ready) return null;

  // ── Not logged in - show inline prompt instead of silent redirect ──────────
  if (!user) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden flex items-center justify-center">
        {/* ── Luxury floral/geometric background texture watermark ── */}
        <div
          className="absolute inset-0 pointer-events-none -z-10 mix-blend-multiply opacity-85"
          style={{
            backgroundImage: "url('/luxury-floral-bg.png')",
            backgroundRepeat: "repeat",
            backgroundPosition: "center",
            backgroundSize: "480px auto",
          }}
          aria-hidden="true"
        />
        <div className="relative z-0 mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-8 shadow-sm">
            <h1 className="font-serif text-3xl text-primary">Login required</h1>
            <p className="mt-2 text-muted-foreground">Please log in to book an appointment.</p>
            <Button className="mt-6 min-h-[44px]" onClick={() => navigate({ to: "/login" })}>
              Login
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              New here?{" "}
              <span
                className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => navigate({ to: "/register" })}
              >
                Create an account
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasPreBridal = selectedIds.includes("pk-prebridal");
  const isPreBridalBlocked = hasPreBridal && preBridalFullyBooked;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* ── Luxury floral/geometric background texture watermark ── */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 mix-blend-multiply opacity-85"
        style={{
          backgroundImage: "url('/luxury-floral-bg.png')",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundSize: "480px auto",
        }}
        aria-hidden="true"
      />

      <div className="relative z-0 mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <h1 className="font-serif text-3xl sm:text-4xl text-primary">Book your appointment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select one or more services, then pick a date &amp; time.
        </p>
        <div className="mt-6 sm:mt-8 grid gap-6 md:grid-cols-2">
          {/* ── Left column: service picker + date + time ── */}
          <div className="space-y-6 rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 shadow-sm">

          {/* ── Service multi-select (checkboxes) ── */}
          <div>
            <label className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Services
              {selectedIds.length > 0 && (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {selectedIds.length} selected
                </span>
              )}
            </label>
            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-3 sm:pr-3.5 [scrollbar-gutter:stable]">
              {categories.map((cat) => (
                <div key={cat.name}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.name}
                  </p>
                  <div className="space-y-1">
                    {cat.items.map((svc) => {
                      const checked = selectedIds.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          htmlFor={`svc-${svc.id}`}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                            checked
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background hover:border-accent hover:bg-accent/5",
                          )}
                        >
                          <input
                            id={`svc-${svc.id}`}
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={checked}
                            onChange={() => toggleService(svc.id)}
                          />
                          <span className="flex-1">{svc.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
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

          {/* ── Date picker ── */}
          <div>
            <label className="mb-2 block text-sm font-medium">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
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
                    const istToday = getISTNow();
                    istToday.setHours(0, 0, 0, 0);
                    const dStr = format(d, "yyyy-MM-dd");
                    return d < istToday || d.getDay() === 5 || isDateClosed(dStr);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* ── Time slots ── */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <span>Time</span>
              {loadingSlots && (
                <svg
                  className="animate-spin text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-label="Loading available time slots"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="3"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {totalDuration > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Need {totalDuration + BUFFER_MINS} min block (incl. 30 min buffer)
                </span>
              )}
            </label>

            {/* Salon Closure / Holiday Banner */}
            {dateClosure && date && (
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs text-red-900 shadow-xs animate-fade-up">
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="font-bold">Salon Closed: {dateClosure.reason}</p>
                  <p className="mt-0.5 text-red-700">
                    Appointments and booking slots are blocked on this date. Please select another day.
                  </p>
                </div>
              </div>
            )}

            {/* Pre-Bridal Package fully-booked banner */}
            {isPreBridalBlocked && date && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="mt-0.5 shrink-0 text-base">⚠️</span>
                <span>
                  The Pre-Bridal Package is fully booked for this date. Please select another day.
                </span>
              </div>
            )}

            {selectedIds.length === 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                Select at least one service above to see available slots.
              </p>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map((t) => {
                const isTaken = taken.includes(t);
                const isBlockBusy = isBlockUnavailable(t);
                const isSelected = time === t;

                // Disable ALL slots when Pre-Bridal Package is fully booked for this date
                const isPreBridalDisabled = hasPreBridal && preBridalFullyBooked;

                // Disable ALL slots when Salon is closed on this date
                const isDateClosedBlocked = Boolean(dateClosure);

                // No services selected → keep slots visible but unclickable
                const noServices = selectedIds.length === 0;

                // Past time validation for today (in IST)
                let isPastTime = false;
                if (isoDate) {
                  const istNow = getISTNow();
                  const istTodayStr = format(istNow, "yyyy-MM-dd");
                  if (isoDate === istTodayStr) {
                    const [h, m] = t.split(":").map(Number);
                    const slotMinutes = h * 60 + m;
                    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
                    isPastTime = slotMinutes <= currentMinutes;
                  }
                }

                const isDisabled =
                  isTaken ||
                  isBlockBusy ||
                  !date ||
                  isPastTime ||
                  isPreBridalDisabled ||
                  isDateClosedBlocked ||
                  noServices;

                return (
                  <button
                    key={t}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setTime(t)}
                    className={cn(
                      "rounded-md border px-1 sm:px-2 py-2.5 text-xs sm:text-sm transition min-h-[44px]",
                      (isTaken || isBlockBusy) &&
                        "cursor-not-allowed border-muted bg-muted text-muted-foreground line-through",
                      isPreBridalDisabled &&
                        !(isTaken || isBlockBusy) &&
                        "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground/50",
                      isPastTime &&
                        !(isTaken || isBlockBusy) &&
                        !isPreBridalDisabled &&
                        "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground/50",
                      noServices &&
                        !(isTaken || isBlockBusy) &&
                        !isPreBridalDisabled &&
                        !isPastTime &&
                        "cursor-not-allowed opacity-40",
                      !isDisabled &&
                        !isSelected &&
                        "border-border bg-background hover:border-accent hover:text-primary",
                      isSelected && "border-primary bg-primary text-primary-foreground",
                      !date && "opacity-60",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* ── Custom Reminder Selector ── */}
            <div className="space-y-2.5 pt-3 border-t border-border/60">
              <div className="flex items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                  Appointment Reminder
                </label>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {REMINDER_OPTIONS.map((opt) => {
                  const isSelected = !isCustomReminder && reminderMinutes === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectPresetReminder(opt.value)}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-xs font-medium transition cursor-pointer select-none text-center flex flex-col items-center justify-center gap-0.5 min-h-[44px]",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/40 shadow-xs"
                          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <span className="font-semibold text-xs leading-tight">
                        {opt.label.replace(" before", "")}
                      </span>
                      <span className="text-[10px] opacity-75">before</span>
                    </button>
                  );
                })}

                {/* Custom Time Option Pill */}
                <button
                  type="button"
                  onClick={handleSelectCustomReminder}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs font-medium transition cursor-pointer select-none text-center flex flex-col items-center justify-center gap-0.5 min-h-[44px]",
                    isCustomReminder
                      ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/40 shadow-xs"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <span className="font-semibold text-xs leading-tight">
                    {isCustomReminder
                      ? `${customReminderVal} ${customReminderUnit === "days" ? "d" : customReminderUnit === "hours" ? "hr" : "m"}`
                      : "Custom"}
                  </span>
                  <span className="text-[10px] opacity-75">
                    {isCustomReminder ? "before" : "time"}
                  </span>
                </button>
              </div>

              {/* Inline Custom Time Entry (displayed when Custom is selected) */}
              {isCustomReminder && (
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border border-primary/20 bg-primary/5 text-xs animate-fade-in">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground shrink-0">Remind me:</span>
                    <Input
                      type="number"
                      min={1}
                      max={customReminderUnit === "days" ? 30 : customReminderUnit === "hours" ? 72 : 1440}
                      value={customReminderVal}
                      onChange={(e) =>
                        handleUpdateCustomReminder(Number(e.target.value) || 1, customReminderUnit)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveCustomReminder();
                        }
                      }}
                      className="h-8 w-16 text-center text-xs font-semibold bg-background border-border"
                    />
                    <div className="flex rounded-lg border border-border bg-background p-0.5">
                      {(["mins", "hours", "days"] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => handleUpdateCustomReminder(customReminderVal, unit)}
                          className={cn(
                            "px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer select-none",
                            customReminderUnit === unit
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {unit === "mins" ? "Mins" : unit === "hours" ? "Hours" : "Days"}
                        </button>
                      ))}
                    </div>
                    <span className="text-muted-foreground shrink-0">before appointment</span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveCustomReminder}
                    disabled={savingCustomReminder}
                    className="h-8 px-3.5 text-xs font-semibold rounded-lg shrink-0 gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer ml-auto"
                  >
                    {savingCustomReminder ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : customReminderSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Save</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: booking summary ── */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 shadow-sm">
          <div>
            <div className="text-sm text-muted-foreground">Booking summary</div>

            {/* Selected services list */}
            {selectedServices.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground italic">No services selected yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {selectedServices.map((svc) => (
                  <li
                    key={svc.id}
                    className="flex items-center justify-between rounded-md border border-dashed border-border/60 px-2 py-1 text-sm"
                  >
                    <span className="flex items-center gap-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove ${svc.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {svc.name}
                    </span>
                    <span className="ml-2 shrink-0 text-muted-foreground">
                      {svc.price !== "On request" ? `₹${svc.price}` : "On request"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Totals */}
            {selectedServices.length > 0 && (
              <dl className="mt-3 space-y-1 text-sm border-t border-border/60 pt-2">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total duration</dt>
                  <dd className="font-medium text-foreground">{totalDuration} min</dd>
                </div>
                {totalPrice !== null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Estimated total</dt>
                    <dd className="font-semibold text-primary">₹{totalPrice}+</dd>
                  </div>
                )}
              </dl>
            )}

            {/* Date & Time row */}
            <dl className="mt-3 space-y-2 text-sm border-t border-border/60 pt-2">
              <Row label="Date" value={date ? format(date, "PPP") : "-"} />
              <Row label="Time" value={time || "-"} />
              <Row label="Reminder" value={formatReminderLabel(reminderMinutes)} />
            </dl>

            <div className="mt-4 flex items-start gap-2 rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              Payment is handled at the salon after service. No online payment required.
            </div>
          </div>
          <Button
            size="lg"
            className="mt-6 w-full min-h-[44px] gap-2"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? (
              /* Animated SVG circle spinner — no text, pure visual feedback */
              <svg
                className="animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-label="Loading"
              >
                {/* Track circle */}
                <circle
                  cx="12" cy="12" r="10"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="3"
                />
                {/* Spinning arc — covers ~75% of the circumference */}
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              "Confirm booking"
            )}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-border/60 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
