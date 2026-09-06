import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, setSession } from "@/lib/api";
import { User, Phone, Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ShieldCheck, Save } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile - Hemangi Glam Salon" },
      { name: "description", content: "Update your name, phone number or password." },
    ],
  }),
  component: ProfilePage,
});

// ─── Design tokens ────────────────────────────────────────────────────────────
const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const ERROR_COLOR = "oklch(0.55 0.22 27)";
const SUCCESS_COLOR = "oklch(0.42 0.18 150)";
const BG = "oklch(0.968 0.018 85)";

const STRONG_PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,72}$/;

function ProfilePage() {
  const navigate = useNavigate();
  const sessionUser = getUser();

  // Redirect if not logged in
  useEffect(() => {
    if (!sessionUser) navigate({ to: "/login" });
  }, []);

  // Profile state
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole]   = useState("");

  // Password change state
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // UI state
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingInfo, setSavingInfo]         = useState(false);
  const [savingPw, setSavingPw]             = useState(false);
  const [infoSuccess, setInfoSuccess]       = useState(false);
  const [pwSuccess, setPwSuccess]           = useState(false);
  const [infoError, setInfoError]           = useState<string | null>(null);
  const [pwError, setPwError]               = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]       = useState<Record<string, string>>({});

  // Load profile on mount
  useEffect(() => {
    api.getProfile()
      .then((p) => {
        setName(p.name);
        setPhone(p.phone);
        setEmail(p.email);
        setRole(p.role);
      })
      .catch(() => {/* silent - use session data */})
      .finally(() => setLoadingProfile(false));
  }, []);

  // ── Save info (name + phone) ──────────────────────────────────────────────
  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    setInfoError(null);
    setInfoSuccess(false);
    setFieldErrors({});
    try {
      const res = await api.updateProfile({ name: name.trim(), phone: phone.trim() });
      // Update the stored session name so navbar refreshes
      const stored = getUser();
      if (stored) setSession(
        window.localStorage.getItem("salon_token") ?? "",
        { ...stored, name: res.user.name },
        window.localStorage.getItem("salon_remember") === "1",
      );
      setName(res.profile.name);
      setPhone(res.profile.phone);
      setInfoSuccess(true);
      setTimeout(() => setInfoSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      try {
        const parsed = JSON.parse(msg);
        if (parsed.errors) { setFieldErrors(parsed.errors); return; }
      } catch { /* plain message */ }
      setInfoError(msg);
    } finally {
      setSavingInfo(false);
    }
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    setFieldErrors({});

    if (!currentPw) { setFieldErrors({ current_password: "Enter your current password" }); return; }
    if (!newPw)     { setFieldErrors({ new_password: "Enter a new password" }); return; }
    if (!STRONG_PW_RE.test(newPw)) {
      setFieldErrors({ new_password: "Must contain uppercase, lowercase, number & special character (8+ chars)" });
      return;
    }
    if (newPw !== confirmPw) { setFieldErrors({ confirm_password: "Passwords do not match" }); return; }

    setSavingPw(true);
    try {
      await api.updateProfile({ current_password: currentPw, new_password: newPw });
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Password change failed";
      try {
        const parsed = JSON.parse(msg);
        if (parsed.errors) { setFieldErrors(parsed.errors); return; }
      } catch { /* plain message */ }
      setPwError(msg);
    } finally {
      setSavingPw(false);
    }
  }

  if (!sessionUser) return null;

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: BG }}>
      <div className="mx-auto max-w-lg space-y-6">

        {/* Header */}
        <div className="animate-fade-up">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
          >
            <User className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-center text-3xl font-bold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>
            My Profile
          </h1>
          <p className="mt-1 text-center text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>
            Update your personal information
          </p>
          {/* Role badge */}
          <div className="mt-3 flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: role === "ADMIN"
                  ? "linear-gradient(135deg, oklch(0.35 0.15 22 / 10%), oklch(0.68 0.13 68 / 8%))"
                  : "oklch(0.92 0.030 83 / 60%)",
                color: role === "ADMIN" ? BURGUNDY : "oklch(0.55 0.04 50)",
                border: `1px solid ${role === "ADMIN" ? "oklch(0.35 0.15 22 / 20%)" : "oklch(0.84 0.042 80 / 60%)"}`,
              }}
            >
              {role === "ADMIN" && <ShieldCheck className="h-3 w-3" style={{ color: GOLD }} />}
              {role || "USER"}
            </span>
          </div>
        </div>

        {loadingProfile ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: BURGUNDY }} />
          </div>
        ) : (
          <>
            {/* ── Card 1: Info ─────────────────────────────────────────────── */}
            <div
              className="overflow-hidden rounded-3xl shadow-xl animate-fade-up"
              style={{
                background: "oklch(0.998 0.004 85)",
                border: "1px solid oklch(0.88 0.030 82)",
                boxShadow: "0 8px 48px oklch(0.35 0.15 22 / 10%)",
              }}
            >
              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${BURGUNDY}, ${GOLD})` }} />
              <form onSubmit={saveInfo} className="space-y-4 p-8">
                <h2 className="text-lg font-semibold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>
                  Personal Information
                </h2>

                {/* Success / Error banners */}
                {infoSuccess && (
                  <div className="flex items-center gap-2 rounded-xl p-3 text-sm" style={{ background: "oklch(0.42 0.18 150 / 8%)", border: "1px solid oklch(0.42 0.18 150 / 25%)", color: SUCCESS_COLOR }}>
                    <CheckCircle2 className="h-4 w-4" /> Profile updated successfully!
                  </div>
                )}
                {infoError && (
                  <div className="flex items-center gap-2 rounded-xl p-3 text-sm" style={{ background: "oklch(0.577 0.245 27.325 / 8%)", border: "1px solid oklch(0.577 0.245 27.325 / 25%)", color: ERROR_COLOR }}>
                    <XCircle className="h-4 w-4" /> {infoError}
                  </div>
                )}

                {/* Email (read-only) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.06 48)" }}>
                    Email Address
                  </label>
                  <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: "oklch(0.93 0.020 83 / 40%)", border: "1px solid oklch(0.88 0.030 82)" }}>
                    <span className="text-sm" style={{ color: "oklch(0.65 0.04 50)" }}>{email}</span>
                    <span className="ml-auto text-xs" style={{ color: "oklch(0.70 0.04 50)" }}>Cannot change</span>
                  </div>
                </div>

                {/* Name */}
                <Field label="Full Name" icon={<User className="h-4 w-4" />} error={fieldErrors.name}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: "" })); }}
                    placeholder="Your full name"
                    className="w-full bg-transparent py-0 pl-10 pr-4 text-sm outline-none"
                    style={{ color: "oklch(0.25 0.05 50)" }}
                  />
                </Field>

                {/* Phone */}
                <Field label="Phone Number" icon={<Phone className="h-4 w-4" />} error={fieldErrors.phone}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setFieldErrors((p) => ({ ...p, phone: "" })); }}
                    placeholder="10-digit mobile number"
                    className="w-full bg-transparent py-0 pl-10 pr-4 text-sm outline-none"
                    style={{ color: "oklch(0.25 0.05 50)" }}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={savingInfo}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-70"
                  style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`, color: "oklch(0.99 0.01 85)" }}
                >
                  {savingInfo ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Changes</>}
                </button>
              </form>
            </div>

            {/* ── Card 2: Password ─────────────────────────────────────────── */}
            <div
              className="overflow-hidden rounded-3xl shadow-xl animate-fade-up"
              style={{
                background: "oklch(0.998 0.004 85)",
                border: "1px solid oklch(0.88 0.030 82)",
                boxShadow: "0 8px 48px oklch(0.35 0.15 22 / 10%)",
              }}
            >
              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${GOLD}, ${BURGUNDY})` }} />
              <form onSubmit={changePassword} className="space-y-4 p-8">
                <h2 className="text-lg font-semibold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>
                  Change Password
                </h2>

                {pwSuccess && (
                  <div className="flex items-center gap-2 rounded-xl p-3 text-sm" style={{ background: "oklch(0.42 0.18 150 / 8%)", border: "1px solid oklch(0.42 0.18 150 / 25%)", color: SUCCESS_COLOR }}>
                    <CheckCircle2 className="h-4 w-4" /> Password changed successfully!
                  </div>
                )}
                {pwError && (
                  <div className="flex items-center gap-2 rounded-xl p-3 text-sm" style={{ background: "oklch(0.577 0.245 27.325 / 8%)", border: "1px solid oklch(0.577 0.245 27.325 / 25%)", color: ERROR_COLOR }}>
                    <XCircle className="h-4 w-4" /> {pwError}
                  </div>
                )}

                <PasswordField label="Current Password" value={currentPw} onChange={setCurrentPw} show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} error={fieldErrors.current_password} id="current-pw" onClearError={() => setFieldErrors((p) => ({ ...p, current_password: "" }))} />
                <PasswordField label="New Password" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew((v) => !v)} error={fieldErrors.new_password} id="new-pw" onClearError={() => setFieldErrors((p) => ({ ...p, new_password: "" }))} hint="8+ chars, uppercase, lowercase, number & special character" />
                <PasswordField label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} error={fieldErrors.confirm_password} id="confirm-pw" onClearError={() => setFieldErrors((p) => ({ ...p, confirm_password: "" }))} />

                <button
                  type="submit"
                  disabled={savingPw}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-70"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, oklch(0.72 0.14 65))`, color: "white" }}
                >
                  {savingPw ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : <><Lock className="h-4 w-4" /> Update Password</>}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reusable field wrapper ────────────────────────────────────────────────────
