import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, getUser, clearSession } from "@/lib/api";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/services-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings - Hemangi Glam Salon" },
      { name: "description", content: "View, edit, or cancel your salon appointments." },
    ],
  }),
  component: MyBookingsPage,
});

// Brand tokens
const BURGUNDY = "oklch(0.35 0.15 22)";
const GOLD = "oklch(0.68 0.13 68)";
const BORDER = "oklch(0.88 0.030 82)";

type B = { id: number; service_name: string; date: string; time: string; status: string };

// Skeleton card shown while bookings load
function BookingSkeleton() {
  return (
    <ul className="mt-5 space-y-3" aria-busy="true" aria-label="Loading bookings">
      {[65, 78, 55].map((w, i) => (
        <li
          key={i}
          className="relative overflow-hidden rounded-2xl border bg-card px-4 py-4 shadow-sm"
          style={{ borderColor: BORDER }}
        >
          <div
            className="animate-[shimmer_1.6s_ease-in-out_infinite] absolute inset-0 -translate-x-full"
            style={{
              background:
                "linear-gradient(90deg,transparent 0%,oklch(0.93 0.018 80/60%) 50%,transparent 100%)",
            }}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div
                className="h-4 rounded-full animate-pulse"
                style={{ width: `${w}%`, background: "oklch(0.88 0.030 82)" }}
              />
              <div
                className="h-3 rounded-full animate-pulse"
                style={{ width: `${w - 20}%`, background: "oklch(0.91 0.020 82)" }}
              />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full animate-pulse" style={{ background: "oklch(0.91 0.020 82)" }} />
              <div className="h-9 w-14 rounded-lg animate-pulse" style={{ background: "oklch(0.89 0.025 82)" }} />
              <div className="h-9 w-16 rounded-lg animate-pulse" style={{ background: "oklch(0.89 0.025 82)" }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<B[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState("");
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const editIsoDate = useMemo(
    () => (editDate ? format(editDate, "yyyy-MM-dd") : ""),
    [editDate],
  );

  // Load bookings
  const load = () => {
    api.myBookings()
      .then((r) => setBookings(r.bookings))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load";
        const isSessionError =
          msg.includes("Invalid or expired session") ||
          msg.includes("Login required") ||
          msg.includes("User not found");
        if (isSessionError) {
          clearSession();
          setSessionExpired(true);
        } else {
          setError(msg);
        }
      });
  };

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (!u) { navigate({ to: "/" }); return; }
    setReady(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch taken slots whenever edit date changes
  useEffect(() => {
    if (!editIsoDate) { setTakenSlots([]); return; }
    let alive = true;
    setLoadingSlots(true);
    setEditTime("");
    api.slots(editIsoDate)
      .then((res) => { if (alive) setTakenSlots(res.taken); })
      .catch(() => { if (alive) setTakenSlots([]); })
      .finally(() => alive && setLoadingSlots(false));
    return () => { alive = false; };
  }, [editIsoDate]);

  const startEdit = (b: B) => {
    setEditingId(b.id);
    const parsed = new Date(b.date + "T00:00:00");
    setEditDate(isNaN(parsed.getTime()) ? undefined : parsed);
    setEditTime(b.time);
    setTakenSlots([]);
  };

  const saveEdit = async (id: number) => {
    if (!editIsoDate || !editTime) {
      toast.error("Please pick a date and a time slot.");
      return;
    }

    const istNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const midnightIST = new Date(istNow);
    midnightIST.setHours(0, 0, 0, 0);

    if (editDate! < midnightIST) {
      toast.error("Cannot book an appointment in the past.");
      return;
    }

    if (
      editDate!.getDate() === istNow.getDate() &&
      editDate!.getMonth() === istNow.getMonth() &&
      editDate!.getFullYear() === istNow.getFullYear()
    ) {
      const [h, m] = editTime.split(":").map(Number);
      if (h * 60 + m <= istNow.getHours() * 60 + istNow.getMinutes()) {
        toast.error("Cannot book an appointment in the past.");
        return;
      }
    }

    setBusyId(id);
    try {
      await api.updateBooking(id, { date: editIsoDate, time: editTime });
      toast.success("Booking updated!");
      setEditingId(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally { setBusyId(null); }
  };

  const cancelBooking = async (id: number) => {
    if (!confirm("Cancel this booking?")) return;
    setBusyId(id);
    try {
      await api.cancelBooking(id);
      toast.success("Booking cancelled");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally { setBusyId(null); }
  };

  if (!ready) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-primary">Please login</h1>
        <p className="mt-2 text-muted-foreground">Login to view your bookings.</p>
        <Button className="mt-6 min-h-[44px]" onClick={() => navigate({ to: "/login" })}>Login</Button>
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-primary">Session expired</h1>
        <p className="mt-2 text-muted-foreground">Your session has expired. Please log in again.</p>
        <Button className="mt-6 min-h-[44px]" onClick={() => navigate({ to: "/login" })}>
          Log in again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <h1 className="font-serif text-3xl sm:text-4xl text-primary">My bookings</h1>

      {error && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: "oklch(0.577 0.245 27 / 8%)", color: "oklch(0.45 0.18 27)", border: "1px solid oklch(0.577 0.245 27 / 20%)" }}
        >
          {error}
        </div>
      )}

      {/* Skeleton shimmer loader */}
      {!bookings && !error && <BookingSkeleton />}

      {/* Empty state */}
      {bookings && bookings.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">No bookings yet.</p>
          <Button asChild className="mt-4 min-h-[44px]">
            <Link to="/book">Book your first appointment</Link>
          </Button>
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {bookings?.map((b) => (
          <li
            key={b.id}
            className="rounded-2xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md"
            style={{ borderColor: BORDER }}
          >
            {editingId === b.id ? (
              /* ---- COMPACT EDIT PANEL ---- */
              <div className="p-4 space-y-4">

                {/* Header row: service name + close button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="font-semibold truncate"
                      style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                    >
                      {b.service_name}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: "oklch(0.35 0.15 22 / 8%)",
                        color: BURGUNDY,
                        border: "1px solid oklch(0.35 0.15 22 / 18%)",
                      }}
                    >
                      Editing
                    </span>
                  </div>
                  {/* Quick discard X */}
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary transition-colors shrink-0"
                    aria-label="Discard changes"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Date + Time on same row on all screen sizes */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                  {/* Date picker */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Date
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-10 text-sm",
                            !editDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                          {editDate ? format(editDate, "d MMM yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editDate}
                          onSelect={(d) => setEditDate(d)}
                          disabled={(d) =>
                            d < new Date(new Date().setHours(0, 0, 0, 0)) || d.getDay() === 5
                          }
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-[11px] text-muted-foreground">No Fridays.</p>
                  </div>

                  {/* Time slots - Dropdown to save space */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      Time
                      {loadingSlots && <Loader2 className="h-3 w-3 animate-spin" />}
                    </label>

                    {!editDate ? (
                      <div
                        className="h-10 rounded-md flex items-center justify-center text-xs text-muted-foreground"
                        style={{ background: "oklch(0.96 0.010 82)", border: "1px dashed oklch(0.84 0.042 80)" }}
                      >
                        Select a date first
                      </div>
                    ) : (
                      <Select value={editTime} onValueChange={setEditTime}>
                        <SelectTrigger className="w-full h-10 bg-background">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {TIME_SLOTS.map((t, index) => {
                            const istNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                            const isToday =
                              editDate?.getDate() === istNow.getDate() &&
                              editDate?.getMonth() === istNow.getMonth() &&
                              editDate?.getFullYear() === istNow.getFullYear();

                            const [slotH, slotM] = t.split(":").map(Number);
                            const slotMinutes = slotH * 60 + slotM;
                            const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
                            
                            const isPast = isToday && slotMinutes <= currentMinutes;
                            
                            const prevSlot = index > 0 ? TIME_SLOTS[index - 1] : null;
                            const isBuffer = prevSlot ? takenSlots.includes(prevSlot) : false;
                            
                            const isTaken = takenSlots.includes(t);
                            const isDisabled = isTaken || isPast || isBuffer;

                            return (
                              <SelectItem key={t} value={t} disabled={isDisabled}>
                                {t} {isTaken ? "(Booked)" : isBuffer ? "(Buffer)" : isPast ? "(Passed)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Save + Discard buttons - full width on mobile */}
                <div
                  className="flex gap-2 pt-3"
                  style={{ borderTop: "1px solid oklch(0.88 0.030 82)" }}
                >
                  <Button
                    onClick={() => saveEdit(b.id)}
                    disabled={busyId === b.id || !editIsoDate || !editTime}
                    className="flex-1 min-h-[44px] gap-2"
                  >
                    {busyId === b.id ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving</>
                    ) : (
                      <><Check className="h-4 w-4" /> Save changes</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    className="min-h-[44px] px-5"
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              /* ---- READ-ONLY ROW ---- */
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate text-sm sm:text-base">
                    {b.service_name}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {b.date} &middot; {b.time}
                  </div>
                </div>

                {/* Right: status + action buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span
                    className="hidden sm:inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize"
                    style={{
                      background:
                        b.status === "confirmed"
                          ? "oklch(0.35 0.15 22 / 10%)"
                          : b.status === "cancelled"
                          ? "oklch(0.577 0.245 27 / 10%)"
                          : "oklch(0.68 0.13 68 / 12%)",
                      color:
                        b.status === "confirmed"
                          ? BURGUNDY
                          : b.status === "cancelled"
                          ? "oklch(0.50 0.22 27)"
                          : GOLD,
                    }}
                  >
                    {b.status}
                  </span>

                  {b.status === "confirmed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(b)}
                      className="h-9 px-3 gap-1.5 text-xs sm:text-sm"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancelBooking(b.id)}
                    disabled={busyId === b.id}
                    className="h-9 px-3 gap-1.5 text-xs sm:text-sm"
                  >
                    {busyId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <><Trash2 className="h-3 w-3" /><span className="hidden sm:inline">Delete</span></>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
