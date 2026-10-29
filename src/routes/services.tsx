import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SERVICE_CATEGORIES,
  getAllServiceCategories,
  calculateCategoryStartingPrice,
  type ServiceCategory,
} from "@/lib/services-data";
import { CalendarCheck, Clock } from "lucide-react";

import salonHeroBg from "@/assets/new_salon_hero_bg.jpg";
import facialImg from "@/assets/facial_service.png";
import bridalImg from "@/assets/bridal_makeup.png";
import hairSpaImg from "@/assets/hair_spa.png";
import rosesImg from "@/assets/new_roses_decor.jpg";
import floralBgImg from "@/assets/luxury-floral-bg.png";
import nailImg from "@/assets/nail_art.png";
import threadingImg from "@/assets/threading.jpeg";
import waxingImg from "@/assets/waxing.jpeg";
import massageImg from "@/assets/massage.jpeg";
import preBridalImg from "@/assets/pre_bridal.jpg";
import pedicureImg from "@/assets/pedicure.jpeg";
import nailsJpegImg from "@/assets/nails.jpeg";

import facialGoldImg from "@/assets/facial_gold.jpg";
import facialMudImg from "@/assets/facial_mud.jpg";
import hairColor1Img from "@/assets/hair_color_1.jpg";
import hairColor2Img from "@/assets/hair_color_2.jpg";
import hairCutImg from "@/assets/hair_cut.jpg";
import bleachImg from "@/assets/bleach.jpg";
import cleanupImg from "@/assets/cleanup.jpg";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services & Prices - Hemangi Glam Salon" },
      { name: "description", content: "Full service menu with transparent pricing." },
      { property: "og:title", content: "Services & Prices - Hemangi Glam Salon" },
      { property: "og:description", content: "Full service menu with transparent pricing." },
    ],
  }),
  component: ServicesPage,
});

const SERVICE_IMAGES: Record<string, { src: string; position: string }> = {
  Facial: { src: facialGoldImg, position: "center 30%" },
  "Hair Care": { src: hairSpaImg, position: "center 25%" },
  Packages: { src: bridalImg, position: "center 20%" },
  "Pre-Bridal Package": { src: preBridalImg, position: "center 20%" },
  "Manicure & Pedicure": { src: pedicureImg, position: "center" },
  Nails: { src: nailsJpegImg, position: "center" },
  Bleach: { src: bleachImg, position: "center 35%" },
  Cleanup: { src: cleanupImg, position: "center" },
  "D-Tan": { src: facialImg, position: "center 25%" },
  "Threading & Face": { src: threadingImg, position: "center 15%" },
  Waxing: { src: waxingImg, position: "center" },
  "Hair Cuts": { src: hairCutImg, position: "center 60%" },
  "Hair Treatments": { src: hairColor1Img, position: "center 30%" },
  "Hair Colour": { src: hairColor2Img, position: "center 30%" },
  Massage: { src: massageImg, position: "center" },
};

type TabId = "All" | "Skin" | "Hair" | "Waxing" | "Nails" | "Packages";

const TABS: { id: TabId; label: string }[] = [
  { id: "All",      label: "All" },
  { id: "Skin",     label: "Skin" },
  { id: "Hair",     label: "Hair" },
  { id: "Waxing",   label: "Waxing" },
  { id: "Nails",    label: "Nails" },
  { id: "Packages", label: "Packages" },
];

const CATEGORY_TAB: Record<string, TabId> = {
  Facial: "Skin",
  Cleanup: "Skin",
  Bleach: "Skin",
  "D-Tan": "Skin",
  "Threading & Face": "Skin",
  "Hair Care": "Hair",
  "Hair Cuts": "Hair",
  "Hair Treatments": "Hair",
  "Hair Colour": "Hair",
  Waxing: "Waxing",
  "Manicure & Pedicure": "Nails",
  Nails: "Nails",
  Packages: "Packages",
  Massage: "Skin",
};

