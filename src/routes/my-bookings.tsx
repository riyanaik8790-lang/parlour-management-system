import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, getUser, clearSession } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings - Hemangi Glam Salon" },
      { name: "description", content: "View, edit, or cancel your salon appointments." },
    ],
  }),
  component: MyBookingsPage,
});

type B = { id: number; service_name: string; date: string; time: string; status: string };

function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<B[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    api.myBookings()
      .then((r) => setBookings(r.bookings))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load";
        // Only match the exact Flask 401 messages - not loose keyword matching
        const isSessionError =
          msg.includes("Invalid or expired session") ||
          msg.includes("Login required") ||
          msg.includes("User not found");
        if (isSessionError) {
          clearSession(); // Wipe stale token from localStorage
          setSessionExpired(true); // Show re-login prompt - NO auto-redirect loop
        } else {
          setError(msg);
        }
      });
  };

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (!u) {
      navigate({ to: "/" });
      return;
    }
    setReady(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (b: B) => {
    setEditingId(b.id);
    setEditDate(b.date);
    setEditTime(b.time);
  };

  const saveEdit = async (id: number) => {
    if (!editDate || !editTime) { toast.error("Pick a date and time"); return; }
    setBusyId(id);
    try {
      await api.updateBooking(id, { date: editDate, time: editTime });
      toast.success("Booking updated");
      setEditingId(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally { setBusyId(null); }
  };

  const cancel = async (id: number) => {
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

  // ── Not logged in at all ──────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-primary">Please login</h1>
        <p className="mt-2 text-muted-foreground">Login to view your bookings.</p>
        <Button className="mt-6 min-h-[44px]" onClick={() => navigate({ to: "/login" })}>Login</Button>
      </div>
    );
  }

  // ── Stale / invalid JWT detected ─────────────────────────────────────────
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

  // ── Bookings list ─────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-serif text-3xl sm:text-4xl text-primary">My bookings</h1>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!bookings && !error && <p className="mt-4 text-muted-foreground">Loading…</p>}
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
          <li key={b.id} className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            {editingId === b.id ? (
              <div className="space-y-3">
                <div className="font-medium text-foreground">{b.service_name}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => saveEdit(b.id)} disabled={busyId === b.id} className="min-h-[44px]">
                    {busyId === b.id ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="min-h-[44px]">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{b.service_name}</div>
                  <div className="text-sm text-muted-foreground">{b.date} at {b.time}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="rounded-full bg-primary/10 px-2.5 sm:px-3 py-1 text-xs font-medium capitalize text-primary">
                    {b.status}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => startEdit(b)} className="min-h-[44px]">Edit</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancel(b.id)}
                    disabled={busyId === b.id}
                    className="min-h-[44px]"
                  >
                    {busyId === b.id ? "…" : "Delete"}
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
