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
    name: "Threading",
    items: [
      { id: "th-eye", name: "Eyebrow", price: "40", category: "Threading" },
      { id: "th-lip", name: "Upper Lips", price: "10", category: "Threading" },
    ],
  },
  {
    name: "Waxing",
    items: [
      { id: "wx-hand", name: "Hand Waxing", price: "150 / 300", category: "Waxing" },
      { id: "wx-halfleg", name: "Half Leg Waxing", price: "200 / 400", category: "Waxing" },
      { id: "wx-fullleg", name: "Full Leg Waxing", price: "400 / 800", category: "Waxing" },
      { id: "wx-face", name: "Full Face", price: "150", category: "Waxing" },
      { id: "wx-arms", name: "Under Arms", price: "40", category: "Waxing" },
    ],
  },
  {
    name: "Bleach",
    items: [
      { id: "bl-herbal", name: "Herbal / Oxy Bleach", price: "199", category: "Bleach" },
      { id: "bl-gold", name: "Gold Bleach", price: "250", category: "Bleach" },
    ],
  },
  {
    name: "Cleanup",
    items: [
      { id: "cl-fruit", name: "Fruit Cleanup", price: "300", category: "Cleanup" },
      { id: "cl-gold", name: "Gold Cleanup", price: "399", category: "Cleanup" },
      { id: "cl-diamond", name: "Diamond Cleanup", price: "399", category: "Cleanup" },
      { id: "cl-o3", name: "O3+ Cleanup", price: "500", category: "Cleanup" },
    ],
  },
  {
    name: "D-Tan",
    items: [
      { id: "dt-raga", name: "Raga D-Tan", price: "199", category: "D-Tan" },
      { id: "dt-o3", name: "O3+ D-Tan", price: "299", category: "D-Tan" },
    ],
  },
  {
    name: "Manicure & Pedicure",
    items: [
      { id: "mp-mani", name: "Manicure", price: "399", category: "Manicure & Pedicure" },
      { id: "mp-pedi", name: "Pedicure", price: "499", category: "Manicure & Pedicure" },
    ],
  },
  {
    name: "Hair Spa",
    items: [
      { id: "hs-loreal", name: "Loreal Spa (Lengthwise)", price: "500", category: "Hair Spa" },
      { id: "hs-keratin", name: "Protein / Keratin Spa (Lengthwise)", price: "800", category: "Hair Spa" },
    ],
  },
  {
    name: "Hair Cuts",
    items: [
      { id: "hc-one", name: "One Length", price: "150", category: "Hair Cuts" },
      { id: "hc-u", name: "U Cut", price: "150", category: "Hair Cuts" },
      { id: "hc-step", name: "Step Cut (Hair Wash)", price: "300", category: "Hair Cuts" },
      { id: "hc-layer", name: "Layer Cut", price: "300", category: "Hair Cuts" },
      { id: "hc-butterfly", name: "Butterfly Cut", price: "300", category: "Hair Cuts" },
      { id: "hc-feder", name: "Feder Cut", price: "300", category: "Hair Cuts" },
    ],
  },
  {
    name: "Hair Treatments",
    items: [
      { id: "ht-botox", name: "Botox", price: "On request", category: "Hair Treatments" },
      { id: "ht-keratin", name: "Keratin", price: "On request", category: "Hair Treatments" },
      { id: "ht-cysteine", name: "Cysteine", price: "On request", category: "Hair Treatments" },
      { id: "ht-nano", name: "Nanoplasty", price: "On request", category: "Hair Treatments" },
      { id: "ht-smooth", name: "Smoothening", price: "On request", category: "Hair Treatments" },
      { id: "ht-kera", name: "Kera Smooth", price: "On request", category: "Hair Treatments" },
    ],
  },
  {
    name: "Hair Colour",
    items: [
      { id: "hcol-high", name: "Highlights Colour", price: "On request", category: "Hair Colour" },
      { id: "hcol-global", name: "Global Hair Colour", price: "On request", category: "Hair Colour" },
      { id: "hcol-bal", name: "Balayage Colour", price: "On request", category: "Hair Colour" },
    ],
  },
  {
    name: "Massage",
    items: [
      { id: "ms-head", name: "Oil Massage (Head)", price: "On request", category: "Massage" },
      { id: "ms-body", name: "Body Massage", price: "On request", category: "Massage" },
    ],
  },
  {
    name: "Facial",
    items: [
      { id: "fc-fruit", name: "Fruit Facial", price: "399", category: "Facial" },
      { id: "fc-dtan", name: "D-Tan Facial", price: "399", category: "Facial" },
      { id: "fc-white", name: "Whitening Facial", price: "499", category: "Facial" },
      { id: "fc-gold", name: "Gold Facial", price: "599", category: "Facial" },
      { id: "fc-diamond", name: "Diamond Facial", price: "599", category: "Facial" },
      { id: "fc-o3", name: "O3+ Advance Facial", price: "1299", category: "Facial" },
      { id: "fc-hydra", name: "Hydra Professional", price: "1999", category: "Facial" },
    ],
  },
  {
    name: "Nails",
    items: [
      { id: "nl-acrylic", name: "Acrylic Extension", price: "1299", category: "Nails" },
      { id: "nl-gel-ext", name: "Gel Extension", price: "1299", category: "Nails" },
      { id: "nl-temp", name: "Temporary Extension", price: "1000", category: "Nails" },
      { id: "nl-gel-polish", name: "Gel Polish (starting)", price: "300", category: "Nails" },
    ],
  },
  {
    name: "Bridal Makeup Package",
    items: [
      {
        id: "br-engagement",
        name: "Engagement Look",
        price: "On request",
        category: "Bridal Makeup Package",
        description: "Makeup & hairstyle",
      },
      {
        id: "br-haldi",
        name: "Haldi Look",
        price: "On request",
        category: "Bridal Makeup Package",
        description: "Makeup & hairstyle",
      },
      {
        id: "br-vidhi",
        name: "Vidhi Look",
        price: "On request",
        category: "Bridal Makeup Package",
        description: "Makeup & hairstyle",
      },
      {
        id: "br-reception",
        name: "Reception Look",
        price: "On request",
        category: "Bridal Makeup Package",
        description: "Makeup & hairstyle",
      },
      {
        id: "br-inclusions",
        name: "Inclusions",
        price: "Included",
        category: "Bridal Makeup Package",
        description: "Jewellery, flower accessories & saree draping",
      },
    ],
  },
  {
    name: "Pre-Bridal Package",
    items: [
      {
        id: "pb-package",
        name: "Complete Pre-Bridal Package",
        price: "3000",
        category: "Pre-Bridal Package",
        description:
          "Bridal facial (O3+ Advance / Hydra), full body wax (Rica), nail art, D-tan / bleach, manicure & pedicure",
      },
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