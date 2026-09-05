import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  isAdminAuthenticated,
  getAdminUser,
  clearAdminSession,
  clearSession,
  getUser,
  getToken,
  setAdminSession,
} from "@/lib/api";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  LogOut,
  Scissors,
  Menu,
  X,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/admin/_layout")({
  component: AdminLayout,
});

const NAV_LINKS = [
  { to: "/admin/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
];

function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Reactive auth state - recalculated whenever salon-auth-change fires
  const [isAuthed, setIsAuthed] = useState(() =>
    isAdminAuthenticated() || getUser()?.role === "ADMIN"
  );

  // ── Auth: accept regular session if user is ADMIN ───────────────────────
  useEffect(() => {
    function checkAuth() {
      // Already have a valid admin session
      if (isAdminAuthenticated()) { setIsAuthed(true); return; }

      // Promote regular session if it has ADMIN role
      const regularUser = getUser();
      const regularToken = getToken();
      if (regularUser?.role === "ADMIN" && regularToken) {
        setAdminSession(regularToken, regularUser);
        setIsAuthed(true);
        return;
      }

      // No valid admin access → redirect to homepage
      setIsAuthed(false);
      navigate({ to: "/" });
    }

    checkAuth();
    window.addEventListener("salon-auth-change", checkAuth);
    window.addEventListener("salon-admin-auth-change", checkAuth);
    return () => {
      window.removeEventListener("salon-auth-change", checkAuth);
      window.removeEventListener("salon-admin-auth-change", checkAuth);
    };
  }, [navigate]);

  const adminUser = getAdminUser() ?? getUser();

  function handleLogout() {
    clearAdminSession(); // clear admin token
    clearSession();      // clear regular user token too
    navigate({ to: "/" }); // always go back to homepage
  }

  // Don't render anything until auth is confirmed
  if (!isAuthed) return null;

  return (
    <div className="flex min-h-screen font-sans" style={{ background: "oklch(0.968 0.018 85)" }}>
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: "oklch(0.25 0.05 50 / 45%)", backdropFilter: "blur(4px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0`}
        style={{
          background: "oklch(0.998 0.004 85 / 92%)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid oklch(0.84 0.042 80 / 70%)",
          boxShadow: "4px 0 32px oklch(0.35 0.15 22 / 8%)",
        }}
      >
        {/* Logo */}
        <div
          className="flex h-16 items-center gap-3 px-6"
          style={{ borderBottom: "1px solid oklch(0.84 0.042 80 / 60%)" }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg"
            style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))" }}
          >
            <Scissors className="h-4 w-4" style={{ color: "oklch(0.99 0.01 85)" }} />
          </div>
          <div>
            <p
              className="text-sm font-bold leading-none"
              style={{ color: "oklch(0.25 0.05 50)", fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}
            >
              Hemangi Glam
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "oklch(0.68 0.13 68)" }}>
              Admin Panel
            </p>
          </div>
          <button
            className="ml-auto lg:hidden"
            style={{ color: "oklch(0.55 0.04 50)" }}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 px-3 py-5">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/admin/"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className="group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                style={
                  active
                    ? {
                      background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 8%), oklch(0.68 0.13 68 / 6%))",
                      color: "oklch(0.35 0.15 22)",
                      border: "1px solid oklch(0.35 0.15 22 / 15%)",
                      boxShadow: "0 2px 10px oklch(0.35 0.15 22 / 6%)",
                    }
                    : {
                      color: "oklch(0.50 0.04 50)",
                      border: "1px solid transparent",
                    }
                }
              >
                <Icon
                  className="h-4 w-4 flex-shrink-0 transition-colors"
                  style={{ color: active ? "oklch(0.68 0.13 68)" : "oklch(0.60 0.04 50)" }}
                />
                {label}
                {active && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{ background: "oklch(0.68 0.13 68)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="p-4" style={{ borderTop: "1px solid oklch(0.84 0.042 80 / 60%)" }}>
          <div
            className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: "oklch(0.92 0.030 83 / 50%)",
              border: "1px solid oklch(0.84 0.042 80 / 50%)",
            }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-md flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
                color: "oklch(0.99 0.01 85)",
              }}
            >
              {adminUser?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold" style={{ color: "oklch(0.25 0.05 50)" }}>
                {adminUser?.name ?? "Admin"}
              </p>
              <p className="truncate text-[10px]" style={{ color: "oklch(0.55 0.04 50)" }}>
                {adminUser?.email}
              </p>
            </div>
            <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "oklch(0.68 0.13 68)" }} />
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all"
            style={{ color: "oklch(0.50 0.04 50)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.577 0.245 27.325 / 8%)";
              (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.45 0.18 22)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.50 0.04 50)";
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="flex h-16 items-center gap-4 px-6"
          style={{
            background: "oklch(0.998 0.004 85 / 85%)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid oklch(0.84 0.042 80 / 60%)",
            boxShadow: "0 1px 16px oklch(0.35 0.15 22 / 6%)",
          }}
        >
          <button
            className="lg:hidden p-1 -ml-1 rounded-lg"
            style={{ color: "oklch(0.50 0.04 50)" }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <span
            className="hidden sm:block text-sm font-medium"
            style={{ color: "oklch(0.55 0.04 50)" }}
          >
            {NAV_LINKS.find((l) =>
              l.to === "/admin/"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(l.to)
            )?.label ?? "Admin"}
          </span>
          <div
            className="h-5 w-px hidden sm:block"
            style={{ background: "oklch(0.84 0.042 80)" }}
          />
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 8%), oklch(0.68 0.13 68 / 6%))",
              color: "oklch(0.35 0.15 22)",
              border: "1px solid oklch(0.35 0.15 22 / 18%)",
            }}
          >
            <Shield className="h-3 w-3" style={{ color: "oklch(0.68 0.13 68)" }} />
            ADMIN
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 lg:px-12 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
