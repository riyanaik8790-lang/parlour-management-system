import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Sparkles, ShieldCheck, Heart, Award, Clock, Star, ArrowRight, IndianRupee } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/services-data";

import heroBg from "@/assets/new_salon_hero_bg.jpg";
import facialImg from "@/assets/facial_service.png";
import bridalImg from "@/assets/bridal_makeup.png";
import preBridalImg from "@/assets/pre_bridal.jpg";
import hairSpaImg from "@/assets/hair_spa.png";
import floralBgImg from "@/assets/luxury-floral-bg.png";
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
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const STATS = [
  { icon: <Heart className="h-6 w-6" />, value: "2000+", label: "Happy Clients" },
  { icon: <Award className="h-6 w-6" />, value: "15+", label: "Services" },
  {
    icon: <Star className="h-6 w-6 fill-current text-[oklch(0.68_0.13_68)]" />,
    value: (
      <span className="inline-flex items-center gap-1">
        4.9 <Star className="h-5 w-5 fill-current text-[oklch(0.68_0.13_68)] inline" />
      </span>
    ),
    label: "Rating",
  },
  { icon: <Clock className="h-6 w-6" />, value: "1+", label: "Years Experience" },
];

const SERVICE_IMAGES: Record<string, { src: string; position: string }> = {
  Facial: { src: facialGoldImg, position: "center 30%" },
  "Hair Care": { src: hairSpaImg, position: "center 25%" },
  Packages: { src: bridalImg, position: "center 20%" },
  "Manicure & Pedicure": { src: pedicureImg, position: "center" },
  Bleach: { src: bleachImg, position: "center 35%" },
  Cleanup: { src: cleanupImg, position: "center" },
  "Threading & Face": { src: threadingImg, position: "center 15%" },
  Waxing: { src: waxingImg, position: "center" },
  "D-Tan": { src: facialImg, position: "center 25%" },
};

const GALLERY_ITEMS = [
  { src: facialGoldImg, label: "Gold Facial", position: "center 30%" },
  { src: preBridalImg, label: "Pre Bridal", position: "center 20%" },
  { src: hairCutImg, label: "Hair Cuts", position: "center 60%" },
  { src: nailImg, label: "Nail Art", position: "center" },
  { src: cleanupImg, label: "Cleanup", position: "center" },
  { src: hairColor2Img, label: "Hair Treatment", position: "center 30%" },
  { src: hairSpaImg, label: "Hair Spa", position: "center 25%" },
  { src: pedicureImg, label: "Pedicure", position: "center" },
];

const QUAD_GALLERY_ITEMS = [
  ...GALLERY_ITEMS,
  ...GALLERY_ITEMS,
  ...GALLERY_ITEMS,
  ...GALLERY_ITEMS,
];

