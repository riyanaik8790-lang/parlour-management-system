import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Sparkles, ShieldCheck, Heart, Award, Clock } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/services-data";


import heroBg from "@/assets/new_salon_hero_bg.jpg";
import facialImg from "@/assets/facial_service.png";
import bridalImg from "@/assets/bridal_makeup.png";
import preBridalImg from "@/assets/pre_bridal.jpg";
import hairSpaImg from "@/assets/hair_spa.png";
import rosesImg from "@/assets/new_roses_decor.jpg";
import nailImg from "@/assets/nail_art.png";
import threadingImg from "@/assets/threading.jpeg";
import waxingImg from "@/assets/waxing.jpeg";

import facialGoldImg from "@/assets/facial_gold.jpg";
import facialMudImg from "@/assets/facial_mud.jpg";
import bleachImg from "@/assets/bleach.jpg";
import cleanupImg from "@/assets/cleanup.jpg";
import hairCutImg from "@/assets/hair_cut.jpg";
import hairColor1Img from "@/assets/hair_color_1.jpg";
import hairColor2Img from "@/assets/hair_color_2.jpg";
import pedicureImg from "@/assets/pedicure.jpeg";

export const Route = createFileRoute("/")({
  component: Index,
});

// Intersection-observer reveal hook
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}



const STATS = [
  { icon: <Heart className="h-6 w-6" />, value: "2000+", label: "Happy Clients" },
  { icon: <Award className="h-6 w-6" />, value: "15+", label: "Services" },
  { icon: <span className="text-xl leading-none">★</span>, value: "4.9★", label: "Rating" },
  { icon: <Clock className="h-6 w-6" />, value: "1+", label: "Years Experience" },
];

const SERVICE_IMAGES: Record<string, { src: string; position: string }> = {
  "Facial": { src: facialGoldImg, position: "center 30%" },
  "Hair Spa": { src: hairSpaImg, position: "center 25%" },
  "Bridal Makeup Package": { src: bridalImg, position: "center 20%" },
  "Manicure & Pedicure": { src: pedicureImg, position: "center" },
  "Bleach": { src: bleachImg, position: "center 35%" },
  "Cleanup": { src: cleanupImg, position: "center" },
  "Threading": { src: threadingImg, position: "center 15%" },
  "Waxing": { src: waxingImg, position: "center" },
  "D-Tan": { src: facialImg, position: "center 25%" },
};

