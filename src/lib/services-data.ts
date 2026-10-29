// Service catalog transcribed from the Hemangi Glam Salon printed menus.
// Prices are in INR. Grouped by category for the services page.
// durationMins: estimated time the service takes in the chair (used for cart total).

export type Service = {
  id: string;
  name: string;
  price: string; // display string (some services have ranges like "150/300")
  category: string;
  description?: string;
  durationMins: number; // estimated service duration in minutes
};

// Each slot on the booking grid is 30 min wide.
export const SLOT_DURATION_MINS = 30;
// Buffer added AFTER the last service before the salon releases the slot.
export const BUFFER_MINS = 30;

export type ServiceCategory = {
  name: string;
  image?: string;
  imagePosition?: string;
  tab?: string;
  items: Service[];
};

export const DEFAULT_SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    name: "Threading & Face",
    items: [
      { id: "th-eye", name: "Eyebrow", price: "50", category: "Threading & Face", durationMins: 15 },
      { id: "th-lip", name: "Upper Lip", price: "20", category: "Threading & Face", durationMins: 10 },
      { id: "wx-face", name: "Full Face", price: "250", category: "Threading & Face", durationMins: 30 },
    ],
  },
  {
    name: "Waxing",
    items: [
      { id: "wx-arms", name: "Underarms", price: "60", category: "Waxing", durationMins: 20 },
      { id: "wx-hand", name: "Hand Wax", price: "200 - 300", category: "Waxing", durationMins: 30 },
      { id: "wx-halfleg", name: "Half Legs", price: "200 - 300", category: "Waxing", durationMins: 30 },
      { id: "wx-fullleg", name: "Full Legs", price: "400 - 600", category: "Waxing", durationMins: 45 },
    ],
  },
  {
    name: "Manicure & Pedicure",
    items: [
      { id: "mp-mani", name: "Manicure", price: "500", category: "Manicure & Pedicure", durationMins: 45 },
      { id: "mp-pedi", name: "Pedicure", price: "599", category: "Manicure & Pedicure", durationMins: 60 },
    ],
  },
  {
    name: "Hair Care",
    items: [
      { id: "hs-loreal", name: "L'Oreal Hair Spa", price: "600", category: "Hair Care", durationMins: 60 },
      { id: "hs-protein", name: "Protein Spa", price: "1500", category: "Hair Care", durationMins: 90 },
      {
        id: "hc-all",
        name: "Haircut (Step, Layer, Butterfly, Feather)",
        price: "400",
        category: "Hair Care",
        durationMins: 45,
      },
    ],
  },
  {
    name: "Facial",
    items: [
      { id: "fc-fruit", name: "Fruit Facial", price: "500", category: "Facial", durationMins: 60 },
      { id: "fc-dtan", name: "D-Tan Facial", price: "599", category: "Facial", durationMins: 60 },
      { id: "fc-white", name: "White Facial", price: "599", category: "Facial", durationMins: 60 },
      { id: "fc-o3", name: "O3+ Advance Facial", price: "1500", category: "Facial", durationMins: 75 },
    ],
  },
  {
    name: "Packages",
    items: [
      { id: "pk-prebridal", name: "Pre-Bridal Package", price: "5000", category: "Packages", durationMins: 180 },
    ],
  },
];

export const CUSTOM_CATEGORIES_KEY = "salon_custom_categories_v2";
export const DELETED_DEFAULT_CATEGORIES_KEY = "salon_deleted_default_categories_v1";

export function getDeletedDefaultCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_DEFAULT_CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getAllServiceCategories(): ServiceCategory[] {
  if (typeof window === "undefined") return DEFAULT_SERVICE_CATEGORIES;
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const deletedDefaults = new Set(getDeletedDefaultCategories().map((s) => s.toLowerCase()));
    
    // If user has saved full category list state, use it (filtering any deleted)
    if (raw) {
      const parsed: ServiceCategory[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c) => !deletedDefaults.has(c.name.toLowerCase()));
      }
    }

    // Default initialization: clone defaults and filter deleted
    return DEFAULT_SERVICE_CATEGORIES.filter(
      (c) => !deletedDefaults.has(c.name.toLowerCase())
    );
  } catch {
    return DEFAULT_SERVICE_CATEGORIES;
  }
}