function Index() {
  const featured = SERVICE_CATEGORIES.slice(0, 6);

  // Gallery touch/mouse drag & auto-scroll state
  const galleryScrollRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const isHoveredRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const wrapScroll = (container: HTMLDivElement) => {
    const oneSetWidth = container.scrollWidth / 4;
    if (oneSetWidth <= 0) return;
    if (container.scrollLeft >= oneSetWidth * 2) {
      container.scrollLeft -= oneSetWidth;
    } else if (container.scrollLeft < oneSetWidth) {
      container.scrollLeft += oneSetWidth;
    }
  };

  useEffect(() => {
    const container = galleryScrollRef.current;
    if (!container) return;

    // Start centered in the middle set so dragging left or right is immediately infinite
    const initTimer = setTimeout(() => {
      if (container) {
        const oneSetWidth = container.scrollWidth / 4;
        if (oneSetWidth > 0 && container.scrollLeft === 0) {
          container.scrollLeft = oneSetWidth;
        }
      }
    }, 60);

    let lastTime = performance.now();
    const step = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      if (!isDownRef.current && !isHoveredRef.current && container) {
        const dx = Math.min(dt * 0.045, 3);
        container.scrollLeft += dx;
        wrapScroll(container);
      }

      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);

    return () => {
      clearTimeout(initTimer);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = galleryScrollRef.current;
    if (!container) return;

    isDownRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
    scrollLeftStartRef.current = container.scrollLeft;

    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    try {
      container.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = galleryScrollRef.current;
    if (!isDownRef.current || !container) return;

    const dx = e.clientX - startXRef.current;
    container.scrollLeft = scrollLeftStartRef.current - dx;
    wrapScroll(container);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = galleryScrollRef.current;
    if (!isDownRef.current) return;
    isDownRef.current = false;
    setIsDragging(false);

    try {
      container?.releasePointerCapture(e.pointerId);
    } catch {}

    // Grace period before auto-glide resumes
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    isHoveredRef.current = true;
    resumeTimerRef.current = setTimeout(() => {
      isHoveredRef.current = false;
    }, 1200);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerUp(e);
  };

  const onMouseEnter = () => {
    if (!isDownRef.current) {
      isHoveredRef.current = true;
    }
  };

  const onMouseLeave = () => {
    if (!isDownRef.current) {
      isHoveredRef.current = false;
    }
  };

  // section refs
  const statsRef = useReveal();
  const servicesRef = useReveal();
  const galleryRef = useReveal();

  return (
    <div className="overflow-x-hidden">
      {/* â”€â”€ HERO â”€â”€ */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Background image â€” Ken Burns slow zoom */}
        <img
          src={heroBg}
          alt="Salon background"
          className="absolute inset-0 w-full h-full object-cover hero-bg-kenburns"
          style={{ opacity: 0.35 }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.968_0.018_85)] via-[oklch(0.968_0.018_85/85%)] to-[oklch(0.35_0.15_22/20%)]" />

        <div className="relative mx-auto flex max-w-6xl w-full flex-col items-center justify-center gap-10 px-4 sm:px-6 py-16 sm:py-24 md:py-32 text-center">
          {/* Headline + CTAs */}
          <div className="flex flex-col items-center max-w-2xl w-full">
            {/* Top pill badge â€” staggered badge 1 */}
            <span className="gold-badge mb-4 badge-reveal badge-reveal-1">Premium Salon Experience</span>

            <h1 className="font-serif text-3xl sm:text-5xl leading-tight md:text-7xl">
              {/* "Beauty" â€” word slide-up, delay 0.25s */}
              <span
                className="hero-word"
                style={{ color: "oklch(0.35 0.15 22)", animationDelay: "0.25s" }}
              >
                Beauty
              </span>{" "}
              {/* "booked" â€” word slide-up, delay 0.45s */}
              <span
                className="hero-word"
                style={{ color: "oklch(0.35 0.15 22)", animationDelay: "0.45s" }}
              >
                booked
              </span>
              <br />
              {/* "beautifully." â€” mask/handwriting reveal, delay 0.75s */}
              <span
                className="font-script gold-shimmer hero-script-reveal"
                style={{ fontSize: "1.15em", animationDelay: "0.75s" }}
              >
                beautifully.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed animate-fade-up delay-400">
              Ready for your glow-up? Choose your favorite service and reserve your moment of magic instantly.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-6 animate-fade-up delay-500 w-full sm:w-auto">
              {/* Primary CTA â€” pulsing maroon glow */}
              <Button
                asChild
                size="lg"
                className="btn-maroon btn-maroon-glow rounded-full px-8 shadow-lg text-base w-full sm:w-auto min-h-[44px]"
              >
                <Link to="/book">
                  <CalendarCheck className="mr-2 h-5 w-5" />
                  Book an Appointment
                </Link>
              </Button>
              {/* Secondary CTA â€” scale hover via btn-outline-gold */}
              <Button
                asChild
                variant="outline"
                size="lg"
                className="btn-outline-gold rounded-full px-8 text-base border-2 w-full sm:w-auto min-h-[44px]"
                style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}
              >
                <Link to="/services">View Services</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Gold wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <hr className="gold-divider" />
        </div>
      </section>

      {/* â”€â”€ STATS â”€â”€ */}
      <section className="py-12 bg-gradient-to-r from-secondary/60 via-background to-secondary/60">
        <div
          ref={statsRef}
          className="reveal mx-auto max-w-5xl px-4 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {STATS.map((s, i) => (
            <div key={s.label} className={`stat-card animate-scale-in delay-${(i + 1) * 100}`}>
              <div className="flex justify-center mb-2" style={{ color: "oklch(0.68 0.13 68)" }}>
                {s.icon}
              </div>
              <div
                className="font-serif text-2xl sm:text-3xl font-bold"
                style={{ color: "oklch(0.35 0.15 22)" }}
              >
                {s.value}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── UNIFIED GLAM & SERVICES SECTIONS WITH CONTINUOUS SEAMLESS FLORAL WATERMARK ── */}
      <div className="relative w-full overflow-hidden">
        {/* Full coverage, continuous seamless repeating floral watermark across both sections */}
        <div
          className="absolute inset-0 pointer-events-none -z-10 mix-blend-multiply opacity-100"
          style={{
            backgroundImage: "url('/luxury-floral-bg.png')",
            backgroundRepeat: "repeat",
            backgroundSize: "600px auto",
          }}
        />

        {/* ── PHOTO GALLERY: TOUCH & MOUSE PAN DRAGGABLE MARQUEE SLIDER ── */}
        <section id="glam-section" className="relative w-full py-14 sm:py-20 overflow-hidden">
          <div ref={galleryRef} className="reveal relative z-10">
            <div className="text-center mb-8 sm:mb-10 max-w-4xl mx-auto px-4">
              <span className="gold-badge mb-3 inline-block">Our Work</span>
              <h2
                className="font-serif text-3xl sm:text-4xl"
                style={{ color: "oklch(0.35 0.15 22)" }}
              >
                A glimpse of <span className="gold-shimmer">glam</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-2">A mood board for your next glow-up</p>
            </div>

            {/* Draggable & Touch-swipe Pan Gallery Container */}
            <div
              ref={galleryScrollRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              className={`w-full overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-y py-3 select-none ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div className="flex items-center gap-4 sm:gap-6 md:gap-8 w-max px-4">
                {QUAD_GALLERY_ITEMS.map((g, i) => (
                  <div
                    key={`gallery-item-${i}`}
                    className="group relative shrink-0 w-[220px] sm:w-72 md:w-80 h-[290px] sm:h-80 overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02] select-none"
                  >
                    <img
                      src={g.src}
                      alt={g.label}
                      draggable={false}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none select-none"
                      style={{ objectPosition: g.position || "center" }}
                    />
                    {/* Dark gradient overlay with label */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.35_0.15_22/85%)] via-[oklch(0.35_0.15_22/30%)] to-transparent opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4 sm:p-5 pointer-events-none select-none">
                      <span className="text-white font-serif text-base sm:text-lg md:text-xl tracking-wide font-medium">
                        {g.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SERVICES SECTION ── */}
        <section
          id="services-section"
          className="relative py-14 sm:py-20 overflow-hidden"
        >
          <div ref={servicesRef} className="reveal relative z-10 mx-auto max-w-6xl px-4">
          <div className="mb-8 sm:mb-10 flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="gold-badge mb-2 inline-block">Services</span>
              <h2
                className="font-serif text-3xl sm:text-4xl"
                style={{ color: "oklch(0.35 0.15 22)" }}
              >
                Popular services
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Elevate your look with our most popular signature services.</p>
            </div>
            <Button
              asChild
              variant="ghost"
              className="font-semibold text-[oklch(0.68_0.13_68)] hover:text-accent-foreground shrink-0 gap-1.5"
            >
              <Link to="/services" className="inline-flex items-center gap-1.5">
                See all <ArrowRight className="h-4 w-4" />
              </Link>
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
                  className={`service-card rounded-2xl overflow-hidden border bg-card shadow-sm animate-fade-up delay-${((i % 4) + 1) * 100}`}
                  style={{ borderColor: "oklch(0.84 0.042 80)" }}
                >
                  {/* Image header */}
                  {imgSrc && (
                    <div className="img-zoom h-36 sm:h-40 w-full">
                      <img
                        src={imgSrc}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: position }}
                      />
                    </div>
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg"></span>
                      <h3
                        className="font-serif text-lg sm:text-xl"
                        style={{ color: "oklch(0.35 0.15 22)" }}
                      >
                        {cat.name}
                      </h3>
                    </div>
                    <ul className="space-y-2 text-sm">
                      {cat.items.slice(0, 4).map((s) => (
                        <li
                          key={s.id}
                          className="flex justify-between border-b border-dashed py-1.5"
                          style={{ borderColor: "oklch(0.84 0.042 80)" }}
                        >
                          <span className="text-foreground/80 min-w-0 pr-2 truncate">{s.name}</span>
                          <span
                            className="font-semibold shrink-0"
                            style={{ color: "oklch(0.68 0.13 68)" }}
                          >
                            {s.price === "On request" ? "On request" : `Rs. ${s.price}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full rounded-full min-h-[44px]"
                      style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}
                    >
                      <Link to="/book" className="inline-flex items-center justify-center gap-1.5">
                        Book this <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  </div>
);
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm"
        style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))" }}
      >
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}
