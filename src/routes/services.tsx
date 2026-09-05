import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SERVICE_CATEGORIES } from "@/lib/services-data";

import facialImg from "@/assets/facial_service.png";
import bridalImg from "@/assets/bridal_makeup.png";
import hairSpaImg from "@/assets/hair_spa.png";
import rosesImg from "@/assets/new_roses_decor.jpg";
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
  "Facial": { src: facialGoldImg, position: "center 30%" },
  "Hair Spa": { src: hairSpaImg, position: "center 25%" },
  "Bridal Makeup Package": { src: bridalImg, position: "center 20%" },
  "Pre-Bridal Package": { src: preBridalImg, position: "center 20%" },
  "Manicure & Pedicure": { src: pedicureImg, position: "center" },
  "Nails": { src: nailsJpegImg, position: "center" },
  "Bleach": { src: bleachImg, position: "center 35%" },
  "Cleanup": { src: cleanupImg, position: "center" },
  "D-Tan": { src: facialImg, position: "center 25%" },
  "Threading": { src: threadingImg, position: "center 15%" },
  "Waxing": { src: waxingImg, position: "center" },
  "Hair Cuts": { src: hairCutImg, position: "center 60%" },
  "Hair Treatments": { src: hairColor1Img, position: "center 30%" },
  "Hair Colour": { src: hairColor2Img, position: "center 30%" },
  "Massage": { src: massageImg, position: "center" },
};



function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function CategoryCard({ cat, index }: { cat: typeof SERVICE_CATEGORIES[number]; index: number }) {
  const ref = useReveal();
  const imgData = SERVICE_IMAGES[cat.name];
  const img = imgData?.src;
  const position = imgData?.position || "center";
  const delay = (index % 4 + 1) * 100;

  return (
    <div
      ref={ref}
      className={`reveal service-card rounded-2xl overflow-hidden bg-card shadow-sm border animate-fade-up delay-${delay}`}
      style={{ borderColor: "oklch(0.84 0.042 80)" }}
    >
      {/* Card image */}
      {img && (
        <div className="img-zoom h-44 w-full">
          <img src={img} alt={cat.name} className="w-full h-full object-cover" style={{ objectPosition: position }} />
        </div>
      )}

      {/* Content */}
      <div className="p-4 sm:p-5">
        <div className="mb-1">
          <h2 className="font-serif text-xl sm:text-2xl" style={{ color: "oklch(0.35 0.15 22)" }}>{cat.name}</h2>
        </div>
        <hr className="gold-divider my-3" />
        <ul className="divide-y text-sm" style={{ borderColor: "oklch(0.84 0.042 80 / 60%)" }}>
          {cat.items.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground/90">{s.name}</div>
                {s.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.description}</div>
                )}
              </div>
              <span
                className="whitespace-nowrap text-xs sm:text-sm font-semibold px-2 sm:px-2.5 py-0.5 rounded-full shrink-0"
                style={{
                  color: "oklch(0.22 0.04 50)",
                  background: "linear-gradient(135deg, oklch(0.68 0.13 68 / 20%), oklch(0.82 0.18 85 / 30%))",
                  border: "1px solid oklch(0.68 0.13 68 / 30%)",
                }}
              >
                {s.price === "On request" || s.price === "Included" ? s.price : `₹${s.price}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ServicesPage() {
  return (
    <div>
      {/* Page header */}
      <section
        className="relative py-14 sm:py-20 px-4 text-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, oklch(0.968 0.018 85), oklch(0.92 0.04 82))" }}
      >


        <span className="gold-badge mb-4 inline-block animate-fade-up">Full Service Menu</span>
        <h1 className="font-serif text-2xl sm:text-5xl md:text-6xl animate-fade-up delay-100" style={{ color: "oklch(0.35 0.15 22)" }}>
          Service <span className="gold-shimmer">Menu</span>
        </h1>
        <p className="mt-4 sm:mt-6 mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground animate-fade-up delay-200 max-w-lg mx-auto leading-relaxed">
          Browse our full menu of beauty and wellness services with transparent pricing.
        </p>
        <div className="mt-4 sm:mt-6 mb-8 sm:mb-12 flex flex-col sm:flex-row justify-center gap-3 px-4 sm:px-0 animate-fade-up delay-300">
          <Button asChild size="lg" className="btn-maroon rounded-full px-8 w-full sm:w-auto min-h-[44px]">
            <Link to="/book">Book Now</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-8 w-full sm:w-auto min-h-[44px]" style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}>
            <Link to="/try-on">Try Skin Analysis</Link>
          </Button>
        </div>

        <hr className="gold-divider mt-6 sm:mt-10" />
      </section>

      {/* Service cards grid */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
          {SERVICE_CATEGORIES.map((cat, i) => (
            <CategoryCard key={cat.name} cat={cat} index={i} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div
          className="mt-10 sm:mt-16 rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.28 0.10 22))" }}
        >
          <div className="absolute inset-0 opacity-10">
            <img src={rosesImg} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="relative">
            <span className="gold-badge mb-3 inline-block">Ready?</span>
            <h3 className="font-serif text-2xl sm:text-3xl text-white mb-2">Book your favourite service</h3>
            <p className="text-white/60 mb-5 sm:mb-6 text-sm">Real-time slot booking, no waiting on hold.</p>
            <Button asChild size="lg" className="rounded-full px-8 sm:px-10 w-full sm:w-auto min-h-[44px]" style={{ background: "linear-gradient(135deg, oklch(0.68 0.13 68), oklch(0.82 0.18 85))", color: "oklch(0.22 0.04 50)", fontWeight: 700 }}>
              <Link to="/book">Book an Appointment →</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