function Field({ label, icon, error, children }: { label: string; icon: React.ReactNode; error?: string; children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const BURGUNDY = "oklch(0.35 0.15 22)";
  const GOLD = "oklch(0.68 0.13 68)";
  const ERROR_COLOR = "oklch(0.55 0.22 27)";
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: hasError ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}>{label}</label>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-150"
        style={{ background: "oklch(0.998 0.004 85)", border: `1px solid ${hasError ? "oklch(0.577 0.245 27.325)" : focused ? GOLD : "oklch(0.88 0.030 82)"}`, boxShadow: focused ? `0 0 0 3px ${hasError ? "oklch(0.577 0.245 27.325 / 12%)" : "oklch(0.68 0.13 68 / 14%)"}` : "none" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <span className="flex-shrink-0" style={{ color: hasError ? ERROR_COLOR : focused ? GOLD : "oklch(0.62 0.04 55)" }}>{icon}</span>
        <div className="flex flex-1 items-center">{children}</div>
        {hasError && <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: ERROR_COLOR }} />}
      </div>
      {hasError && <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}><XCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, error, id, onClearError, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; error?: string;
  id: string; onClearError: () => void; hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const GOLD = "oklch(0.68 0.13 68)";
  const ERROR_COLOR = "oklch(0.55 0.22 27)";
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-widest" style={{ color: hasError ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}>{label}</label>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-150"
        style={{ background: "oklch(0.998 0.004 85)", border: `1px solid ${hasError ? "oklch(0.577 0.245 27.325)" : focused ? GOLD : "oklch(0.88 0.030 82)"}`, boxShadow: focused ? `0 0 0 3px ${hasError ? "oklch(0.577 0.245 27.325 / 12%)" : "oklch(0.68 0.13 68 / 14%)"}` : "none" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <span className="flex-shrink-0" style={{ color: hasError ? ERROR_COLOR : focused ? GOLD : "oklch(0.62 0.04 55)" }}><Lock className="h-4 w-4" /></span>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => { onChange(e.target.value); onClearError(); }}
          placeholder="••••••••"
          className="flex-1 bg-transparent py-0 text-sm outline-none"
          style={{ color: "oklch(0.25 0.05 50)" }}
        />
        <button type="button" onClick={onToggle} className="flex-shrink-0 p-1 transition-opacity hover:opacity-70" style={{ color: "oklch(0.60 0.04 50)" }} tabIndex={-1} aria-label={show ? "Hide" : "Show"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hasError && <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}><XCircle className="h-3 w-3" />{error}</p>}
      {!hasError && hint && <p className="text-xs" style={{ color: "oklch(0.68 0.04 55)" }}>{hint}</p>}
    </div>
  );
}
