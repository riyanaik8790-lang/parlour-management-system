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

export const SERVICE_CATEGORIES: { name: string; items: Service[] }[] = [
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

export const ALL_SERVICES: Service[] = SERVICE_CATEGORIES.flatMap((c) => c.items);

// 30-min slots between 09:00 and 17:00 for the booking calendar.
export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();
