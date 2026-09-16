import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, getUser, clearSession } from "@/lib/api";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/services-data";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings - Hemangi Glam Salon" },
      { name: "description", content: "View, edit, or cancel your salon appointments." },
    ],
  }),
  component: MyBookingsPage,
});

// â”€â”€ Brand tokens (mirror book.tsx exactly) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BURGUNDY = "oklch(0.35 0.15 22)";
const GOLD     = "oklch(0.68 0.13 68)";
const BORDER   = "oklch(0.88 0.030 82)";

type B = { id: number; service_name: string; date: string; time: string; status: string };

function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings]             = useState<B[] | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [ready, setReady]                   = useState(false);
  const [user, setUser]                     = useState<ReturnType<typeof getUser>>(null);

  // Edit state
  const [editingId, setEditingId]       = useState<number | null>(null);
  const [editDate, setEditDate]         = useState<Date | undefined>(undefined);
  const [editTime, setEditTime]         = useState("");
  const [takenSlots, setTakenSlots]     = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busyId, setBusyId]             = useState<number | null>(null);

  // ISO string of selected edit date (YYYY-MM-DD) â€” needed for API + save
  const editIsoDate = useMemo(
    () => (editDate ? format(editDate, "yyyy-MM-dd") : ""),
    [editDate],
  );

  // â”€â”€ Load bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Fetch taken slots whenever edit date changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!editIsoDate) { setTakenSlots([]); return; }
    let alive = true;
    setLoadingSlots(true);
    setEditTime(""); // reset chosen time whenever date changes
    api.slots(editIsoDate)
      .then((res) => { if (alive) setTakenSlots(res.taken); })
      .catch(() => { if (alive) setTakenSlots([]); })
      .finally(() => alive && setLoadingSlots(false));
    return () => { alive = false; };
  }, [editIsoDate]);

  // â”€â”€ Open edit panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startEdit = (b: B) => {
    setEditingId(b.id);
    const parsed = new Date(b.date + "T00:00:00");
    setEditDate(isNaN(parsed.getTime()) ? undefined : parsed);
    setEditTime(b.time);
    setTakenSlots([]);
  };

  // â”€â”€ Save edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveEdit = async (id: number) => {
    if (!editIsoDate || !editTime) {
      toast.error("Please pick a date and a time slot.");
      return;
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

  // â”€â”€ Cancel booking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Not logged in â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-primary">Please login</h1>
        <p className="mt-2 text-muted-foreground">Login to view your bookings.</p>
        <Button className="mt-6 min-h-[44px]" onClick={() => navigate({ to: "/login" })}>Login</Button>
      </div>
    );
  }

  // â”€â”€ Session expired â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (sessionExpired) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-primary">Session expired</h1>
        <p className="mt-2 text-muted-foreground">
          Your session has expired. Please log in again to continue.
        </p>
        <Button className="mt-6 min-h-[44px]" onClick={() => navigate({ to: "/login" })}>
          Log in again
        </Button>
      </div>
    );
  }

  // â”€â”€ Main view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-serif text-3xl sm:text-4xl text-primary">My bookings</h1>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!bookings && !error && <p className="mt-4 text-muted-foreground">Loadingâ€¦</p>}

      {bookings && bookings.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No bookings yet.</p>
          <Button asChild className="mt-4 min-h-[44px]">
            <Link to="/book">Book your first appointment</Link>
          </Button>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {bookings?.map((b) => (
          <li
            key={b.id}
            className="rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
            style={{ borderColor: BORDER }}
          >
            {editingId === b.id ? (
              /* â”€â”€ EDIT PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
              <div className="p-5 space-y-5">

                {/* Service name + editing badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-base font-semibold"
                    style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                  >
                    {b.service_name}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: "oklch(0.35 0.15 22 / 8%)",
                      color: BURGUNDY,
                      border: `1px solid oklch(0.35 0.15 22 / 18%)`,
                    }}
                  >
                    Editing
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">

                  {/* â”€â”€ Date picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                      New date
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal min-h-[44px]",
                            !editDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" style={{ color: GOLD }} />
                          {editDate ? format(editDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editDate}
                          onSelect={(d) => setEditDate(d)}
                          // Same rules as book.tsx: no past dates, no Fridays
                          disabled={(d) =>
                            d < new Date(new Date().setHours(0, 0, 0, 0)) ||
                            d.getDay() === 5
                          }
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Past dates and Fridays are closed.
                    </p>
                  </div>

                  {/* â”€â”€ Time slot grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                      New time{" "}
                      {loadingSlots && (
                        <span className="text-xs text-muted-foreground">(loadingâ€¦)</span>
                      )}
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto">
                      {TIME_SLOTS.map((t) => {
                        const isTaken    = takenSlots.includes(t);
                        const isSelected = editTime === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={isTaken || !editDate}
                            onClick={() => setEditTime(t)}
                            className={cn(
                              "rounded-lg border px-1 py-2 text-xs font-medium transition-all min-h-[36px] select-none",
                              isTaken
                                ? "cursor-not-allowed border-muted bg-muted text-muted-foreground line-through opacity-50"
                                : !isSelected
                                ? "border-border bg-background hover:border-accent hover:text-primary"
                                : "border-primary bg-primary text-primary-foreground shadow-sm",
                              !editDate && !isTaken && "opacity-50 cursor-not-allowed",
                            )}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    {!editDate && (
                      <p className="text-xs text-muted-foreground">
                        Select a date first to see available slots.
                      </p>
                    )}
                    {editDate && takenSlots.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded align-middle"
                          style={{ background: "oklch(0.91 0.025 82)" }}
                        />
                        Strikethrough slots are already booked.
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                  <Button
                    size="sm"
                    onClick={() => saveEdit(b.id)}
                    disabled={busyId === b.id || !editIsoDate || !editTime}
                    className="mt-3 min-h-[44px] px-6"
                  >
                    {busyId === b.id ? "Savingâ€¦" : "Save changes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    className="mt-3 min-h-[44px] px-5"
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              /* â”€â”€ READ-ONLY ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{b.service_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {b.date} at {b.time}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Colour-coded status badge */}
                  <span
                    className="rounded-full px-2.5 sm:px-3 py-1 text-xs font-medium capitalize"
                    style={{
                      background:
                        b.status === "confirmed"
                          ? "oklch(0.35 0.15 22 / 10%)"
                          : b.status === "cancelled"
                          ? "oklch(0.577 0.245 27.325 / 10%)"
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

                  {/* Only show Edit for confirmed bookings */}
                  {b.status === "confirmed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(b)}
                      className="min-h-[44px]"
                    >
                      Edit
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancelBooking(b.id)}
                    disabled={busyId === b.id}
                    className="min-h-[44px]"
                  >
                    {busyId === b.id ? "â€¦" : "Delete"}
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
