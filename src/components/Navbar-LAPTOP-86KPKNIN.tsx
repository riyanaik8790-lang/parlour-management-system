import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { clearSession, getUser, type StoredUser } from "@/lib/api";
import { ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";

export function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    // Clear mock data so previous account's bookings don't bleed over
    window.localStorage.removeItem("salon_mock_bookings");
    window.localStorage.removeItem("salon_mock_analyses");
    clearSession();
    navigate({ to: "/" });
  }

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    window.addEventListener("salon-auth-change", sync);
    window.addEventListener("salon-admin-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("salon-auth-change", sync);
      window.removeEventListener("salon-admin-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Show Admin link if the logged-in user has ADMIN role
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/services", label: "Services" },
    { to: "/book", label: "Book" },
    { to: "/try-on", label: "Try-On" },
    ...(user ? [{ to: "/my-bookings", label: "My Bookings" }] : []),
  ];

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-background/92 backdrop-blur-md transition-all duration-300 ${scrolled ? "nav-scrolled" : ""}`}
      style={{ borderColor: "oklch(0.84 0.042 80 / 60%)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full overflow-hidden shadow-sm ring-1 ring-border">
            <div className="absolute inset-0 rounded-full animate-pulse-glow" style={{ opacity: 0.6 }} />
            <img
              src={logo}
              alt="Hemangi Makeover logo"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 relative z-10"
            />
          </div>
          <span className="leading-tight">
            <span className="block font-serif text-lg" style={{ color: "oklch(0.35 0.15 22)" }}>Hemangi</span>
            <span className="font-script -mt-1 block text-sm gold-shimmer">Makeover</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((ln) => (
            <Link
              key={ln.to}
              to={ln.to}
              className="relative px-3 py-1.5 text-sm text-foreground/75 hover:text-primary transition-colors duration-200 rounded-full hover:bg-secondary/60 font-medium"
              activeProps={{ className: "text-primary font-semibold bg-secondary/60 px-3 py-1.5 rounded-full" }}
            >
              {ln.label}
            </Link>
          ))}
          {/* Admin link - only visible when logged-in as ADMIN */}
          {isAdmin && (
            <Link
              to="/admin"
              className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-rose-600/10 px-3 py-1.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-600/20 transition hover:bg-rose-600/20"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
        </nav>

        {/* Auth buttons (hidden on mobile - appear in mobile menu) */}
        <div className="hidden sm:flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline font-medium">
                Hi, {user.name.split(" ")[0]} !
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLogout()}
                className="rounded-full border-2 text-sm"
                style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="rounded-full text-sm">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild size="sm" className="btn-maroon rounded-full text-sm px-4">
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="ml-1 flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full md:hidden"
          style={{ background: "oklch(0.90 0.055 82)" }}
          onClick={() => setMenuOpen((p) => !p)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-5 rounded transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} style={{ background: "oklch(0.35 0.15 22)" }} />
          <span className={`block h-0.5 w-5 rounded transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} style={{ background: "oklch(0.35 0.15 22)" }} />
          <span className={`block h-0.5 w-5 rounded transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} style={{ background: "oklch(0.35 0.15 22)" }} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t md:hidden" style={{ background: "oklch(0.968 0.018 85)", borderColor: "oklch(0.84 0.042 80 / 60%)" }}>
          {/* Greeting for logged-in user — shown at top of mobile menu */}
          {user && (
            <div
              className="px-5 py-3 border-b text-sm font-medium"
              style={{ borderColor: "oklch(0.84 0.042 80 / 40%)", color: "oklch(0.35 0.15 22)" }}
            >
              👋 Hi, {user.name.split(" ")[0]}!
            </div>
          )}
          <nav className="flex flex-col px-4 py-3 gap-1">
            {navLinks.map((ln) => (
              <Link
                key={ln.to}
                to={ln.to}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-3 text-sm rounded-xl font-medium text-foreground/80 hover:text-primary hover:bg-secondary/60 transition-all min-h-[44px] flex items-center"
                activeProps={{ className: "text-primary font-semibold bg-secondary/60 px-3 py-3 rounded-xl min-h-[44px] flex items-center" }}
              >
                {ln.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-1.5 px-3 py-3 text-sm rounded-xl font-semibold text-rose-700 bg-rose-600/10 hover:bg-rose-600/20 transition-all min-h-[44px]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Panel
              </Link>
            )}
          </nav>
          {/* Auth actions inside mobile menu */}
          <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-2" style={{ borderColor: "oklch(0.84 0.042 80 / 40%)" }}>
            {user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { handleLogout(); setMenuOpen(false); }}
                className="w-full rounded-full border-2 text-sm min-h-[44px]"
                style={{ borderColor: "oklch(0.68 0.13 68)", color: "oklch(0.35 0.15 22)" }}
              >
                Logout
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="w-full rounded-full text-sm min-h-[44px]">
                  <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
                </Button>
                <Button asChild size="sm" className="w-full btn-maroon rounded-full text-sm min-h-[44px]">
                  <Link to="/register" onClick={() => setMenuOpen(false)}>Register</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}