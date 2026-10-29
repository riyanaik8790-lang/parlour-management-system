import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, clearSession, getUser, type StoredUser } from "@/lib/api";
import { ShieldCheck, Settings, LogOut, ChevronDown } from "lucide-react";
import logo from "@/assets/logo.png";
import { NotificationBell } from "@/components/NotificationBell";

const BURGUNDY = "oklch(0.35 0.15 22)";

/** Generate initials (up to 2 chars) from a display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic soft background color from initials. */
function initialsColor(initials: string): string {
  const palettes = [
    "oklch(0.82 0.08 22)",   // soft rose
    "oklch(0.80 0.07 68)",   // warm gold
    "oklch(0.78 0.09 160)",  // sage green
    "oklch(0.80 0.08 250)",  // sky blue
    "oklch(0.78 0.08 300)",  // soft lavender
    "oklch(0.80 0.08 30)",   // peach
  ];
  const code = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return palettes[code % palettes.length];
}

export function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    window.localStorage.removeItem("salon_mock_bookings");
    window.localStorage.removeItem("salon_mock_analyses");
    clearSession();
    setAvatarDropdownOpen(false);
    navigate({ to: "/" });
  }

  // Sync session & fetch fresh profile avatar
  useEffect(() => {
    const sync = () => {
      const u = getUser();
      setUser(u);
      if (u) {
        api.getProfile()
          .then((p) => setAvatarUrl(p.avatar_url ?? null))
          .catch(() => setAvatarUrl(null));
      } else {
        setAvatarUrl(null);
      }
    };
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

  // Close avatar dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        avatarDropdownRef.current &&
        !avatarDropdownRef.current.contains(e.target as Node)
      ) {
        setAvatarDropdownOpen(false);
      }
    }
    if (avatarDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [avatarDropdownOpen]);

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
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full animate-pulse-glow"
              style={{ opacity: 0.6 }}
            />
            <img
              src={logo}
              alt="Hemangi Makeover logo"
              className="h-10 w-10 md:h-14 md:w-14 rounded-full object-cover shadow-sm transition-transform duration-300 group-hover:scale-105 relative z-10"
            />
          </div>
          <span className="leading-tight">
            <span className="block font-serif text-lg" style={{ color: "oklch(0.35 0.15 22)" }}>
              Hemangi
            </span>
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
              activeProps={{
                className: "text-primary font-semibold bg-secondary/60 px-3 py-1.5 rounded-full",
              }}
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

        {/* Auth buttons */}
        <div className="relative flex items-center gap-2">
          {/* Notification bell - any logged-in user */}
          {user && <NotificationBell />}

          <div className="hidden sm:flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Greeting */}
                <span
                  className="text-sm font-medium select-none"
                  style={{ color: BURGUNDY }}
                >
                  Hi, {user.name.split(" ")[0]} !
                </span>

                {/* Avatar with relative dropdown container */}
                <div ref={avatarDropdownRef} className="relative">
                  {/* Clickable circular Avatar */}
                  <button
                    type="button"
                    onClick={() => setAvatarDropdownOpen((prev) => !prev)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full overflow-hidden shadow-sm ring-2 ring-[oklch(0.88_0.030_82)] transition-transform hover:scale-105 focus:outline-none"
                    aria-label="User menu"
                    aria-expanded={avatarDropdownOpen}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={`${user.name} avatar`}
                        className="h-full w-full object-cover"
                        onError={() => setAvatarUrl(null)}
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-sm font-bold select-none text-white"
                        style={{
                          background: initialsColor(getInitials(user.name)),
                          color: BURGUNDY,
                        }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                  </button>

                  {/* Absolute Dropdown Menu positioned right-0 mt-2 */}
                  {avatarDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-60 rounded-2xl bg-white p-2 shadow-xl border animate-fade-up z-50"
                      style={{ borderColor: "oklch(0.88 0.030 82)" }}
                    >
                      {/* Non-clickable Header showing full name and email */}
                      <div className="px-3 py-2.5 border-b" style={{ borderColor: "oklch(0.92 0.02 85)" }}>
                        <p className="text-sm font-semibold truncate" style={{ color: BURGUNDY }}>
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {user.email}
                        </p>
                      </div>

                      {/* Menu links */}
                      <div className="pt-1.5 space-y-1">
                        <Link
                          to="/settings"
                          onClick={() => setAvatarDropdownOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full"
                        >
                          <Settings className="h-4 w-4 text-gray-500" />
                          <span>Settings</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleLogout()}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors w-full text-left"
                        >
                          <LogOut className="h-4 w-4 text-rose-500" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-sm min-h-[44px]"
                >
                  <Link to="/login">Login</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="btn-maroon rounded-full text-sm px-4 min-h-[44px]"
                >
                  <Link to="/register">Register</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu trigger — avatar for logged-in, hamburger lines for guests */}
          <button
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full overflow-hidden md:hidden focus:outline-none transition-transform hover:scale-105"
            style={{
              boxShadow: menuOpen
                ? "0 0 0 2px oklch(0.35 0.15 22)"
                : "0 0 0 2px oklch(0.88 0.030 82)",
            }}
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {user ? (
              avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${user.name} avatar`}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarUrl(null)}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-sm font-bold select-none"
                  style={{
                    background: initialsColor(getInitials(user.name)),
                    color: BURGUNDY,
                  }}
                >
                  {getInitials(user.name)}
                </div>
              )
            ) : (
              /* Guest — classic animated hamburger lines */
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-1.5"
                style={{ background: "oklch(0.90 0.055 82)" }}
              >
                <span
                  className={`block h-0.5 w-5 rounded transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
                  style={{ background: "oklch(0.35 0.15 22)" }}
                />
                <span
                  className={`block h-0.5 w-5 rounded transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
                  style={{ background: "oklch(0.35 0.15 22)" }}
                />
                <span
                  className={`block h-0.5 w-5 rounded transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
                  style={{ background: "oklch(0.35 0.15 22)" }}
                />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="border-t md:hidden"
          style={{ background: "oklch(0.968 0.018 85)", borderColor: "oklch(0.84 0.042 80 / 60%)" }}
        >
          <nav className="flex flex-col px-4 py-3 gap-1">
            {user && (
              <div
                className="mb-3 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm border"
                style={{ background: "oklch(0.99 0.01 85)", borderColor: "oklch(0.91 0.025 82)" }}
              >
                {/* Avatar: real photo or initials fallback */}
                <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden shadow ring-2 ring-[oklch(0.88_0.030_82)]">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${user.name} avatar`}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-lg font-bold select-none"
                      style={{
                        background: initialsColor(getInitials(user.name)),
                        color: BURGUNDY,
                      }}
                    >
                      {getInitials(user.name)}
                    </div>
                  )}
                </div>

                {/* Name + Email */}
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate leading-tight"
                    style={{ color: BURGUNDY }}
                  >
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            {navLinks.map((ln) => (
              <Link
                key={ln.to}
                to={ln.to}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm rounded-xl font-medium text-foreground/80 hover:text-primary hover:bg-secondary/60 transition-all min-h-[44px] flex items-center"
                activeProps={{
                  className:
                    "text-primary font-semibold bg-secondary/60 px-3 py-2.5 rounded-xl min-h-[44px] flex items-center",
                }}
              >
                {ln.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl font-semibold text-rose-700 bg-rose-600/10 hover:bg-rose-600/20 transition-all min-h-[44px]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Panel
              </Link>
            )}

            <div className="h-px w-full bg-border/40 my-1" />
            {user ? (
              <>
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl font-medium text-foreground/80 hover:text-primary hover:bg-secondary/60 transition-all min-h-[44px]"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-left px-3 py-2.5 text-sm rounded-xl font-medium text-rose-600 hover:bg-rose-50 transition-all min-h-[44px] flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4 text-rose-500" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 text-sm rounded-xl font-medium text-foreground/80 hover:text-primary hover:bg-secondary/60 transition-all min-h-[44px] flex items-center sm:hidden"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 text-sm rounded-xl font-semibold text-white bg-primary hover:bg-primary/90 transition-all min-h-[44px] flex items-center sm:hidden"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
                  }}
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