function Index() {
  const featured = SERVICE_CATEGORIES.slice(0, 6);

  // section refs
  const statsRef = useReveal();
  const servicesRef = useReveal();
  const galleryRef = useReveal();

  return (
    <div className="overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Background image */}
        <img
          src={heroBg}
          alt="Salon background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.35 }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.968_0.018_85)] via-[oklch(0.968_0.018_85/85%)] to-[oklch(0.35_0.15_22/20%)]" />

        <div className="relative mx-auto flex max-w-6xl w-full flex-col items-center justify-center gap-10 px-4 sm:px-6 py-16 sm:py-24 md:py-32 text-center">
          {/* Headline + CTAs */}
          <div className="flex flex-col items-center max-w-2xl w-full">
            <span className="gold-badge mb-4 animate-fade-up">Premium Salon Experience</span>

            <h1 className="font-serif text-3xl sm:text-5xl leading-tight md:text-7xl animate-fade-up delay-100">
              <span style={{ color: "oklch(0.35 0.15 22)" }}>Beauty</span>{" "}
              <span style={{ color: "oklch(0.35 0.15 22)" }}>booked</span>
              <br />
              <span className="font-script gold-shimmer" style={{ fontSize: "1.15em" }}>
                beautifully.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed animate-fade-up delay-200">
              Say goodbye to double bookings and phone tag. Pick your service, choose an open slot,
              and book instantly - no salon staff required.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row flex-wrap justify-center gap-3 animate-fade-up delay-300 w-full sm:w-auto">
              <Button asChild size="lg" className="btn-maroon rounded-full px-8 shadow-lg text-base w-full sm:w-auto min-h-[44px]">
                <Link to="/book">
                  <CalendarCheck className="mr-2 h-5 w-5" />
                  Book an Appointment
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-base border-2 w-full sm:w-auto min-h-[44px]" style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}>
                <Link to="/services">View Services</Link>
              </Button>
            </div>

            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 animate-fade-up delay-400">
              <Feature icon={<ShieldCheck className="h-4 w-4" />} text="No double booking" />
              <Feature icon={<Sparkles className="h-4 w-4" />} text="15+ services" />
            </div>
          </div>
        </div>

        {/* Gold wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <hr className="gold-divider" />
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 bg-gradient-to-r from-secondary/60 via-background to-secondary/60">
        <div ref={statsRef} className="reveal mx-auto max-w-5xl px-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <div key={s.label} className={`stat-card animate-scale-in delay-${(i + 1) * 100}`}>
              <div className="flex justify-center mb-2" style={{ color: "oklch(0.68 0.13 68)" }}>{s.icon}</div>
              <div className="font-serif text-2xl sm:text-3xl font-bold" style={{ color: "oklch(0.35 0.15 22)" }}>{s.value}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PHOTO GALLERY ── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div ref={galleryRef} className="reveal">
          <div className="text-center mb-8 sm:mb-10">
            <span className="gold-badge mb-3 inline-block">Our Work</span>
            <h2 className="font-serif text-3xl sm:text-4xl" style={{ color: "oklch(0.35 0.15 22)" }}>
              A glimpse of <span className="gold-shimmer">glam</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">A mood board for your next glow-up</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {[
              { src: facialGoldImg, label: "Gold Facial", position: "center 30%" },
              { src: preBridalImg, label: "Pre Bridal", position: "center 20%" },
              { src: hairCutImg, label: "Hair Cuts", position: "center 60%" },
              { src: nailImg, label: "Nail Art", position: "center" },
              { src: cleanupImg, label: "Cleanup", position: "center" },
              { src: hairColor2Img, label: "Hair Treatment", position: "center 30%" },
            ].map((g, i) => (
              <div key={i} className={`img-zoom group relative aspect-[4/3] cursor-pointer animate-fade-up delay-${(i % 4 + 1) * 100}`}>
                <img src={g.src} alt={g.label} className="w-full h-full object-cover" style={{ objectPosition: g.position || "center" }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.35_0.15_22/70%)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 sm:p-4">
                  <span className="text-white font-serif text-sm sm:text-lg">{g.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="py-12 sm:py-16" style={{ background: "linear-gradient(180deg, oklch(0.968 0.018 85), oklch(0.94 0.03 82))" }}>
        <div ref={servicesRef} className="reveal mx-auto max-w-6xl px-4">
          <div className="mb-8 sm:mb-10 flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="gold-badge mb-2 inline-block">Services</span>
              <h2 className="font-serif text-3xl sm:text-4xl" style={{ color: "oklch(0.35 0.15 22)" }}>Popular services</h2>
              <p className="text-sm text-muted-foreground mt-1">Handpicked from our salon menu</p>
            </div>
            <Button asChild variant="ghost" className="font-semibold text-[oklch(0.68_0.13_68)] hover:text-accent-foreground shrink-0">
              <Link to="/services">See all →</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((cat, i) => {
              const imgData = SERVICE_IMAGES[cat.name];
              const imgSrc = imgData?.src;
              const position = imgData?.position || "center";
              return (
                <div
                  key={cat.name}
                  className={`service-card rounded-2xl overflow-hidden border bg-card shadow-sm animate-fade-up delay-${(i % 4 + 1) * 100}`}
                  style={{ borderColor: "oklch(0.84 0.042 80)" }}
                >
                  {/* Image header */}
                  {imgSrc && (
                    <div className="img-zoom h-36 sm:h-40 w-full">
                      <img src={imgSrc} alt={cat.name} className="w-full h-full object-cover" style={{ objectPosition: position }} />
                    </div>
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg"></span>
                      <h3 className="font-serif text-lg sm:text-xl" style={{ color: "oklch(0.35 0.15 22)" }}>{cat.name}</h3>
                    </div>
                    <ul className="space-y-2 text-sm">
                      {cat.items.slice(0, 4).map((s) => (
                        <li key={s.id} className="flex justify-between border-b border-dashed py-1.5" style={{ borderColor: "oklch(0.84 0.042 80)" }}>
                          <span className="text-foreground/80 min-w-0 pr-2 truncate">{s.name}</span>
                          <span className="font-semibold shrink-0" style={{ color: "oklch(0.68 0.13 68)" }}>
                            {s.price === "On request" ? "On request" : `₹${s.price}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-full min-h-[44px]" style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}>
                      <Link to="/book">Book this →</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>


    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm" style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))" }}>
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}
