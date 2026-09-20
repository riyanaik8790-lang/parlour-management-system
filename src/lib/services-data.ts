// Service catalog transcribed from the Hemangi Glam Salon printed menus.
// Prices are in INR. Grouped by category for the services page.

export type Service = {
  id: string;
  name: string;
  price: string; // display string (some services have ranges like "150/300")
  category: string;
  description?: string;
};

export const SERVICE_CATEGORIES: { name: string; items: Service[] }[] = [
  {
    name: "Threading & Face",
    items: [
      { id: "th-eye", name: "Eyebrow", price: "50", category: "Threading & Face" },
      { id: "th-lip", name: "Upper Lip", price: "20", category: "Threading & Face" },
      { id: "wx-face", name: "Full Face", price: "250", category: "Threading & Face" },
    ],
  },
  {
    name: "Waxing",
    items: [
      { id: "wx-arms", name: "Underarms", price: "60", category: "Waxing" },
      { id: "wx-hand", name: "Hand Wax", price: "200 - 300", category: "Waxing" },
      { id: "wx-halfleg", name: "Half Legs", price: "200 - 300", category: "Waxing" },
      { id: "wx-fullleg", name: "Full Legs", price: "400 - 600", category: "Waxing" },
    ],
  },
  {
    name: "Manicure & Pedicure",
    items: [
      { id: "mp-mani", name: "Manicure", price: "500", category: "Manicure & Pedicure" },
      { id: "mp-pedi", name: "Pedicure", price: "599", category: "Manicure & Pedicure" },
    ],
  },
  {
    name: "Hair Care",
    items: [
      { id: "hs-loreal", name: "L'Oreal Hair Spa", price: "600", category: "Hair Care" },
      { id: "hs-protein", name: "Protein Spa", price: "1500", category: "Hair Care" },
      {
        id: "hc-all",
        name: "Haircut (Step, Layer, Butterfly, Feather)",
        price: "400",
        category: "Hair Care",
      },
    ],
  },
  {
    name: "Facial",
    items: [
      { id: "fc-fruit", name: "Fruit Facial", price: "500", category: "Facial" },
      { id: "fc-dtan", name: "D-Tan Facial", price: "599", category: "Facial" },
      { id: "fc-white", name: "White Facial", price: "599", category: "Facial" },
      { id: "fc-o3", name: "O3+ Advance Facial", price: "1500", category: "Facial" },
    ],
  },
  {
    name: "Packages",
    items: [
      { id: "pk-prebridal", name: "Pre-Bridal Package", price: "5000", category: "Packages" },
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