export function saveAllServiceCategories(categories: ServiceCategory[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
  window.dispatchEvent(new Event("salon-services-updated"));
}

export function saveCustomServiceCategory(cat: ServiceCategory, originalName?: string) {
  const current = getAllServiceCategories();
  const searchName = (originalName || cat.name).toLowerCase();
  
  // Replace existing if found by name, or append
  const idx = current.findIndex((c) => c.name.toLowerCase() === searchName);
  let updated: ServiceCategory[];
  if (idx !== -1) {
    updated = [...current];
    updated[idx] = cat;
  } else {
    updated = [...current, cat];
  }
  saveAllServiceCategories(updated);
}

export function deleteServiceCategory(categoryName: string) {
  const current = getAllServiceCategories();
  const targetLower = categoryName.toLowerCase();
  const updated = current.filter((c) => c.name.toLowerCase() !== targetLower);
  
  // Also register in deleted defaults if it was a default category
  const isDefault = DEFAULT_SERVICE_CATEGORIES.some((c) => c.name.toLowerCase() === targetLower);
  if (isDefault) {
    const deleted = getDeletedDefaultCategories();
    if (!deleted.map((s) => s.toLowerCase()).includes(targetLower)) {
      deleted.push(categoryName);
      localStorage.setItem(DELETED_DEFAULT_CATEGORIES_KEY, JSON.stringify(deleted));
    }
  }

  saveAllServiceCategories(updated);
}

export function deleteSubService(categoryName: string, serviceId: string) {
  const current = getAllServiceCategories();
  const targetLower = categoryName.toLowerCase();
  const updated = current.map((cat) => {
    if (cat.name.toLowerCase() === targetLower) {
      return {
        ...cat,
        items: cat.items.filter((item) => item.id !== serviceId),
      };
    }
    return cat;
  });
  saveAllServiceCategories(updated);
}

export function getCustomServiceCategories(): ServiceCategory[] {
  return getAllServiceCategories();
}

export const SERVICE_CATEGORIES: ServiceCategory[] = DEFAULT_SERVICE_CATEGORIES;

export const ALL_SERVICES: Service[] = SERVICE_CATEGORIES.flatMap((c) => c.items);

// Helper to extract the minimum price number from a price string like "60", "200 - 300", "400/600", "₹60"
export function getLowestPriceNumber(priceStr: string): number | null {
  if (!priceStr) return null;
  const matches = priceStr.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const nums = matches.map(Number).filter((n) => !isNaN(n));
  return nums.length > 0 ? Math.min(...nums) : null;
}

// Automatically calculate starting price string for a category badge (e.g. "from ₹60")
export function calculateCategoryStartingPrice(items: Service[]): string {
  if (!items || items.length === 0) return "";
  let lowest: number | null = null;
  for (const item of items) {
    const p = getLowestPriceNumber(item.price);
    if (p !== null) {
      if (lowest === null || p < lowest) {
        lowest = p;
      }
    }
  }
  if (lowest !== null) {
    return `from ₹${lowest}`;
  }
  const first = items[0]?.price;
  if (first === "On request" || first === "Included") return first;
  return first ? `from ₹${first}` : "";
}

// 30-min slots between 09:00 and 17:00 for the booking calendar.
export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

export const REMINDER_OPTIONS = [
  { value: 15, label: "15 mins before", shortLabel: "15m before" },
  { value: 30, label: "30 mins before", shortLabel: "30m before" },
  { value: 60, label: "1 hour before", shortLabel: "1 hr before" },
  { value: 120, label: "2 hours before", shortLabel: "2 hrs before" },
  { value: 1440, label: "24 hours before", shortLabel: "24 hrs before" },
] as const;

export function formatReminderLabel(minutes?: number | null): string {
  if (!minutes) return "30 mins before";
  const opt = REMINDER_OPTIONS.find((o) => o.value === minutes);
  if (opt) return opt.label;
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} day(s) before`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} hr(s) before`;
  return `${minutes} mins before`;
}