// Soft, light ambient floating particles (warm white / pale gold with delicate transparency)
const HERO_PARTICLES = [
  { id: 1, left: "12%", top: "45%", size: 4, delay: "0s", duration: "7.5s", bg: "rgba(255, 248, 235, 0.65)" },
  { id: 2, left: "28%", top: "60%", size: 3, delay: "1.8s", duration: "8.5s", bg: "rgba(244, 226, 182, 0.45)" },
  { id: 3, left: "45%", top: "70%", size: 5, delay: "0.9s", duration: "9.2s", bg: "rgba(255, 252, 245, 0.70)" },
  { id: 4, left: "62%", top: "50%", size: 3, delay: "2.6s", duration: "8.0s", bg: "rgba(238, 218, 170, 0.40)" },
  { id: 5, left: "78%", top: "65%", size: 4, delay: "1.2s", duration: "8.6s", bg: "rgba(255, 248, 235, 0.60)" },
  { id: 6, left: "88%", top: "40%", size: 3, delay: "3.1s", duration: "7.8s", bg: "rgba(244, 226, 182, 0.45)" },
  { id: 7, left: "20%", top: "30%", size: 4, delay: "4.0s", duration: "8.2s", bg: "rgba(255, 252, 245, 0.55)" },
  { id: 8, left: "70%", top: "35%", size: 3, delay: "2.2s", duration: "9.5s", bg: "rgba(238, 218, 170, 0.40)" },
];

