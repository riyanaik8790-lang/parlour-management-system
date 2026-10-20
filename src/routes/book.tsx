import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarIcon, CheckCircle2, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, getUser, clearSession } from "@/lib/api";
import { ALL_SERVICES, SERVICE_CATEGORIES, TIME_SLOTS, BUFFER_MINS } from "@/lib/services-data";

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
  // taken: array of "HH:MM" strings that are already booked for the chosen date
  const [taken, setTaken] = useState<string[]>([]);
  const [preBridalFullyBooked, setPreBridalFullyBooked] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ready prevents a flash of the form before auth check completes
  const [ready, setReady] = useState(false);

  const isoDate = useMemo(() => (date ? format(date, "yyyy-MM-dd") : ""), [date]);

  // ── Derived cart values ────────────────────────────────────────────────────
  const selectedServices = useMemo(
    () => ALL_SERVICES.filter((s) => selectedIds.includes(s.id)),
    [selectedIds],
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
      <div className="mx-auto max-w-md px-4 py-16 text-center">
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
    );
  }

  const hasPreBridal = selectedIds.includes("pk-prebridal");
  const isPreBridalBlocked = hasPreBridal && preBridalFullyBooked;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="font-serif text-3xl sm:text-4xl text-primary">Book your appointment</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Select one or more services, then pick a date &amp; time.
      </p>
      <div className="mt-6 sm:mt-8 grid gap-6 md:grid-cols-2">
        {/* ── Left column: service picker + date + time ── */}
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">

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
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {SERVICE_CATEGORIES.map((cat) => (
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
                    return d < istToday || d.getDay() === 5;
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
          </div>
        </div>

        {/* ── Right column: booking summary ── */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
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
