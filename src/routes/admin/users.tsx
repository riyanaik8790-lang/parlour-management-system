import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, type AdminUser, getAdminUser, getUser } from "@/lib/api";
import {
  Users,
  Search,
  ShieldCheck,
  User,
  RefreshCw,
  ShieldPlus,
  ShieldMinus,
  CheckCircle2,
  X,
  Key,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users - Admin" }] }),
  component: AdminUsersPage,
});

// ── Confirm dialog ────────────────────────────────────────────────────────
function ConfirmModal({
  user,
  action,
  onConfirm,
  onCancel,
  busy,
}: {
  user: AdminUser;
  action: "promote" | "demote";
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const isPromote = action === "promote";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "oklch(0.25 0.05 50 / 55%)", backdropFilter: "blur(6px)" }}
        onClick={onCancel}
      />
      {/* Card */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: "oklch(0.998 0.004 85)",
          border: "1px solid oklch(0.84 0.042 80 / 60%)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4"
          style={{
            background: isPromote
              ? "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))"
              : "linear-gradient(135deg, oklch(0.45 0.20 27), oklch(0.55 0.18 22))",
          }}
        >
          <div className="flex items-center gap-2">
            {isPromote ? (
              <ShieldPlus className="h-5 w-5" style={{ color: "oklch(0.99 0.01 85)" }} />
            ) : (
              <ShieldMinus className="h-5 w-5" style={{ color: "oklch(0.99 0.01 85)" }} />
            )}
            <h2
              className="font-bold"
              style={{ color: "oklch(0.99 0.01 85)", fontFamily: "var(--font-serif)" }}
            >
              {isPromote ? "Promote to Admin?" : "Revoke Admin Access?"}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm" style={{ color: "oklch(0.45 0.04 50)" }}>
            {isPromote ? (
              <>
                You are about to grant{" "}
                <span className="font-semibold" style={{ color: "oklch(0.25 0.05 50)" }}>
                  {user.name}
                </span>{" "}
                full admin access. They will be able to manage all users and bookings.
              </>
            ) : (
              <>
                You are about to revoke admin privileges from{" "}
                <span className="font-semibold" style={{ color: "oklch(0.25 0.05 50)" }}>
                  {user.name}
                </span>
                . They will be demoted to a regular customer.
              </>
            )}
          </p>

          <div
            className="mt-4 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "oklch(0.92 0.030 83 / 50%)",
              border: "1px solid oklch(0.84 0.042 80 / 50%)",
              color: "oklch(0.55 0.04 50)",
            }}
          >
            <p>
              <span style={{ color: "oklch(0.65 0.04 50)" }}>Email: </span>
              {user.email}
            </p>
            <p className="mt-1">
              <span style={{ color: "oklch(0.65 0.04 50)" }}>Current role: </span>
              <span style={{ color: isPromote ? "oklch(0.68 0.13 68)" : "oklch(0.45 0.20 27)" }}>
                {user.role}
              </span>
              {" → "}
              <span style={{ color: isPromote ? "oklch(0.35 0.15 22)" : "oklch(0.55 0.04 50)" }}>
                {isPromote ? "ADMIN" : "USER"}
              </span>
            </p>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition disabled:opacity-40 min-h-[44px]"
              style={{
                border: "1px solid oklch(0.84 0.042 80)",
                background: "oklch(0.92 0.030 83 / 40%)",
                color: "oklch(0.45 0.04 50)",
              }}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              id={isPromote ? `confirm-promote-${user.id}` : `confirm-demote-${user.id}`}
              onClick={onConfirm}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg transition disabled:opacity-60 min-h-[44px]"
              style={{
                background: isPromote
                  ? "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))"
                  : "linear-gradient(135deg, oklch(0.45 0.20 27), oklch(0.55 0.18 22))",
                color: "oklch(0.99 0.01 85)",
              }}
            >
              {busy ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full"
                    style={{
                      border: "2px solid oklch(0.99 0.01 85 / 30%)",
                      borderTopColor: "oklch(0.99 0.01 85)",
                    }}
                  />
                  {isPromote ? "Promoting…" : "Revoking…"}
                </>
              ) : (
                <>
                  {isPromote ? (
                    <ShieldPlus className="h-4 w-4" />
                  ) : (
                    <ShieldMinus className="h-4 w-4" />
                  )}
                  {isPromote ? "Yes, Make Admin" : "Yes, Revoke Admin"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reset Password Modal ──────────────────────────────────────────────────
function ResetPasswordModal({
  password,
  onDone,
}: {
  password: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "oklch(0.25 0.05 50 / 55%)", backdropFilter: "blur(6px)" }}
      />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: "oklch(0.998 0.004 85)",
          border: "1px solid oklch(0.84 0.042 80 / 60%)",
        }}
      >
        <div
          className="px-6 py-4"
          style={{
            background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
          }}
        >
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" style={{ color: "oklch(0.99 0.01 85)" }} />
            <h2
              className="font-bold"
              style={{ color: "oklch(0.99 0.01 85)", fontFamily: "var(--font-serif)" }}
            >
              Password Reset
            </h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm font-semibold" style={{ color: "oklch(0.45 0.20 27)" }}>
            This password won't be shown again - copy it now.
          </p>
          <div
            className="mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-mono"
            style={{
              background: "oklch(0.92 0.030 83 / 50%)",
              border: "1px solid oklch(0.84 0.042 80 / 50%)",
              color: "oklch(0.25 0.05 50)",
            }}
          >
            <span className="truncate">{password}</span>
            <button
              onClick={handleCopy}
              className="flex flex-shrink-0 items-center justify-center rounded-lg p-2 transition hover:bg-black/5"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4" style={{ color: "oklch(0.60 0.14 160)" }} />
              ) : (
                <Copy className="h-4 w-4" style={{ color: "oklch(0.55 0.04 50)" }} />
              )}
            </button>
          </div>
          <div className="mt-5 flex">
            <button
              onClick={onDone}
              className="flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg transition active:scale-95 min-h-[44px]"
              style={{
                background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
                color: "oklch(0.99 0.01 85)",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Which user is pending confirmation, and what action
  const [pendingUser, setPendingUser] = useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] = useState<"promote" | "demote">("promote");
  const [actionBusy, setActionBusy] = useState(false);

  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // The ID of the currently logged-in admin so we can hide their action button
  const currentAdminId = (getAdminUser() ?? getUser())?.id ?? null;

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openConfirm(user: AdminUser, action: "promote" | "demote") {
    setPendingUser(user);
    setPendingAction(action);
  }

  async function handleRoleChange() {
    if (!pendingUser) return;
    const newRole = pendingAction === "promote" ? "ADMIN" : "USER";
    setActionBusy(true);
    try {
      const res = await api.adminSetUserRole(pendingUser.id, newRole);
      // Optimistic update: flip role in local state immediately
      setUsers((prev) =>
        prev.map((u) => (u.id === pendingUser.id ? { ...u, role: newRole } : u)),
      );
      toast.success(res.message ?? `${pendingUser.name}'s role updated to ${newRole}.`);
      setPendingUser(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Role update failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResetPassword(user: AdminUser) {
    setResettingUser(user);
    try {
      const res = await api.adminResetPassword(user.id);
      setGeneratedPassword(res.password);
      toast.success(`Password reset for ${user.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResettingUser(null);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.phone.includes(query),
  );

  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const userCount = users.filter((u) => u.role === "USER").length;

  return (
    <>
      {/* Confirm modal */}
      {pendingUser && (
        <ConfirmModal
          user={pendingUser}
          action={pendingAction}
          onConfirm={handleRoleChange}
          onCancel={() => !actionBusy && setPendingUser(null)}
          busy={actionBusy}
        />
      )}

      {/* Reset Password Modal */}
      {generatedPassword && (
        <ResetPasswordModal
          password={generatedPassword}
          onDone={() => setGeneratedPassword(null)}
        />
      )}

      <div className="space-y-4 sm:space-y-6 px-2 sm:px-4 lg:px-8 py-6 sm:py-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 animate-fade-up">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: "oklch(0.25 0.05 50)", fontFamily: "var(--font-serif)" }}
            >
              User Management
            </h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>
              {loading
                ? "Loading…"
                : `${users.length} total · ${adminCount} admin${adminCount !== 1 ? "s" : ""} · ${userCount} customer${userCount !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm transition disabled:opacity-40 min-h-[44px]"
            style={{
              border: "1px solid oklch(0.84 0.042 80)",
              background: "oklch(0.998 0.004 85)",
              color: "oklch(0.45 0.04 50)",
              boxShadow: "0 2px 8px oklch(0.35 0.15 22 / 4%)",
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary chips */}
        {!loading && (
          <div className="flex flex-wrap gap-3 animate-fade-up delay-100">
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
              style={{
                border: "1px solid oklch(0.84 0.042 80 / 70%)",
                background: "oklch(0.998 0.004 85)",
              }}
            >
              <Users className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.04 50)" }} />
              <span style={{ color: "oklch(0.55 0.04 50)" }}>
                <span className="font-semibold" style={{ color: "oklch(0.25 0.05 50)" }}>{users.length}</span> registered
              </span>
            </div>
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
              style={{
                border: "1px solid oklch(0.35 0.15 22 / 20%)",
                background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 6%), oklch(0.68 0.13 68 / 4%))",
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "oklch(0.68 0.13 68)" }} />
              <span style={{ color: "oklch(0.45 0.08 40)" }}>
                <span className="font-semibold">{adminCount}</span> admin
                {adminCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
              style={{
                border: "1px solid oklch(0.84 0.042 80 / 70%)",
                background: "oklch(0.998 0.004 85)",
              }}
            >
              <User className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.04 50)" }} />
              <span style={{ color: "oklch(0.55 0.04 50)" }}>
                <span className="font-semibold" style={{ color: "oklch(0.25 0.05 50)" }}>{userCount}</span> customer
                {userCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative animate-fade-up delay-200">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "oklch(0.65 0.04 50)" }} />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition"
            style={{
              background: "oklch(0.998 0.004 85)",
              border: "1px solid oklch(0.84 0.042 80)",
              color: "oklch(0.25 0.05 50)",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "oklch(0.68 0.13 68)";
              (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px oklch(0.68 0.13 68 / 12%)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "oklch(0.84 0.042 80)";
              (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{
              background: "oklch(0.577 0.245 27.325 / 8%)",
              border: "1px solid oklch(0.577 0.245 27.325 / 20%)",
              color: "oklch(0.45 0.18 27)",
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div
            className="overflow-hidden rounded-2xl animate-fade-up delay-300"
            style={{
              background: "oklch(0.998 0.004 85)",
              border: "1px solid oklch(0.84 0.042 80 / 60%)",
              boxShadow: "0 4px 24px oklch(0.35 0.15 22 / 6%)",
            }}
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16" style={{ color: "oklch(0.70 0.04 50)" }}>
                <Users className="h-10 w-10" style={{ color: "oklch(0.80 0.030 83)" }} />
                <p className="text-sm">
                  {query ? "No users match your search." : "No users yet."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="sm:hidden divide-y" style={{ borderColor: "oklch(0.93 0.020 83)" }}>
                  {filtered.map((u) => {
                    const isSelf = u.id === currentAdminId;
                    return (
                      <div key={u.id} className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                            style={{
                              background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
                              color: "oklch(0.99 0.01 85)",
                            }}
                          >
                            {u.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: "oklch(0.25 0.05 50)" }}>
                              {u.name}
                              {isSelf && (
                                <span className="ml-2 text-[10px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: "oklch(0.68 0.13 68 / 15%)", color: "oklch(0.55 0.10 65)" }}>You</span>
                              )}
                            </p>
                            <p className="text-xs truncate" style={{ color: "oklch(0.55 0.04 50)" }}>{u.email}</p>
                            <p className="text-xs" style={{ color: "oklch(0.65 0.04 50)" }}>{u.phone}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: "oklch(0.60 0.04 50)" }}>
                              Joined: {new Date(u.created_at.includes("Z") || u.created_at.includes("+") ? u.created_at : u.created_at + " UTC").toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
                            </p>
                          </div>
                          {u.role === "ADMIN" ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0" style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 8%), oklch(0.68 0.13 68 / 6%))", color: "oklch(0.35 0.15 22)", border: "1px solid oklch(0.35 0.15 22 / 20%)" }}>
                              <ShieldCheck className="h-3 w-3" style={{ color: "oklch(0.68 0.13 68)" }} />
                              ADMIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0" style={{ background: "oklch(0.92 0.030 83 / 60%)", color: "oklch(0.55 0.04 50)", border: "1px solid oklch(0.84 0.042 80 / 60%)" }}>
                              <User className="h-3 w-3" />
                              USER
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleResetPassword(u)}
                            disabled={!!resettingUser}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 min-h-[44px]"
                            style={{ background: "oklch(0.92 0.030 83 / 60%)", color: "oklch(0.45 0.04 50)", border: "1px solid oklch(0.84 0.042 80 / 60%)" }}
                          >
                            {resettingUser?.id === u.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black/80" /> : <Key className="h-3.5 w-3.5" />}
                            Reset Password
                          </button>
                          {!isSelf && (
                            u.role === "ADMIN" ? (
                              <button
                                id={`revoke-admin-btn-${u.id}`}
                                onClick={() => openConfirm(u, "demote")}
                                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 min-h-[44px]"
                                style={{ background: "oklch(0.577 0.245 27.325 / 8%)", color: "oklch(0.45 0.20 27)", border: "1px solid oklch(0.577 0.245 27.325 / 25%)" }}
                              >
                                <ShieldMinus className="h-3.5 w-3.5" />
                                Revoke Admin
                              </button>
                            ) : (
                              <button
                                id={`promote-btn-${u.id}`}
                                onClick={() => openConfirm(u, "promote")}
                                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 min-h-[44px]"
                                style={{ background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 6%), oklch(0.68 0.13 68 / 4%))", color: "oklch(0.35 0.15 22)", border: "1px solid oklch(0.35 0.15 22 / 20%)" }}
                              >
                                <ShieldPlus className="h-3.5 w-3.5" />
                                Make Admin
                              </button>
                            )
                          )}
                          {isSelf && (
                            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.68 0.13 68)" }}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              That&apos;s you
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid oklch(0.90 0.030 83)" }}>
                        {["User", "Phone", "Role", "Joined", "Action"].map((h) => (
                          <th
                            key={h}
                            className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest"
                            style={{ color: "oklch(0.65 0.04 50)" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => {
                        const isSelf = u.id === currentAdminId;
                        return (
                          <tr
                            key={u.id}
                            className="group transition-colors"
                            style={{ borderBottom: "1px solid oklch(0.93 0.020 83)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLTableRowElement).style.background = "oklch(0.96 0.018 83 / 50%)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                            }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-md"
                                  style={{
                                    background: "linear-gradient(135deg, oklch(0.35 0.15 22), oklch(0.45 0.13 25))",
                                    color: "oklch(0.99 0.01 85)",
                                  }}
                                >
                                  {u.name[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium" style={{ color: "oklch(0.25 0.05 50)" }}>
                                    {u.name}
                                    {isSelf && (
                                      <span
                                        className="ml-2 text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                                        style={{
                                          background: "oklch(0.68 0.13 68 / 15%)",
                                          color: "oklch(0.55 0.10 65)",
                                        }}
                                      >
                                        You
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs" style={{ color: "oklch(0.55 0.04 50)" }}>{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4" style={{ color: "oklch(0.45 0.04 50)" }}>{u.phone}</td>
                            <td className="px-6 py-4">
                              {u.role === "ADMIN" ? (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                                  style={{
                                    background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 8%), oklch(0.68 0.13 68 / 6%))",
                                    color: "oklch(0.35 0.15 22)",
                                    border: "1px solid oklch(0.35 0.15 22 / 20%)",
                                  }}
                                >
                                  <ShieldCheck className="h-3 w-3" style={{ color: "oklch(0.68 0.13 68)" }} />
                                  ADMIN
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                                  style={{
                                    background: "oklch(0.92 0.030 83 / 60%)",
                                    color: "oklch(0.55 0.04 50)",
                                    border: "1px solid oklch(0.84 0.042 80 / 60%)",
                                  }}
                                >
                                  <User className="h-3 w-3" />
                                  USER
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4" style={{ color: "oklch(0.55 0.04 50)" }}>
                              {new Date(u.created_at.includes("Z") || u.created_at.includes("+") ? u.created_at : u.created_at + " UTC").toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                                timeZone: "Asia/Kolkata",
                              })}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResetPassword(u)}
                                  disabled={!!resettingUser}
                                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 min-h-[44px]"
                                  style={{
                                    background: "oklch(0.92 0.030 83 / 60%)",
                                    color: "oklch(0.45 0.04 50)",
                                    border: "1px solid oklch(0.84 0.042 80 / 60%)",
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.90 0.030 83 / 80%)"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.92 0.030 83 / 60%)"; }}
                                >
                                  {resettingUser?.id === u.id ? (
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black/80" />
                                  ) : (
                                    <Key className="h-3.5 w-3.5" />
                                  )}
                                  Reset Password
                                </button>
                                {isSelf ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.68 0.13 68)" }}>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    That&apos;s you
                                  </span>
                                ) : u.role === "ADMIN" ? (
                                  <button
                                    id={`revoke-admin-btn-${u.id}`}
                                    onClick={() => openConfirm(u, "demote")}
                                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 min-h-[44px]"
                                    style={{
                                      background: "oklch(0.577 0.245 27.325 / 8%)",
                                      color: "oklch(0.45 0.20 27)",
                                      border: "1px solid oklch(0.577 0.245 27.325 / 25%)",
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.577 0.245 27.325 / 16%)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.577 0.245 27.325 / 8%)"; }}
                                  >
                                    <ShieldMinus className="h-3.5 w-3.5" />
                                    Revoke Admin
                                  </button>
                                ) : (
                                  <button
                                    id={`promote-btn-${u.id}`}
                                    onClick={() => openConfirm(u, "promote")}
                                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 min-h-[44px]"
                                    style={{
                                      background: "linear-gradient(135deg, oklch(0.35 0.15 22 / 6%), oklch(0.68 0.13 68 / 4%))",
                                      color: "oklch(0.35 0.15 22)",
                                      border: "1px solid oklch(0.35 0.15 22 / 20%)",
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, oklch(0.35 0.15 22 / 12%), oklch(0.68 0.13 68 / 8%))"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, oklch(0.35 0.15 22 / 6%), oklch(0.68 0.13 68 / 4%))"; }}
                                  >
                                    <ShieldPlus className="h-3.5 w-3.5" />
                                    Make Admin
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: "oklch(0.998 0.004 85)", border: "1px solid oklch(0.84 0.042 80 / 60%)" }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-6 py-4"
                style={{ borderBottom: "1px solid oklch(0.90 0.030 83)" }}
              >
                <div className="h-9 w-9 animate-pulse rounded-full" style={{ background: "oklch(0.90 0.030 83)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-36 animate-pulse rounded" style={{ background: "oklch(0.90 0.030 83)" }} />
                  <div className="h-2 w-52 animate-pulse rounded" style={{ background: "oklch(0.93 0.020 83)" }} />
                </div>
                <div className="h-3 w-20 animate-pulse rounded" style={{ background: "oklch(0.90 0.030 83)" }} />
                <div className="h-5 w-16 animate-pulse rounded-full" style={{ background: "oklch(0.90 0.030 83)" }} />
                <div className="h-7 w-24 animate-pulse rounded-lg" style={{ background: "oklch(0.90 0.030 83)" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