function ServiceCard({
  cat,
  index,
}: {
  cat: ServiceCategory;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const defaultImgData = SERVICE_IMAGES[cat.name];
  // Priority: cat.image (custom admin upload/URL) -> built-in image -> fallback
  const img = cat.image || defaultImgData?.src;
  const position = cat.imagePosition || defaultImgData?.position || "center";
  
  // Calculate lowest starting price automatically across all sub-services
  const priceDisplay = calculateCategoryStartingPrice(cat.items);

  return (
    <div
      ref={cardRef}
      className={`svc-catalog-card${inView ? " in-view" : ""}`}
      style={{
        transitionDelay: `${(index % 2) * 90}ms`,
      }}
    >
      <div className="svc-card-img-wrap">
        {img ? (
          <img
            src={img}
            alt={cat.name}
            className="svc-card-img"
            style={{ objectPosition: position }}
            loading="lazy"
          />
        ) : (
          <div className="svc-card-img-fallback" />
        )}
        <div className="svc-card-overlay">
          <div className="svc-card-overlay-content">
            <h2 className="svc-card-overlay-title">{cat.name}</h2>
            {priceDisplay && (
              <span className="svc-card-overlay-price">{priceDisplay}</span>
            )}
            <Link
              to="/book"
              className="svc-card-book-btn"
              id={`book-${cat.name.toLowerCase().replace(/[\s&]+/g, "-")}`}
            >
              <CalendarCheck className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              Book
            </Link>
          </div>
        </div>
      </div>

      <div className="svc-card-body">
        <ul className="svc-card-list">
          {cat.items.map((s) => (
            <li key={s.id} className="svc-card-list-item">
              <div className="min-w-0 flex-1">
                <div className="svc-item-name flex items-center gap-2 flex-wrap">
                  <span>{s.name}</span>
                  {s.durationMins ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground/80 bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded-md">
                      <Clock className="w-2.5 h-2.5 text-amber-600/80" />
                      {s.durationMins} min
                    </span>
                  ) : null}
                </div>
                {s.description && (
                  <div className="svc-item-desc">{s.description}</div>
                )}
              </div>
              <span className="svc-item-price">
                {s.price === "On request" || s.price === "Included"
                  ? s.price
                  : s.price.startsWith("₹")
                    ? s.price
                    : `₹${s.price}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ServicesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("All");
  const [categories, setCategories] = useState<ServiceCategory[]>(() => getAllServiceCategories());

  useEffect(() => {
    const handleUpdate = () => {
      setCategories(getAllServiceCategories());
    };
    window.addEventListener("salon-services-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("salon-services-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filtered = categories.filter((cat) => {
    if (activeTab === "All") return true;
    const catTab = cat.tab || CATEGORY_TAB[cat.name] || "Skin";
    return catTab === activeTab;
  });

  return (
    <div
      className="services-page-wrapper"
      style={{
        // @ts-expect-error CSS variable for full-page background
        "--services-bg-image": `url(${salonHeroBg})`,
      }}
    >
      {/* HERO */}
      <section className="services-hero relative pt-14 pb-12 sm:pt-20 sm:pb-16 px-4 text-center overflow-hidden">
        {/* Subtle ambient floating sparkles */}
        <div className="floating-particles-container" aria-hidden="true">
          {HERO_PARTICLES.map((p) => (
            <span
              key={p.id}
              className="floating-particle"
              style={{
                left: p.left,
                top: p.top,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.bg,
                boxShadow: `0 0 ${p.size * 2}px ${p.bg}`,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center justify-center">
          <div className="pt-4 pb-2 overflow-visible">
            <h1
              className="font-serif text-3xl sm:text-5xl md:text-6xl leading-normal overflow-visible hero-word"
              style={{ color: "oklch(0.35 0.15 22)", animationDelay: "0.2s" }}
            >
              Service{" "}
              <span
                className="gold-shimmer hero-script-reveal font-script inline-block px-1 overflow-visible"
                style={{ animationDelay: "0.55s", paddingBottom: "0.15em" }}
              >
                Menu
              </span>
            </h1>
          </div>

          <p
            className="mt-4 sm:mt-5 mb-8 text-sm sm:text-base text-muted-foreground hero-word max-w-md mx-auto leading-relaxed"
            style={{ animationDelay: "0.35s" }}
          >
            Find your new favorite treatment. Browse our luxury menu below.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 px-4 sm:px-0 w-full animate-fade-up"
            style={{ animationDelay: "0.5s" }}
          >
            <Button
              asChild
              size="lg"
              className="btn-maroon btn-maroon-glow rounded-full px-8 w-full sm:w-auto min-h-[44px]"
            >
              <Link to="/book">
                <CalendarCheck className="mr-2 h-5 w-5" />
                Book Now
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="btn-outline-gold rounded-full px-8 w-full sm:w-auto min-h-[44px]"
              style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}
            >
              <Link to="/try-on">Try Skin Analysis</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FILTER TABS */}
      <section className="sticky top-[56px] z-30 bg-[#FAF6F0]/95 border-b border-[#E8DEC8] shadow-sm">
        <div className="mx-auto max-w-6xl px-4">
          <div
            className="svc-filter-bar"
            role="tablist"
            aria-label="Filter by category"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`svc-filter-tab${activeTab === tab.id ? " svc-filter-tab-active" : ""}`}
                id={`tab-${tab.id.toLowerCase()}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES MENU SECTION WITH SEAMLESS FULL-STRENGTH FLORAL WALLPAPER */}
      <section className="relative w-full overflow-hidden">
        {/* Full coverage, continuous seamless repeating floral watermark matching homepage render */}
        <div
          className="absolute inset-0 pointer-events-none -z-10 mix-blend-multiply opacity-100"
          style={{
            backgroundImage: "url('/luxury-floral-bg.png')",
            backgroundRepeat: "repeat",
            backgroundPosition: "center",
            backgroundSize: "600px auto",
          }}
          aria-hidden="true"
        />

        {/* CARDS GRID */}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              No services in this category yet.
            </div>
          ) : (
            <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
              {filtered.map((cat, i) => (
                <ServiceCard key={cat.name} cat={cat} index={i} />
              ))}
            </div>
          )}

        {/* BOTTOM CTA */}
        <div
          className="mt-12 sm:mt-20 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.28 0.10 22))",
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <img src={rosesImg} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="relative max-w-xl mx-auto flex flex-col items-center">
            <h3 className="font-serif text-2xl sm:text-4xl text-white mb-2.5">
              Book your favourite service
            </h3>
            <p className="text-white/75 mb-7 text-sm sm:text-base leading-relaxed">
              Treat yourself to a premium salon experience.
            </p>
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 sm:px-10 w-full sm:w-auto min-h-[44px] btn-outline-gold"
              style={{
                background: "linear-gradient(135deg, oklch(0.68 0.13 68), oklch(0.82 0.18 85))",
                color: "oklch(0.22 0.04 50)",
                fontWeight: 700,
                border: "none",
              }}
            >
              <Link to="/book">Book an Appointment &rarr;</Link>
            </Button>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
