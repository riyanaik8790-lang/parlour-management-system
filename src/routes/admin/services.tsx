import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Layers,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Upload,
  X,
  Loader2,
  Scissors,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Service,
  type ServiceCategory,
  getAllServiceCategories,
  saveCustomServiceCategory,
  deleteServiceCategory,
  deleteSubService,
  calculateCategoryStartingPrice,
  getCategoryTab,
} from "@/lib/services-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/services")({
  head: () => ({ meta: [{ title: "Services Management - Admin" }] }),
  component: AdminServicesPage,
});

const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const CARD_WHITE = "oklch(0.998 0.004 85)";
const TEXT_DARK = "oklch(0.25 0.05 50)";
const TEXT_MUTED = "oklch(0.55 0.04 50)";

type SubItemRow = {
  id?: string;
  name: string;
  price: string;
  durationMins: number;
};

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmDeleteModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

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
            <h2 className="text-base font-bold text-white font-serif">{title}</h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
            {description}
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
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category Edit / Add Modal ─────────────────────────────────────────────────
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

  useEffect(() => {
    if (open) {
      if (categoryToEdit) {
        setCategoryName(categoryToEdit.name);
        setImageUrl(categoryToEdit.image || "");
        setTab(categoryToEdit.tab || getCategoryTab(categoryToEdit) || "Skin");
        setRows(
          categoryToEdit.items && categoryToEdit.items.length > 0
            ? categoryToEdit.items.map((it) => ({
                id: it.id,
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
        toast.success("Cover image selected!");
      }
    };
    reader.readAsDataURL(file);
  };

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
        id: r.id || `${slug}-${index}-${Date.now().toString(36)}`,
        name: r.name.trim(),
        price: r.price.trim().replace(/^₹\s*/, ""),
        category: cleanName,
        durationMins: Math.max(5, Number(r.durationMins) || 30),
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
          background: CARD_WHITE,
          borderRadius: "1.25rem",
          border: "1px solid oklch(0.88 0.030 82)",
          boxShadow: "0 24px 80px oklch(0.35 0.15 22 / 14%), 0 8px 32px oklch(0.35 0.15 22 / 8%)",
        }}
      >
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

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">
          {/* Main Category Heading */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide flex items-center justify-between"
              style={{ color: TEXT_MUTED }}
            >
              <span>
                Main Category Heading <span style={{ color: BURGUNDY }}>*</span>
              </span>
              {startingPriceBadge && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Auto badge: {startingPriceBadge}
                </span>
              )}
            </label>
            <Input
              id="category-name-input"
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
                id="category-image-url-input"
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

          {/* Sub-items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "oklch(0.90 0.025 82)" }}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-800 block">
                  Sub-Services List
                </label>
                <span className="text-[11px] text-gray-400">
                  Enter sub-service names, pricing, and duration in minutes
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

            {/* Desktop column headers */}
            <div className="hidden sm:grid grid-cols-[1.5rem_1fr_6.5rem_6.5rem_2rem] gap-2 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              <span className="text-center">#</span>
              <span>Sub-Service</span>
              <span>Price (₹)</span>
              <span>Duration</span>
              <span></span>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-3 sm:pr-3.5 [scrollbar-gutter:stable]">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-xl border border-gray-100 bg-white/70 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-400 w-5 shrink-0 text-center">
                      {idx + 1}.
                    </span>
                    <Input
                      placeholder="Sub-service name (e.g. Upper Lip)"
                      value={row.name}
                      onChange={(e) => handleRowChange(idx, "name", e.target.value)}
                      required
                      className="h-9 text-xs flex-1 min-w-0 px-2.5"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 pl-6 sm:pl-0">
                    <div className="relative w-24 sm:w-26 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                        ₹
                      </span>
                      <Input
                        placeholder="e.g. 60"
                        value={row.price}
                        onChange={(e) => handleRowChange(idx, "price", e.target.value)}
                        required
                        className="h-9 text-xs pl-6 pr-2 font-medium"
                        title="Price in Rupees"
                      />
                    </div>
                    <div className="relative w-24 sm:w-26 shrink-0">
                      <Clock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <Input
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        placeholder="30"
                        value={row.durationMins ?? 30}
                        onChange={(e) =>
                          handleRowChange(
                            idx,
                            "durationMins",
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        required
                        className="h-9 text-xs pl-7 pr-7 font-medium"
                        title="Duration in minutes"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium pointer-events-none">
                        min
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      disabled={rows.length <= 1}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 disabled:hover:text-gray-400 transition-colors shrink-0 cursor-pointer ml-auto sm:ml-0"
                      title="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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

// ── Admin Services Page Component ─────────────────────────────────────────────
function AdminServicesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>(() => getAllServiceCategories());
  const [query, setQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ServiceCategory | null>(null);

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

  const loadCategories = () => {
    const cats = getAllServiceCategories();
    setCategories(cats);
  };

  useEffect(() => {
    loadCategories();
    const handleUpdate = () => loadCategories();
    window.addEventListener("salon-services-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("salon-services-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const totalServicesCount = categories.flatMap((c) => c.items).length;

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const handleAddNewCategory = () => {
    setCategoryToEdit(null);
    setCategoryModalOpen(true);
  };

  const handleEditCategory = (cat: ServiceCategory) => {
    setCategoryToEdit(cat);
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
    loadCategories();
  };

  const [selectedTab, setSelectedTab] = useState<string>("all");

  const availableTabs = useMemo(() => {
    const defaultTabs = ["Skin", "Hair", "Waxing", "Nails", "Packages"];
    const customTabs = categories
      .map((c) => (c.tab || getCategoryTab(c)).trim())
      .filter((t): t is string => Boolean(t && !defaultTabs.some((dt) => dt.toLowerCase() === t.toLowerCase())));
    const allUnique = [...defaultTabs, ...Array.from(new Set(customTabs))];

    const totalSubServicesCount = categories.reduce((sum, c) => sum + (c.items?.length || 0), 0);

    return [
      { value: "all", label: "All Categories", count: totalSubServicesCount },
      ...allUnique.map((tab) => {
        const matchingCats = categories.filter(
          (c) => (c.tab || getCategoryTab(c)).toLowerCase() === tab.toLowerCase()
        );
        const subServiceCount = matchingCats.reduce((sum, c) => sum + (c.items?.length || 0), 0);
        return {
          value: tab,
          label: tab,
          count: subServiceCount,
        };
      }),
    ];
  }, [categories]);

  // Filter categories and sub-services by selected tab and search query
  const filteredCategories = categories.filter((cat) => {
    const catTab = (cat.tab || getCategoryTab(cat)).toLowerCase();
    if (selectedTab !== "all" && catTab !== selectedTab.toLowerCase()) {
      return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const matchCat =
      cat.name.toLowerCase().includes(q) || catTab.includes(q);
    const matchItems = cat.items.some((i) => i.name.toLowerCase().includes(q));
    return matchCat || matchItems;
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setRefreshing(true);
    try {
      const cats = getAllServiceCategories();
      setCategories(cats);
      toast.success("Services data refreshed successfully");
    } catch {
      toast.error("Failed to refresh services");
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <>
      {/* Category Add/Edit Modal */}
      <CategoryModal
        open={categoryModalOpen}
        categoryToEdit={categoryToEdit}
        onClose={() => setCategoryModalOpen(false)}
        onSuccess={loadCategories}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        open={deleteConfirm.open}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirm((prev) => ({ ...prev, open: false }))}
      />

      <div className="space-y-4 sm:space-y-6 px-4 sm:px-6 lg:px-12 py-6 sm:py-8 max-w-[1400px] mx-auto">
        {/* Header matching Admin Users layout */}
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 animate-fade-up">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
            >
              Service Management
            </h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: TEXT_MUTED }}>
              {categories.length} categories · {totalServicesCount} sub-services · Edits sync
              immediately to client menu &amp; booking flow
            </p>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm transition min-h-[44px] cursor-pointer"
              style={{
                border: "1px solid oklch(0.84 0.042 80)",
                background: CARD_WHITE,
                color: "oklch(0.45 0.04 50)",
                boxShadow: "0 2px 8px oklch(0.35 0.15 22 / 4%)",
              }}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleAddNewCategory}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition min-h-[44px] cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
              }}
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          </div>
        </div>

        {/* Category Tabs - Horizontal swipeable/scrollable filter bar */}
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1.5 pt-0.5 -mx-1 px-1 scroll-smooth animate-fade-up delay-100"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {availableTabs.map(({ value, label, count }) => {
            const active = selectedTab.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedTab(value)}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all min-h-[38px] sm:min-h-[44px] shrink-0 whitespace-nowrap cursor-pointer select-none"
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
                        color: "#ffffff",
                        border: "1.5px solid oklch(0.35 0.15 22)",
                        boxShadow: "0 4px 14px oklch(0.35 0.15 22 / 25%)",
                      }
                    : {
                        background: CARD_WHITE,
                        color: "oklch(0.45 0.04 50)",
                        border: "1px solid oklch(0.84 0.042 80 / 80%)",
                      }
                }
              >
                {label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={
                    active
                      ? {
                          background: "oklch(0.68 0.13 68 / 35%)",
                          color: "#ffffff",
                        }
                      : {
                          background: "oklch(0.92 0.030 83)",
                          color: "oklch(0.50 0.04 50)",
                        }
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative animate-fade-up delay-200">
          <Search
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "oklch(0.65 0.04 50)" }}
          />
          <input
            type="text"
            placeholder="Search by category name, sub-service, or tab…"
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

        {/* Category List */}
        <div className="space-y-4 animate-fade-up delay-300">
          {filteredCategories.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{
                background: CARD_WHITE,
                border: "1px solid oklch(0.84 0.042 80)",
              }}
            >
              <Scissors className="mx-auto h-8 w-8 mb-2 text-neutral-300" />
              <p className="text-sm font-semibold" style={{ color: TEXT_DARK }}>
                No categories found
              </p>
              <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
                {query.trim()
                  ? `No service categories match "${query}". Try a different keyword.`
                  : "No services are currently configured."}
              </p>
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const isExpanded = expandedCategories[cat.name] ?? false;
              const startingPrice = calculateCategoryStartingPrice(cat.items);

              return (
                <div
                  key={cat.name}
                  className="rounded-2xl transition-shadow duration-200 overflow-hidden"
                  style={{
                    background: CARD_WHITE,
                    boxShadow: "0 4px 20px oklch(0.35 0.15 22 / 6%)",
                    border: "1px solid oklch(0.84 0.042 80 / 60%)",
                  }}
                >
                  {/* Category Header Row */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
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

                    {/* Action buttons with stable dimensions */}
                    <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleCategoryExpand(cat.name);
                        }}
                        aria-expanded={isExpanded}
                        className={`h-9 px-3.5 text-xs font-medium rounded-xl border transition-all duration-150 cursor-pointer inline-flex items-center justify-center gap-1.5 select-none shrink-0 whitespace-nowrap ${
                          isExpanded
                            ? "bg-neutral-100/90 border-neutral-300 text-neutral-900 shadow-inner"
                            : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 shadow-xs"
                        }`}
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ease-out shrink-0 ${
                            isExpanded ? "rotate-180 text-neutral-800" : ""
                          }`}
                        />
                        <span className="whitespace-nowrap font-medium">{isExpanded ? "Hide Items" : `View Items (${cat.items.length})`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditCategory(cat);
                        }}
                        className="h-9 px-3.5 text-xs font-medium rounded-xl border border-neutral-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 text-neutral-800 hover:text-amber-900 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs select-none"
                      >
                        <Pencil className="w-3.5 h-3.5 text-amber-600" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          confirmDeleteCategory(cat);
                        }}
                        className="h-9 px-3 text-xs font-medium rounded-xl border border-neutral-200 bg-white hover:border-red-300 hover:bg-red-50 text-neutral-700 hover:text-red-600 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs select-none"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Smooth, Stable Accordion Expansion using CSS Grid Rows */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-neutral-100 bg-neutral-50/70 p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Sub-services in {cat.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEditCategory(cat);
                            }}
                            className="text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                            style={{ color: BURGUNDY }}
                          >
                            <Plus className="w-3 h-3" />
                            Add/Edit Sub-items
                          </button>
                        </div>

                        {cat.items.length === 0 ? (
                          <div className="py-6 text-center text-xs text-neutral-400 italic bg-white rounded-xl border border-neutral-200/60">
                            No sub-services in this category yet. Click &quot;Edit&quot; to add rows.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-xs">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/90 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                                  <th className="py-3 px-4">Service Name</th>
                                  <th className="py-3 px-4">Price</th>
                                  <th className="py-3 px-4">Duration</th>
                                  <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100">
                                {cat.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                                    <td className="py-3 px-4 font-medium text-neutral-900">
                                      {item.name}
                                    </td>
                                    <td className="py-3 px-4">
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
                                    <td className="py-3 px-4 text-neutral-600">
                                      <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-neutral-400" />
                                        {item.durationMins} mins
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <div className="inline-flex items-center gap-1 justify-end">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleEditCategory(cat);
                                          }}
                                          title="Edit Service"
                                          className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            confirmDeleteSubService(cat.name, item);
                                          }}
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
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
