import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, clearSession, getUser, setSession, getToken, getAdminToken } from "@/lib/api";
import {
  User, Phone, Lock, Eye, EyeOff, CheckCircle2, XCircle,
  Loader2, ShieldCheck, Save, AlertTriangle, Trash2, Settings as SettingsIcon,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings - Hemangi Glam Salon" },
      { name: "description", content: "Manage your account settings, profile and security." },
    ],
  }),
  component: SettingsPage,
});

// ── Design tokens ─────────────────────────────────────────────────────────────
const BURGUNDY     = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD         = "oklch(0.68 0.13 68)";
const GOLD_LIGHT   = "oklch(0.80 0.10 72)";
const ERROR_COLOR  = "oklch(0.55 0.22 27)";
const SUCCESS_COLOR = "oklch(0.42 0.18 150)";
const BG           = "oklch(0.968 0.018 85)";
const CARD_BG      = "oklch(0.998 0.004 85)";
const BORDER       = "oklch(0.88 0.030 82)";

const STRONG_PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,72}$/;
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

// ── Section enum ──────────────────────────────────────────────────────────────
type Section = "profile" | "password" | "danger";

function SettingsPage() {
  const navigate = useNavigate();
  const sessionUser = getUser();

  useEffect(() => {
    if (!sessionUser) navigate({ to: "/login" });
  }, []);

  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Profile state
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole]   = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Info save state
  const [savingInfo, setSavingInfo]   = useState(false);
  const [infoSuccess, setInfoSuccess] = useState(false);
  const [infoError, setInfoError]     = useState<string | null>(null);

  // Password state
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPw, setSavingPw]     = useState(false);
  const [pwSuccess, setPwSuccess]   = useState(false);
  const [pwError, setPwError]       = useState<string | null>(null);

  // Field errors (shared)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePw, setDeletePw]           = useState("");
  const [showDeletePw, setShowDeletePw]   = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState<string | null>(null);

  // Load profile
  useEffect(() => {
    api.getProfile()
      .then((p) => { setName(p.name); setPhone(p.phone); setEmail(p.email); setRole(p.role); })
      .catch(() => {
        const u = getUser();
        if (u) { setName(u.name); setEmail(u.email); setRole(u.role); }
      })
      .finally(() => setLoadingProfile(false));
  }, []);

  // ── Save profile ────────────────────────────────────────────────────────────
  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoError(null); setInfoSuccess(false); setFieldErrors({});
    const fe: Record<string, string> = {};
    const trimName = name.trim();
    const trimPhone = phone.trim().replace(/\D/g, "");
    if (trimName.split(" ").length < 2) fe.name = "Please enter your first and last name";
    if (!INDIAN_PHONE_RE.test(trimPhone)) fe.phone = "Enter a valid 10-digit Indian mobile number";
    if (Object.keys(fe).length) { setFieldErrors(fe); return; }
    setSavingInfo(true);
    try {
      const res = await api.updateProfile({ name: trimName, phone: trimPhone });
      const stored = getUser();
      const token = getAdminToken() ?? getToken() ?? "";
      if (stored) setSession(token, { ...stored, name: res.user.name }, localStorage.getItem("salon_remember") === "1");
      window.dispatchEvent(new Event("salon-auth-change"));
      setName(res.profile.name); setPhone(res.profile.phone);
      setInfoSuccess(true); setTimeout(() => setInfoSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      try { const p = JSON.parse(msg); if (p.errors) { setFieldErrors(p.errors); return; } } catch { /**/ }
      setInfoError(msg);
    } finally { setSavingInfo(false); }
  }

  // ── Change password ─────────────────────────────────────────────────────────
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null); setPwSuccess(false); setFieldErrors({});
    const fe: Record<string, string> = {};
    if (!currentPw) fe.current_password = "Enter your current password";
    if (!newPw) fe.new_password = "Enter a new password";
    else if (!STRONG_PW_RE.test(newPw)) fe.new_password = "Min 8 chars — uppercase, lowercase, number & special character";
    if (newPw && newPw !== confirmPw) fe.confirm_password = "Passwords do not match";
    if (Object.keys(fe).length) { setFieldErrors(fe); return; }
    setSavingPw(true);
    try {
      await api.updateProfile({ current_password: currentPw, new_password: newPw });
      setPwSuccess(true); setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Password change failed";
      try { const p = JSON.parse(msg); if (p.errors) { setFieldErrors(p.errors); return; } } catch { /**/ }
      setPwError(msg);
    } finally { setSavingPw(false); }
  }

  // ── Delete account ──────────────────────────────────────────────────────────
  async function doDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (deleteConfirm !== "DELETE") { setDeleteError('Type "DELETE" to confirm'); return; }
    if (!deletePw) { setDeleteError("Enter your password to confirm"); return; }
    setDeleting(true);
    try {
      await api.deleteAccount(deletePw);
      clearSession();
      window.dispatchEvent(new Event("salon-auth-change"));
      navigate({ to: "/" });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed");
    } finally { setDeleting(false); }
  }

  if (!sessionUser) return null;

  const tabs: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "profile",  label: "Edit Profile",     icon: <User className="h-4 w-4" /> },
    { id: "password", label: "Change Password",  icon: <Lock className="h-4 w-4" /> },
    { id: "danger",   label: "Danger Zone",       icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: BG }}>
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4 animate-fade-up">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-md"
            style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}>
            <SettingsIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>
              Account Settings
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>{email}</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: role === "ADMIN" ? "oklch(0.35 0.15 22 / 8%)" : "oklch(0.92 0.030 83 / 60%)",
                  color: role === "ADMIN" ? BURGUNDY : "oklch(0.55 0.04 50)",
                  border: `1px solid ${role === "ADMIN" ? "oklch(0.35 0.15 22 / 18%)" : "oklch(0.84 0.042 80 / 60%)"}`,
                }}>
                {role === "ADMIN" && <ShieldCheck className="h-2.5 w-2.5" style={{ color: GOLD }} />}
                {role || "USER"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[200px_1fr] animate-fade-up">
          {/* Sidebar nav */}
          <div className="flex flex-row gap-1 md:flex-col">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveSection(t.id)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 text-left"
                style={{
                  background: activeSection === t.id
                    ? t.id === "danger" ? "oklch(0.577 0.245 27.325 / 8%)" : `linear-gradient(135deg, ${BURGUNDY}/8%, ${GOLD}/5%)`
                    : "transparent",
                  color: activeSection === t.id
                    ? t.id === "danger" ? ERROR_COLOR : BURGUNDY
                    : "oklch(0.50 0.04 50)",
                  border: `1px solid ${activeSection === t.id
                    ? t.id === "danger" ? "oklch(0.577 0.245 27.325 / 20%)" : "oklch(0.35 0.15 22 / 15%)"
                    : "transparent"}`,
                }}
              >
                {t.icon}
                <span className="hidden md:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Main panel */}
          <div className="min-w-0">

            {/* ── Edit Profile ── */}
            {activeSection === "profile" && (
              <Card gradient={`linear-gradient(90deg, ${BURGUNDY}, ${GOLD})`}>
                <h2 className="mb-5 text-base font-semibold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>Edit Profile</h2>
                {loadingProfile ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" style={{ color: BURGUNDY }} /></div>
                ) : (
                  <form onSubmit={saveInfo} className="space-y-4">
                    {infoSuccess && <Banner type="success" msg="Profile updated successfully!" />}
                    {infoError && <Banner type="error" msg={infoError} />}

                    {/* Email (read-only) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.60 0.04 55)" }}>Email Address</label>
                      <div className="flex items-center justify-between rounded-xl px-3 py-3" style={{ background: "oklch(0.93 0.020 83 / 40%)", border: `1px solid ${BORDER}` }}>
                        <span className="text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>{email}</span>
                        <span className="text-xs" style={{ color: "oklch(0.70 0.04 50)" }}>Cannot change</span>
                      </div>
                    </div>

                    <InputField label="Full Name" icon={<User className="h-4 w-4" />} error={fieldErrors.name}
                      value={name} onChange={(v) => { setName(v); setFieldErrors((p) => ({ ...p, name: "" })); }}
                      placeholder="Your full name" />
                    <InputField label="Phone Number" icon={<Phone className="h-4 w-4" />} error={fieldErrors.phone}
                      value={phone} onChange={(v) => { setPhone(v); setFieldErrors((p) => ({ ...p, phone: "" })); }}
                      placeholder="10-digit mobile number" type="tel" />

                    <button type="submit" disabled={savingInfo}
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-70"
                      style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`, color: "oklch(0.99 0.01 85)" }}>
                      {savingInfo ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Changes</>}
                    </button>
                  </form>
                )}
              </Card>
            )}

            {/* ── Change Password ── */}
            {activeSection === "password" && (
              <Card gradient={`linear-gradient(90deg, ${GOLD}, ${BURGUNDY})`}>
                <h2 className="mb-5 text-base font-semibold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>Change Password</h2>
                <form onSubmit={changePassword} className="space-y-4">
                  {pwSuccess && <Banner type="success" msg="Password changed successfully!" />}
                  {pwError && <Banner type="error" msg={pwError} />}

                  <PwField id="cur-pw" label="Current Password" value={currentPw} onChange={setCurrentPw}
                    show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} error={fieldErrors.current_password}
                    onClear={() => setFieldErrors((p) => ({ ...p, current_password: "" }))} />
                  <PwField id="new-pw" label="New Password" value={newPw} onChange={setNewPw}
                    show={showNew} onToggle={() => setShowNew((v) => !v)} error={fieldErrors.new_password}
                    onClear={() => setFieldErrors((p) => ({ ...p, new_password: "" }))}
                    hint="Min 8 chars — uppercase, lowercase, number & special character" />
                  <PwField id="conf-pw" label="Confirm New Password" value={confirmPw} onChange={setConfirmPw}
                    show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} error={fieldErrors.confirm_password}
                    onClear={() => setFieldErrors((p) => ({ ...p, confirm_password: "" }))} />

                  <button type="submit" disabled={savingPw}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-70"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: "white" }}>
                    {savingPw ? <><Loader2 className="h-4 w-4 animate-spin" />Updating…</> : <><Lock className="h-4 w-4" />Update Password</>}
                  </button>
                </form>
              </Card>
            )}

            {/* ── Danger Zone ── */}
            {activeSection === "danger" && (
              <div className="overflow-hidden rounded-3xl shadow-xl"
                style={{ background: CARD_BG, border: "1.5px solid oklch(0.577 0.245 27.325 / 30%)", boxShadow: "0 8px 40px oklch(0.577 0.245 27.325 / 10%)" }}>
                <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, oklch(0.577 0.245 27.325), oklch(0.65 0.20 28))" }} />
                <div className="p-8 space-y-5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" style={{ color: ERROR_COLOR }} />
                    <h2 className="text-base font-semibold" style={{ color: ERROR_COLOR, fontFamily: "var(--font-serif)" }}>Delete Account</h2>
                  </div>

                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.45 0.04 50)" }}>
                    This action <strong>cannot be undone</strong>. Your account, all personal data, and any
                    upcoming bookings will be permanently deleted. Upcoming confirmed bookings will be
                    automatically cancelled.
                  </p>

                  {deleteError && <Banner type="error" msg={deleteError} />}

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: ERROR_COLOR }}>
                        Type "DELETE" to confirm
                      </label>
                      <input
                        type="text"
                        name="delete_confirmation_field"
                        autoComplete="off"
                        data-form-type="other"
                        value={deleteConfirm}
                        onChange={(e) => {
                          if (e.target.value.includes("@")) return;
                          setDeleteConfirm(e.target.value);
                        }}
                        placeholder="DELETE"
                        className="w-full rounded-xl px-3 py-3 text-sm outline-none transition-all duration-150"
                        style={{
                          background: CARD_BG,
                          border: `1px solid ${deleteConfirm === "DELETE" || deleteConfirm === "delete" ? "oklch(0.577 0.245 27.325)" : BORDER}`,
                          color: "oklch(0.25 0.05 50)",
                        }}
                      />
                    </div>

                    <PwField id="del-pw" label="Confirm with your password" value={deletePw} onChange={setDeletePw}
                      show={showDeletePw} onToggle={() => setShowDeletePw((v) => !v)}
                      onClear={() => setDeleteError(null)} danger />

                    <button
                      type="button"
                      onClick={doDelete}
                      disabled={deleting || (deleteConfirm !== "DELETE" && deleteConfirm !== "delete") || !deletePw}
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, oklch(0.577 0.245 27.325), oklch(0.65 0.20 28))", color: "white" }}
                    >
                      {deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</> : <><Trash2 className="h-4 w-4" />Delete My Account</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Card({ children, gradient }: { children: React.ReactNode; gradient: string }) {
  return (
    <div className="overflow-hidden rounded-3xl shadow-xl"
      style={{ background: CARD_BG, border: `1px solid ${BORDER}`, boxShadow: "0 8px 40px oklch(0.35 0.15 22 / 10%)" }}>
      <div className="h-1.5 w-full" style={{ background: gradient }} />
      <div className="p-8">{children}</div>
    </div>
  );
}

function Banner({ type, msg }: { type: "success" | "error"; msg: string }) {
  const isSuccess = type === "success";
  return (
    <div className="flex items-center gap-2 rounded-xl p-3 text-sm"
      style={{
        background: isSuccess ? "oklch(0.42 0.18 150 / 8%)" : "oklch(0.577 0.245 27.325 / 8%)",
        border: `1px solid ${isSuccess ? "oklch(0.42 0.18 150 / 25%)" : "oklch(0.577 0.245 27.325 / 25%)"}`,
        color: isSuccess ? SUCCESS_COLOR : ERROR_COLOR,
      }}>
      {isSuccess ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

function InputField({ label, icon, error, value, onChange, placeholder, type = "text" }: {
  label: string; icon: React.ReactNode; error?: string;
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-widest"
        style={{ color: hasError ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}>{label}</label>
      <div className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-150"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          background: CARD_BG,
          border: `1px solid ${hasError ? "oklch(0.577 0.245 27.325)" : focused ? GOLD : BORDER}`,
          boxShadow: focused ? `0 0 0 3px ${hasError ? "oklch(0.577 0.245 27.325 / 12%)" : "oklch(0.68 0.13 68 / 14%)"}` : "none",
        }}>
        <span className="flex-shrink-0" style={{ color: hasError ? ERROR_COLOR : focused ? GOLD : "oklch(0.62 0.04 55)" }}>{icon}</span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="flex-1 bg-transparent pl-2 text-sm outline-none"
          style={{ color: "oklch(0.25 0.05 50)" }} />
        {hasError && <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: ERROR_COLOR }} />}
      </div>
      {hasError && <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}><XCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

function PwField({ id, label, value, onChange, show, onToggle, error, onClear, hint, danger }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; error?: string; onClear: () => void; hint?: string; danger?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const accentColor = danger ? "oklch(0.577 0.245 27.325)" : GOLD;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-widest"
        style={{ color: hasError ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}>{label}</label>
      <div className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-150"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          background: CARD_BG,
          border: `1px solid ${hasError ? "oklch(0.577 0.245 27.325)" : focused ? accentColor : BORDER}`,
          boxShadow: focused ? `0 0 0 3px ${hasError ? "oklch(0.577 0.245 27.325 / 12%)" : `${accentColor}22`}` : "none",
        }}>
        <Lock className="h-4 w-4 flex-shrink-0" style={{ color: hasError ? ERROR_COLOR : focused ? accentColor : "oklch(0.62 0.04 55)" }} />
        <input id={id} type={show ? "text" : "password"} value={value}
          onChange={(e) => { onChange(e.target.value); onClear(); }}
          placeholder="••••••••" className="flex-1 bg-transparent pl-2 text-sm outline-none"
          style={{ color: "oklch(0.25 0.05 50)" }} />
        <button type="button" onClick={onToggle} tabIndex={-1} aria-label={show ? "Hide" : "Show"}
          className="flex-shrink-0 p-1 transition-opacity hover:opacity-70"
          style={{ color: "oklch(0.60 0.04 50)" }}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hasError && <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}><XCircle className="h-3 w-3" />{error}</p>}
      {!hasError && hint && <p className="text-xs" style={{ color: "oklch(0.68 0.04 55)" }}>{hint}</p>}
    </div>
  );
}

