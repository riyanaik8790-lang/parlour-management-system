import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, CalendarCheck, TrendingUp, Scissors, ArrowRight, Sparkles } from "lucide-react";

// ── Brand palette tokens ──────────────────────────────────────────────────────
const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const GOLD_LIGHT = "oklch(0.80 0.10 72)";
const CARD_WHITE = "rgba(255,255,255,0.92)";
const TEXT_DARK = "oklch(0.25 0.05 50)";
const TEXT_MUTED = "oklch(0.58 0.04 60)";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard - Admin | Hemangi Glam Salon" }] }),
  component: AdminDashboard,
});

type Stats = {
  total_users: number;
  bookings_today: number;
  total_services: number;
  bookings_mtd: number;
  total_bookings: number;
};

function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminGetStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"));
  }, []);

  // All icons use brand burgundy→gold spectrum - no clashing blues/greens
  const STATS = [
    {
      label: "Total Users",
      value: stats ? String(stats.total_users) : "-",
      icon: Users,
      iconBg: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
      glowColor: BURGUNDY,
      decorColor: "oklch(0.35 0.15 22 / 10%)",
    },
    {
      label: "Bookings Today",
      value: stats ? String(stats.bookings_today) : "-",
      icon: CalendarCheck,
      iconBg: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
      glowColor: GOLD,
      decorColor: "oklch(0.68 0.13 68 / 10%)",
    },
    {
      label: "Services Available",
      value: stats ? String(stats.total_services) : "53",
      icon: Scissors,
      iconBg: "linear-gradient(135deg, oklch(0.42 0.14 18), oklch(0.55 0.12 28))",
      glowColor: "oklch(0.42 0.14 18)",
      decorColor: "oklch(0.42 0.14 18 / 9%)",
    },
    {
      label: "Bookings This Month",
      value: stats ? String(stats.bookings_mtd) : "-",
      icon: TrendingUp,
      iconBg: "linear-gradient(135deg, oklch(0.60 0.10 55), oklch(0.72 0.14 65))",
      glowColor: "oklch(0.60 0.10 55)",
      decorColor: "oklch(0.60 0.10 55 / 9%)",
    },
  ];

  return (
    <div className="space-y-10 px-4 sm:px-8 lg:px-12 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="animate-fade-up">
        <span
          className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 8%), oklch(0.68 0.13 68 / 6%))",
            color: BURGUNDY,
            border: "1px solid oklch(0.35 0.15 22 / 18%)",
          }}
        >
          <Sparkles className="h-3 w-3" style={{ color: GOLD }} />
          Admin Overview
        </span>
        <h1
          className="text-4xl font-bold leading-tight"
          style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
        >
          Dashboard
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
          Welcome back! Here&apos;s what&apos;s happening at Hemangi Glam.
        </p>
      </div>

      {error && (
        <div
          className="rounded-2xl p-4 text-sm animate-fade-up"
          style={{
            background: "oklch(0.577 0.245 27.325 / 8%)",
            border: "1px solid oklch(0.577 0.245 27.325 / 20%)",
            color: "oklch(0.45 0.18 27)",
          }}
        >
          ⚠️ Could not load live stats - ensure the backend is running. {error}
        </div>
      )}

      {/* Gold divider */}
      <div className="gold-divider animate-fade-up delay-100" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 animate-fade-up delay-200">
        {STATS.map(({ label, value, icon: Icon, iconBg, glowColor, decorColor }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5"
            style={{
              background: CARD_WHITE,
              boxShadow: "0 4px 30px oklch(0.35 0.15 22 / 7%), 0 1px 4px oklch(0.35 0.15 22 / 4%)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                `0 16px 48px ${glowColor}25, 0 4px 16px oklch(0.35 0.15 22 / 8%)`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                "0 4px 30px oklch(0.35 0.15 22 / 7%), 0 1px 4px oklch(0.35 0.15 22 / 4%)";
            }}
          >
            {/* Corner glow blob */}
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-60 transition-opacity group-hover:opacity-100"
              style={{ background: decorColor }}
            />
            {/* Bottom-left accent */}
            <div
              className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full blur-xl opacity-30"
              style={{ background: decorColor }}
            />

            {/* Icon */}
            <div
              className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
              style={{ background: iconBg }}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>

            {/* Stat number */}
            <p
              className="text-4xl font-bold leading-none"
              style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
            >
              {value === "-" && !stats ? (
                <span
                  className="inline-block h-9 w-14 animate-pulse rounded-lg"
                  style={{ background: "oklch(0.91 0.025 82)" }}
                />
              ) : value}
            </p>

            {/* Label */}
            <p className="mt-2 text-sm font-medium" style={{ color: TEXT_MUTED }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Premium total bookings banner */}
      {stats && (
        <div
          className="relative overflow-hidden rounded-2xl animate-fade-up delay-300"
          style={{
            background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 6%) 0%, oklch(0.68 0.13 68 / 8%) 50%, oklch(0.35 0.15 22 / 4%) 100%)",
            boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
            border: "1px solid oklch(0.35 0.15 22 / 10%)",
          }}
        >
          {/* Decorative blobs */}
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ background: GOLD }}
          />
          <div
            className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full blur-3xl opacity-15"
            style={{ background: BURGUNDY }}
          />

          <div className="relative flex items-center gap-5 px-6 py-5">
            {/* Serif number tile */}
            <div
              className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-2xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
            >
              <span
                className="text-2xl font-bold leading-none text-white"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {stats.total_bookings}
              </span>
            </div>

            <div className="flex-1">
              <p
                className="text-base font-semibold"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                Total Appointments
              </p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: TEXT_MUTED }}>
                Across all time - confirmed, completed &amp; active bookings
              </p>
            </div>

            {/* Gold pill badge */}
            <span
              className="hidden sm:inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                color: "white",
                boxShadow: `0 4px 14px oklch(0.68 0.13 68 / 35%)`,
              }}
            >
              All Time
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="animate-fade-up delay-400">
        <h2
          className="mb-5 text-xs font-semibold uppercase tracking-widest"
          style={{ color: GOLD }}
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Manage Users card */}
          <Link
            to="/admin/users"
            className="group flex items-center gap-4 rounded-2xl p-6 transition-all duration-300"
            style={{
              background: CARD_WHITE,
              boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 12px 40px oklch(0.35 0.15 22 / 12%)";
              el.style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 4px 24px oklch(0.35 0.15 22 / 6%)";
              el.style.transform = "translateY(0)";
            }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
            >
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p
                className="font-semibold"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                Manage Users
              </p>
              <p className="mt-0.5 text-sm" style={{ color: TEXT_MUTED }}>
                {stats
                  ? `${stats.total_users} registered customer${stats.total_users !== 1 ? "s" : ""}`
                  : "View all registered customers"}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
              style={{ color: GOLD }}
            />
          </Link>

          {/* Manage Bookings card */}
          <Link
            to="/admin/bookings"
            className="group flex items-center gap-4 rounded-2xl p-6 transition-all duration-300"
            style={{
              background: CARD_WHITE,
              boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 12px 40px oklch(0.68 0.13 68 / 16%)";
              el.style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 4px 24px oklch(0.35 0.15 22 / 6%)";
              el.style.transform = "translateY(0)";
            }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}
            >
              <CalendarCheck className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p
                className="font-semibold"
                style={{ color: TEXT_DARK, fontFamily: "var(--font-serif)" }}
              >
                Manage Bookings
              </p>
              <p className="mt-0.5 text-sm" style={{ color: TEXT_MUTED }}>
                {stats
                  ? `${stats.bookings_today} booking${stats.bookings_today !== 1 ? "s" : ""} today`
                  : "View and manage appointments"}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1"
              style={{ color: GOLD }}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

