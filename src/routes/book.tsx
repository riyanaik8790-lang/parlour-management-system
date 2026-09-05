import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, getUser, clearSession } from "@/lib/api";
import { ALL_SERVICES, SERVICE_CATEGORIES, TIME_SLOTS } from "@/lib/services-data";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>) => ({
    // ?service=Gold+Bleach   (passed by the Skin Advisor page)
    service: typeof search.service === "string" ? search.service : "",
  }),
  head: () => ({
    meta: [
      { title: "Book an Appointment - Hemangi Glam Salon" },
      { name: "description", content: "Pick your service, date and time. No double bookings, ever." },
      { property: "og:title", content: "Book an Appointment - Hemangi Glam Salon" },
      { property: "og:description", content: "Pick your service, date and time." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const navigate = useNavigate();
  const { service: preselectedService } = Route.useSearch();
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("");
  const [taken, setTaken] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ready prevents a flash of the form before auth check completes
  const [ready, setReady] = useState(false);

  const isoDate = useMemo(() => (date ? format(date, "yyyy-MM-dd") : ""), [date]);

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
    if (match) setServiceId(match.id);
  }, [preselectedService]);

  const user = ready ? getUser() : null;

  // Load already-booked slots so the UI can grey them out and prevent double-booking.
  useEffect(() => {
    if (!isoDate) { setTaken([]); return; }
    let alive = true;
    setLoadingSlots(true);
    api.slots(isoDate)
      .then((res) => { if (alive) setTaken(res.taken); })
      .catch(() => { if (alive) setTaken([]); })
      .finally(() => alive && setLoadingSlots(false));
    return () => { alive = false; };
  }, [isoDate]);

  async function submit() {
    if (!serviceId || !isoDate || !time) { toast.error("Please select a service, date and time."); return; }
    const user = getUser();
    if (!user) { toast.error("Please login first."); navigate({ to: "/login" }); return; }
    setSubmitting(true);
    try {
      await api.book({ service_id: serviceId, date: isoDate, time });
      toast.success("Appointment booked!");
      navigate({ to: "/my-bookings" });
    } catch (e) {
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
    } finally {
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
        <Button className="mt-6 min-h-[44px]" onClick={() => navigate({ to: "/login" })}>Login</Button>
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

  const service = ALL_SERVICES.find((s) => s.id === serviceId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="font-serif text-3xl sm:text-4xl text-primary">Book your appointment</h1>
      <p className="mt-2 text-sm text-muted-foreground">Grey slots are already booked.</p>
      <div className="mt-6 sm:mt-8 grid gap-6 md:grid-cols-2">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <label className="mb-2 block text-sm font-medium">Service</label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((cat) => (
                  <SelectGroup key={cat.name}>
                    <SelectLabel>{cat.name}</SelectLabel>
                    {cat.items.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.price !== "On request" ? ` - ₹${s.price}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setTime(""); }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d.getDay() === 5}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Time {loadingSlots && <span className="text-xs text-muted-foreground">(loading…)</span>}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map((t) => {
                const isTaken = taken.includes(t);
                const isSelected = time === t;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={isTaken || !date}
                    onClick={() => setTime(t)}
                    className={cn(
                      "rounded-md border px-1 sm:px-2 py-2.5 text-xs sm:text-sm transition min-h-[44px]",
                      isTaken && "cursor-not-allowed border-muted bg-muted text-muted-foreground line-through",
                      !isTaken && !isSelected && "border-border bg-background hover:border-accent hover:text-primary",
                      isSelected && "border-primary bg-primary text-primary-foreground",
                      !date && "opacity-60",
                    )}
                  >{t}</button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <div className="text-sm text-muted-foreground">Booking summary</div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Service" value={service ? service.name : "-"} />
              <Row label="Price" value={service && service.price !== "On request" ? `₹${service.price}` : service?.price ?? "-"} />
              <Row label="Date" value={date ? format(date, "PPP") : "-"} />
              <Row label="Time" value={time || "-"} />
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              Payment is handled at the salon after service. No online payment required.
            </div>
          </div>
          <Button size="lg" className="mt-6 w-full min-h-[44px]" disabled={submitting} onClick={submit}>
            {submitting ? "Booking…" : "Confirm booking"}
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