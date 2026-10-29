import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import {
  SERVICE_CATEGORIES,
  TIME_SLOTS,
  getAllServiceCategories,
  saveCustomServiceCategory,
  deleteServiceCategory,
  deleteSubService,
  calculateCategoryStartingPrice,
  type ServiceCategory,
  type Service,
} from "@/lib/services-data";
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
  Trash2,
  Plus,
  Upload,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
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
    if (!serviceId) {
      toast.error("Please select a service.");
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

// ── Add New Service Category Modal ───────────────────────────────────────────
type SubItemRow = {
  name: string;
  price: string;
  durationMins: number;
};

function CategoryModal({
  open,
  categoryToEdit,
  onClose,
  onSuccess,
}: {
  open: boolean;
  categoryToEdit?: ServiceCategory | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const isEditing = Boolean(categoryToEdit);
  const [categoryName, setCategoryName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tab, setTab] = useState("Skin");
  const [rows, setRows] = useState<SubItemRow[]>([
    { name: "", price: "", durationMins: 30 },
  ]);
  const [saving, setSaving] = useState(false);

  // Reset or pre-fill form when modal opens
  useEffect(() => {
    if (open) {
      if (categoryToEdit) {
        setCategoryName(categoryToEdit.name);
        setImageUrl(categoryToEdit.image || "");
        setTab(categoryToEdit.tab || "Skin");
        setRows(
          categoryToEdit.items && categoryToEdit.items.length > 0
            ? categoryToEdit.items.map((it) => ({
                name: it.name,
                price: it.price,
                durationMins: it.durationMins || 30,
              }))
            : [{ name: "", price: "", durationMins: 30 }],
        );
      } else {
        setCategoryName("");
        setImageUrl("");
        setTab("Skin");
        setRows([{ name: "", price: "", durationMins: 30 }]);
      }
    }
  }, [open, categoryToEdit]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, { name: "", price: "", durationMins: 30 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof SubItemRow, value: string | number) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Handle local image file upload preview (data URL)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageUrl(reader.result);
        toast.success("Image selected!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Calculate live preview of starting price badge based on rows entered
  const livePreviewItems: Service[] = rows
    .filter((r) => r.name.trim())
    .map((r, i) => ({
      id: `preview-${i}`,
      name: r.name,
      price: r.price || "0",
      category: categoryName || "New Category",
      durationMins: Number(r.durationMins) || 30,
    }));
  const startingPriceBadge = calculateCategoryStartingPrice(livePreviewItems);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = categoryName.trim();
    if (!cleanName) {
      toast.error("Please enter a category heading.");
      return;
    }

    const validRows = rows.filter((r) => r.name.trim() && r.price.trim());
    if (validRows.length === 0) {
      toast.error("Please add at least one sub-service with name and price.");
      return;
    }

    setSaving(true);
    try {
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const serviceItems: Service[] = validRows.map((r, index) => ({
        id: `${slug}-${index}-${Date.now().toString(36)}`,
        name: r.name.trim(),
        price: r.price.trim().replace(/^₹\s*/, ""),
        category: cleanName,
        durationMins: Number(r.durationMins) || 30,
      }));

      const newCategory: ServiceCategory = {
        name: cleanName,
        image: imageUrl.trim() || undefined,
        tab,
        items: serviceItems,
      };

      saveCustomServiceCategory(newCategory, categoryToEdit?.name);
      toast.success(
        isEditing
          ? `Category "${cleanName}" updated successfully!`
          : `Category "${cleanName}" created successfully!`,
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(isEditing ? "Failed to update category." : "Failed to create category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[92vh] overflow-y-auto p-0"
        style={{
          background: "oklch(0.998 0.004 85)",
          borderRadius: "1.25rem",
          border: "1px solid oklch(0.88 0.030 82)",
          boxShadow: "0 24px 80px oklch(0.35 0.15 22 / 14%), 0 8px 32px oklch(0.35 0.15 22 / 8%)",
        }}
      >
        {/* Header */}
        <DialogHeader
          className="px-6 pt-6 pb-4"
          style={{
            background: `linear-gradient(135deg, oklch(0.35 0.15 22 / 6%) 0%, oklch(0.68 0.13 68 / 8%) 100%)`,
            borderBottom: "1px solid oklch(0.90 0.025 82)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
            >
              {isEditing ? (
                <Pencil className="h-5 w-5 text-white" />
              ) : (
                <Layers className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <DialogTitle
                className="text-lg font-bold leading-tight"
                style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
              >
                {isEditing ? `Edit Category: ${categoryToEdit?.name}` : "Add New Service Category"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>
                {isEditing
                  ? "Update category heading, cover image, and sub-services list."
                  : "Create a luxury category card with custom image and dynamic sub-services."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Main Category Heading */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide flex items-center justify-between"
              style={{ color: TEXT_MUTED }}
            >
              <span>Main Category Heading <span style={{ color: BURGUNDY }}>*</span></span>
              {startingPriceBadge && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Auto badge: {startingPriceBadge}
                </span>
              )}
            </label>
            <Input
              id="new-category-name"
              placeholder='e.g., "Waxing", "Bridal Glow", "Body Spa"'
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
              className="h-10 text-sm font-medium"
            />
          </div>

          {/* Navigation Category Tab */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: TEXT_MUTED }}
            >
              Services Page Filter Tab
            </label>
            <Select value={tab} onValueChange={setTab}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select tab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Skin">Skin</SelectItem>
                <SelectItem value="Hair">Hair</SelectItem>
                <SelectItem value="Waxing">Waxing</SelectItem>
                <SelectItem value="Nails">Nails</SelectItem>
                <SelectItem value="Packages">Packages</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
              style={{ color: TEXT_MUTED }}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Cover Image (URL or Upload)</span>
            </label>
            <div className="flex items-center gap-3">
              <Input
                id="new-category-image-url"
                placeholder="https://example.com/photo.jpg or choose file"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="h-10 text-xs flex-1"
              />
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shrink-0">
                <Upload className="h-3.5 w-3.5 text-gray-500" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {imageUrl && (
              <div className="relative mt-2 h-32 w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner group">
                <img
                  src={imageUrl}
                  alt="Category preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Sub-items List (1 to n) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "oklch(0.90 0.025 82)" }}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-800 block">
                  Sub-Services List (1 to n)
                </label>
                <span className="text-[11px] text-gray-400">
                  Enter sub-service names and pricing (e.g. Underarms: ₹60, Hand Wax: ₹200 - 300)
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="h-8 gap-1 text-xs font-semibold"
                style={{ borderColor: GOLD, color: BURGUNDY }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Row
              </Button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 bg-white/70 shadow-sm"
                >
                  <span className="text-xs font-semibold text-gray-400 w-5 text-center">
                    {idx + 1}.
                  </span>
                  <Input
                    placeholder="Sub-service name (e.g. Underarms)"
                    value={row.name}
                    onChange={(e) => handleRowChange(idx, "name", e.target.value)}
                    required
                    className="h-9 text-xs flex-1"
                  />
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                      ₹
                    </span>
                    <Input
                      placeholder="e.g. 60 or 200 - 300"
                      value={row.price}
                      onChange={(e) => handleRowChange(idx, "price", e.target.value)}
                      required
                      className="h-9 text-xs pl-6"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(idx)}
                    disabled={rows.length <= 1}
                    className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-20 disabled:hover:text-gray-400 transition-colors"
                    title="Delete row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t" style={{ borderColor: "oklch(0.90 0.025 82)" }}>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[44px] gap-2 font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
                boxShadow: "0 4px 14px oklch(0.35 0.15 22 / 25%)",
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Category"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[44px] px-5"
              disabled={saving}
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
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ServiceCategory | null>(null);

  // Categories list for management section
  const [allCategories, setAllCategories] = useState<ServiceCategory[]>(() => getAllServiceCategories());

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: "category" | "sub-service";
    categoryName: string;
    serviceId?: string;
    title: string;
    description: string;
  }>({
    open: false,
    type: "category",
    categoryName: "",
    title: "",
    description: "",
  });

  const [totalServicesCount, setTotalServicesCount] = useState<number>(() => {
    return getAllServiceCategories().flatMap((c) => c.items).length;
  });

  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // View state: "dashboard" shows overview, "services" shows full service management
  const [activeView, setActiveView] = useState<"dashboard" | "services">("dashboard");

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

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

  const handleEditCategory = (cat: ServiceCategory) => {
    setCategoryToEdit(cat);
    setCategoryModalOpen(true);
  };

  const handleAddNewCategory = () => {
    setCategoryToEdit(null);
    setCategoryModalOpen(true);
  };

  const confirmDeleteCategory = (cat: ServiceCategory) => {
    setDeleteConfirm({
      open: true,
      type: "category",
      categoryName: cat.name,
      title: `Delete Category "${cat.name}"?`,
      description: `Are you sure you want to delete the "${cat.name}" category and all its ${cat.items.length} sub-services? This will immediately remove it from the client menu and booking flow.`,
    });
  };

  const confirmDeleteSubService = (categoryName: string, service: Service) => {
    setDeleteConfirm({
      open: true,
      type: "sub-service",
      categoryName,
      serviceId: service.id,
      title: `Delete Sub-service "${service.name}"?`,
      description: `Are you sure you want to delete "${service.name}" from ${categoryName}? This service will no longer be bookable.`,
    });
  };

  const executeDelete = () => {
    if (deleteConfirm.type === "category") {
      deleteServiceCategory(deleteConfirm.categoryName);
      toast.success(`Category "${deleteConfirm.categoryName}" deleted.`);
    } else if (deleteConfirm.type === "sub-service" && deleteConfirm.serviceId) {
      deleteSubService(deleteConfirm.categoryName, deleteConfirm.serviceId);
      toast.success("Sub-service deleted.");
    }
    setDeleteConfirm((prev) => ({ ...prev, open: false }));
    loadStats();
  };

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
    <div className="relative min-h-full -mx-4 sm:-mx-6 lg:-mx-12 -my-4 sm:-my-6 lg:-my-8 px-4 sm:px-8 lg:px-12 py-8 overflow-hidden">
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

      <div className="space-y-10 max-w-[1400px] mx-auto">
        {/* Walk-in modal */}
        <WalkinModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={loadStats} />

        {/* Add/Edit Service Category modal */}
        <CategoryModal
          open={categoryModalOpen}
          categoryToEdit={categoryToEdit}
          onClose={() => {
            setCategoryModalOpen(false);
            setCategoryToEdit(null);
          }}
          onSuccess={loadStats}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm(prev => ({ ...prev, open: false }))}>
          <DialogContent className="max-w-md p-6 bg-white/95 backdrop-blur-md border border-neutral-200 shadow-2xl rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">{deleteConfirm.title}</h3>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                  {deleteConfirm.description}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm(prev => ({ ...prev, open: false }))}
                className="text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={executeDelete}
                className="text-xs h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-sm"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
            className="text-4xl font-bold leading-tight"
            style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
          >
            Dashboard
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
            Welcome back! Here&apos;s what&apos;s happening at Hemangi Glam.
          </p>
        </div>

        {/* ── Header Action Buttons ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Add Category Button */}
          <button
            id="admin-add-category-btn"
            onClick={() => setCategoryModalOpen(true)}
            className="group inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: "oklch(0.998 0.004 85)",
              color: BURGUNDY,
              border: `1.5px solid ${GOLD}`,
              boxShadow: "0 4px 16px oklch(0.68 0.13 68 / 18%)",
            }}
          >
            <Layers className="h-4 w-4" style={{ color: GOLD }} />
            Add New Service Category
          </button>

          {/* Walk-in CTA button */}
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



      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 animate-fade-up delay-100">
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

          {/* Manage Services */}
          <button
            type="button"
            onClick={() => setActiveView("services")}
            className="group flex items-center gap-4 rounded-2xl p-6 transition-all duration-300 text-left cursor-pointer"
            style={{
              background: CARD_WHITE,
              boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.boxShadow = "0 12px 40px oklch(0.35 0.15 22 / 12%)";
              el.style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.boxShadow = "0 4px 24px oklch(0.35 0.15 22 / 6%)";
              el.style.transform = "translateY(0)";
            }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${GOLD})` }}
            >
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p
                className="font-semibold"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                Manage Services
              </p>
              <p className="mt-0.5 text-sm" style={{ color: TEXT_MUTED }}>
                {totalServicesCount} sub-service{totalServicesCount !== 1 ? "s" : ""} across {allCategories.length} categor{allCategories.length !== 1 ? "ies" : "y"}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
              style={{ color: GOLD }}
            />
          </button>
        </div>
        {/* Services Management — shown only in services view */}
        {activeView === "services" && (
        <div className="animate-fade-up delay-300">
          {/* Back button header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView("dashboard")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer hover:bg-neutral-100"
                style={{ color: BURGUNDY }}
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                Back to Dashboard
              </button>
              <div className="hidden sm:block w-px h-4 bg-neutral-200" />
              <div>
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: GOLD }}
                >
                  Services Management
                </h2>
                <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>
                  Edits sync immediately across the site and booking engine.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <Input
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder="Filter categories or services..."
                  className="pl-8 h-9 text-xs rounded-xl border-neutral-200 bg-white shadow-xs focus-visible:ring-1"
                />
              </div>
              <Button
                type="button"
                onClick={handleAddNewCategory}
                className="h-9 px-4 text-xs font-medium rounded-xl text-white shadow-md flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </Button>
            </div>
          </div>

          {/* Categories Grid / List */}
          <div className="space-y-4">
            {allCategories
              .filter((cat) => {
                if (!categorySearchQuery.trim()) return true;
                const q = categorySearchQuery.toLowerCase();
                const matchCat = cat.name.toLowerCase().includes(q) || (cat.tab || "").toLowerCase().includes(q);
                const matchItems = cat.items.some((i) => i.name.toLowerCase().includes(q));
                return matchCat || matchItems;
              })
              .map((cat) => {
                const isExpanded = expandedCategories[cat.name] ?? false;
                const startingPrice = calculateCategoryStartingPrice(cat.items);

                return (
                  <div
                    key={cat.name}
                    className="rounded-2xl transition-all duration-300 overflow-hidden"
                    style={{
                      background: CARD_WHITE,
                      boxShadow: "0 4px 20px oklch(0.35 0.15 22 / 6%)",
                      border: "1px solid oklch(0.35 0.15 22 / 8%)",
                    }}
                  >
                    {/* Category Header Row */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-100 border border-neutral-200 shadow-xs relative">
                          {cat.image ? (
                            <img
                              src={cat.image}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        {/* Title and Badges */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className="font-bold text-base sm:text-lg truncate"
                              style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
                            >
                              {cat.name}
                            </h3>
                            {cat.tab && (
                              <span
                                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                                style={{
                                  background: "oklch(0.68 0.13 68 / 15%)",
                                  color: BURGUNDY,
                                  border: "1px solid oklch(0.68 0.13 68 / 25%)",
                                }}
                              >
                                {cat.tab}
                              </span>
                            )}
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                background: "oklch(0.35 0.15 22 / 8%)",
                                color: BURGUNDY,
                              }}
                            >
                              {startingPrice || `from ₹${cat.items[0]?.price || "0"}`}
                            </span>
                          </div>
                          <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>
                            {cat.items.length} sub-service{cat.items.length !== 1 ? "s" : ""} configured
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleCategoryExpand(cat.name)}
                          className="h-8 px-2.5 text-xs rounded-lg border-neutral-200 text-neutral-700 hover:bg-neutral-50 cursor-pointer flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Hide Items
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              View Items ({cat.items.length})
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCategory(cat)}
                          className="h-8 px-3 text-xs rounded-lg border-neutral-200 hover:border-amber-400 hover:bg-amber-50/50 text-neutral-800 hover:text-amber-900 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-600" />
                          Edit
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDeleteCategory(cat)}
                          className="h-8 px-3 text-xs rounded-lg border-neutral-200 hover:border-red-300 hover:bg-red-50 text-neutral-700 hover:text-red-600 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Sub-services table (expanded view) */}
                    {isExpanded && (
                      <div className="border-t border-neutral-100 bg-neutral-50/70 p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                            Sub-services in {cat.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEditCategory(cat)}
                            className="text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                            style={{ color: BURGUNDY }}
                          >
                            <Plus className="w-3 h-3" />
                            Add/Edit Sub-items
                          </button>
                        </div>

                        {cat.items.length === 0 ? (
                          <div className="py-6 text-center text-xs text-neutral-400 italic bg-white rounded-xl border border-neutral-200/60">
                            No sub-services in this category yet. Click "Edit" to add rows.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-xs">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/90 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                                  <th className="py-2.5 px-3.5">Service Name</th>
                                  <th className="py-2.5 px-3.5">Price</th>
                                  <th className="py-2.5 px-3.5">Duration</th>
                                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100">
                                {cat.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                                    <td className="py-2.5 px-3.5 font-medium text-neutral-900">
                                      {item.name}
                                    </td>
                                    <td className="py-2.5 px-3.5">
                                      <span
                                        className="font-bold px-2 py-0.5 rounded-md text-[11px]"
                                        style={{
                                          background: "oklch(0.68 0.13 68 / 15%)",
                                          color: BURGUNDY,
                                        }}
                                      >
                                        ₹{item.price}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3.5 text-neutral-600">
                                      {item.durationMins} mins
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right">
                                      <div className="inline-flex items-center gap-1 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => handleEditCategory(cat)}
                                          title="Edit Service"
                                          className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => confirmDeleteSubService(cat.name, item)}
                                          title="Delete Sub-Service"
                                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
        )}
      </div>
    </div>
  </div>
);
}
