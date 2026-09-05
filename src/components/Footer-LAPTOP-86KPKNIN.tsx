import { Instagram, Phone, MapPin, Clock, Heart, Youtube } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-16 border-t" style={{ background: "linear-gradient(180deg, oklch(0.92 0.04 82), oklch(0.88 0.055 80))", borderColor: "oklch(0.84 0.042 80 / 60%)" }}>
      {/* Gold divider */}
      <hr className="gold-divider" />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="font-serif text-2xl mb-1" style={{ color: "oklch(0.35 0.15 22)" }}>Hemangi</div>
            <div className="font-script text-xl gold-shimmer mb-3" style={{ fontSize: "1.4rem" }}>Glam Salon</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Walk-ins welcome<br />
              Appointments preferred
            </p>
            <div className="mt-4 flex gap-3">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/hemangi_glamsalon"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-muted-foreground hover:text-primary transition-colors group"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))", color: "white" }}
                >
                  <Instagram size={16} />
                </span>
              </a>

              {/* YouTube */}
              <a
                href="https://www.youtube.com/@Hemangiglamsalonvlogs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="text-muted-foreground hover:text-primary transition-colors group"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))", color: "white" }}
                >
                  <Youtube size={16} />
                </span>
              </a>

              {/* WhatsApp */}
              <a
                href="https://wa.me/918208576165"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="text-muted-foreground hover:text-primary transition-colors group"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))", color: "white" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9l-5.05.9z" />
                    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1z" />
                    <path d="M14 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1z" />
                    <path d="M9.5 15.5a5 5 0 0 0 5 0" />
                  </svg>
                </span>
              </a>

              {/* Phone */}
              <a
                href="tel:+918208576165"
                aria-label="Call us"
                className="text-muted-foreground hover:text-primary transition-colors group"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))", color: "white" }}
                >
                  <Phone size={16} />
                </span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <div className="mb-4 font-semibold text-sm uppercase tracking-wider" style={{ color: "oklch(0.68 0.13 68)" }}>Quick Links</div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {[
                { to: "/",           label: "Home" },
                { to: "/services",   label: "Services & Pricing" },
                { to: "/book",       label: "Book Appointment" },
                { to: "/try-on",     label: "AI Skin Try-On" },
                { to: "/my-bookings",label: "My Bookings" },
              ].map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-primary transition-colors flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "oklch(0.68 0.13 68)" }}>•</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <div className="mb-4 font-semibold text-sm uppercase tracking-wider" style={{ color: "oklch(0.68 0.13 68)" }}>Hours</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Clock size={14} className="mt-0.5 shrink-0" style={{ color: "oklch(0.68 0.13 68)" }} />
                <span>
                  Mon – Thu &amp; Sat – Sun<br />
                  <strong className="text-foreground">9:00 AM – 5:00 PM</strong>
                  <br /><span className="text-xs text-red-400 font-medium">Friday: Closed</span>
                </span>
              </li>
              <li className="mt-3 flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: "oklch(0.68 0.13 68)" }} />
                <span>Hemangi Glam Salon, Thakarshi Complex,<br />Above National Jewellers,<br />Khandeshwari Naka Road.</span>
              </li>
            </ul>
          </div>

          {/* Services highlight */}
          <div>
            <div className="mb-4 font-semibold text-sm uppercase tracking-wider" style={{ color: "oklch(0.68 0.13 68)" }}>Top Services</div>
            <div className="flex flex-wrap gap-2">
              {["Facial","Hair Spa","Bridal Makeup","Threading","Waxing","Nail Art","Bleach","Cleanup","D-Tan"].map((s) => (
                <Link to="/services" key={s}>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full transition-all hover:scale-105 cursor-pointer"
                    style={{
                      background: "oklch(0.998 0.004 85)",
                      border: "1px solid oklch(0.84 0.042 80)",
                      color: "oklch(0.35 0.15 22)",
                    }}
                  >
                    {s}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <hr className="gold-divider" />
      <div className="py-4 text-center text-xs text-muted-foreground flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4">
        <span className="whitespace-nowrap">© {new Date().getFullYear()} Hemangi Glam Salon</span>
        <span aria-hidden className="hidden sm:inline">·</span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          Made with <Heart className="inline h-3 w-3 fill-current" style={{ color: "oklch(0.68 0.13 68)" }} /> for beauty lovers
        </span>
      </div>
    </footer>
  );
}