import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { api, setSession } from "@/lib/api";
import { Eye, EyeOff, Mail, Lock, XCircle, Loader2, UserCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login - Hemangi Glam Salon" },
      { name: "description", content: "Login to book and manage your appointments." },
    ],
  }),
  component: LoginPage,
});

// ─── Saved-credentials helpers ────────────────────────────────────────────────
const SAVED_CREDS_KEY = "salon_saved_creds";

type SavedCreds = { name: string; email: string; password: string };

function getSavedCreds(): SavedCreds | null {
  try {
    const raw = window.localStorage.getItem(SAVED_CREDS_KEY);
    return raw ? (JSON.parse(raw) as SavedCreds) : null;
  } catch {
    return null;
  }
}

function saveCreds(name: string, email: string, password: string) {
  window.localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify({ name, email, password }));
}

function clearCreds() {
  window.localStorage.removeItem(SAVED_CREDS_KEY);
}

// ─── Validation ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Email address is required";
  if (!EMAIL_RE.test(value.trim())) return "Enter a valid email address (e.g. you@example.com)";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required";
  return undefined;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const ERROR_COLOR = "oklch(0.55 0.22 27)";
const SUCCESS_COLOR = "oklch(0.42 0.18 150)";

// ─── LoginPage ────────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // readOnly trick: prevents browsers from autofilling on page load.
  // Removed as soon as the user interacts with a field.
  const [readOnly, setReadOnly] = useState(true);

  // Saved credentials - loaded silently, never shown upfront
  const [savedCreds, setSavedCreds] = useState<SavedCreds | null>(null);

  // Per-field touched state
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const emailError = emailTouched ? validateEmail(email) : undefined;
  const passwordError = passwordTouched ? validatePassword(password) : undefined;

  // On mount: load saved credentials for banner only - do NOT pre-fill fields
  useEffect(() => {
    const creds = getSavedCreds();
    if (creds) {
      setSavedCreds(creds);
    }
  }, []);

  function applySavedCreds() {
    if (!savedCreds) return;
    setEmail(savedCreds.email);
    setPassword(savedCreds.password);
    setShowSuggestion(false);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setServerError(null);
    // Show suggestion dropdown only when user types something matching the saved email
    if (savedCreds && value.length > 0) {
      setShowSuggestion(savedCreds.email.toLowerCase().startsWith(value.toLowerCase()));
    } else {
      setShowSuggestion(false);
    }
  }



  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setEmailTouched(true);
    setPasswordTouched(true);

    if (validateEmail(email) || validatePassword(password)) return;

    setBusy(true);
    setServerError(null);
    try {
      const res = await api.login({ email: email.trim().toLowerCase(), password });
      // If remember me is checked, save credentials for next login
      if (rememberMe) {
        saveCreds(res.user.name, email.trim().toLowerCase(), password);
      } else {
        clearCreds();
      }
      setSession(res.token, res.user, rememberMe);
      navigate({ to: "/book" });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "oklch(0.968 0.018 85)" }}
    >
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
          >
            <span className="text-2xl">✂</span>
          </div>
          <h1
            className="text-3xl font-bold"
            style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
          >
            Welcome back
          </h1>
          <p className="mt-2 text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>
            Sign in to manage your appointments.
          </p>
        </div>


        {/* Card */}
        <div
          className="overflow-hidden rounded-3xl shadow-xl"
          style={{
            background: "oklch(0.998 0.004 85)",
            border: "1px solid oklch(0.88 0.030 82)",
            boxShadow: "0 8px 48px oklch(0.35 0.15 22 / 10%)",
          }}
        >
          {/* Top accent gradient bar */}
          <div
            className="h-1.5 w-full"
            style={{ background: `linear-gradient(90deg, ${BURGUNDY}, ${GOLD})` }}
          />

          <form onSubmit={submit} noValidate className="space-y-5 p-8">
            {/* Server-level error banner */}
            {serverError && (
              <div
                className="flex items-start gap-3 rounded-xl p-4 text-sm"
                style={{
                  background: "oklch(0.577 0.245 27.325 / 8%)",
                  border: "1px solid oklch(0.577 0.245 27.325 / 25%)",
                  color: ERROR_COLOR,
                }}
              >
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {serverError}
              </div>
            )}

            {/* ── Email ── */}
            <div className="relative">
              <FieldWrapper
                id="login-email"
                label="Email Address"
                icon={<Mail className="h-4 w-4" />}
                error={emailError}
              >
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="new-password"
                  placeholder="you@example.com"
                  readOnly={readOnly}
                  value={email}
                  onFocus={() => {
                    setReadOnly(false);
                    if (savedCreds && email.length > 0) {
                      setShowSuggestion(savedCreds.email.toLowerCase().startsWith(email.toLowerCase()));
                    }
                  }}
                  onClick={() => setReadOnly(false)}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => { setEmailTouched(true); setTimeout(() => setShowSuggestion(false), 150); }}
                  disabled={busy}
                  className="w-full bg-transparent py-0 pl-10 pr-4 text-sm outline-none"
                  style={{ color: "oklch(0.25 0.05 50)" }}
                />
              </FieldWrapper>

              {/* Saved email suggestion dropdown */}
              {showSuggestion && savedCreds && (
                <button
                  type="button"
                  onMouseDown={applySavedCreds}
                  className="absolute left-0 right-0 z-20 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-150"
                  style={{
                    top: "calc(100% + 4px)",
                    background: "oklch(0.998 0.004 85)",
                    border: `1px solid ${GOLD}60`,
                    boxShadow: `0 4px 20px oklch(0.35 0.15 22 / 12%)`,
                    color: "oklch(0.25 0.05 50)",
                  }}
                >
                  <UserCheck className="h-4 w-4 flex-shrink-0" style={{ color: SUCCESS_COLOR }} />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium">{savedCreds.email}</span>
                    <span className="text-xs" style={{ color: "oklch(0.58 0.04 55)" }}>Saved account</span>
                  </div>
                </button>
              )}
            </div>

            {/* ── Password with Eye Toggle ── */}
            <FieldWrapper
              id="login-password"
              label="Password"
              icon={<Lock className="h-4 w-4" />}
              error={passwordError}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex-shrink-0 p-1 transition-opacity hover:opacity-70"
                  style={{ color: "oklch(0.60 0.04 50)" }}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            >
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Your password"
                readOnly={readOnly}
                value={password}
                onFocus={() => setReadOnly(false)}
                onClick={() => setReadOnly(false)}
                onChange={(e) => { setPassword(e.target.value); setServerError(null); }}
                onBlur={() => setPasswordTouched(true)}
                disabled={busy}
                className="w-full bg-transparent py-0 pl-10 pr-2 text-sm outline-none"
                style={{ color: "oklch(0.25 0.05 50)" }}
              />
            </FieldWrapper>

            {/* ── Remember Me & Forgot Password ── */}
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-remember"
                className="flex cursor-pointer select-none items-center gap-2.5"
              >
                <span
                  className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md transition-all duration-150"
                  style={{
                    background: rememberMe
                      ? `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`
                      : "oklch(0.998 0.004 85)",
                    border: rememberMe
                      ? "none"
                      : "1.5px solid oklch(0.78 0.030 82)",
                    boxShadow: rememberMe ? `0 2px 8px ${BURGUNDY}30` : "none",
                  }}
                >
                  {rememberMe && (
                    <svg
                      viewBox="0 0 12 10"
                      fill="none"
                      className="h-3 w-3"
                      stroke="oklch(0.99 0.01 85)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="1.5,5 4.5,8 10.5,1.5" />
                    </svg>
                  )}
                  <input
                    id="login-remember"
                    name="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </span>
                <span className="text-sm" style={{ color: "oklch(0.45 0.05 50)" }}>
                  Remember me
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: BURGUNDY }}
              >
                Forgot password?
              </button>
            </div>

            {showForgotPassword && (
              <div
                className="rounded-xl p-4 text-sm animate-fade-up"
                style={{
                  background: "oklch(0.92 0.030 83 / 50%)",
                  border: "1px solid oklch(0.84 0.042 80 / 50%)",
                  color: "oklch(0.45 0.05 50)",
                }}
              >
                Please contact the salon at <span className="font-semibold">+91 8208576165</span> to reset your password.
              </div>
            )}

            {/* ── Submit Button ── */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={busy}
              className="relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
                color: "oklch(0.99 0.01 85)",
                boxShadow: `0 6px 24px ${BURGUNDY}35`,
              }}
              onMouseEnter={(e) => {
                if (!busy) (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 32px ${BURGUNDY}50`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 24px ${BURGUNDY}35`;
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            {/* ── Register link ── */}
            <p className="text-center text-sm" style={{ color: "oklch(0.58 0.04 55)" }}>
              New here?{" "}
              <Link
                to="/register"
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: BURGUNDY }}
              >
                Create an account
              </Link>
            </p>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs" style={{ color: "oklch(0.68 0.04 55)" }}>
          Your session is encrypted and secured with JWT.
        </p>
      </div>
    </div>
  );
}

// ─── Reusable FieldWrapper ─────────────────────────────────────────────────────
function FieldWrapper({
  id,
  label,
  icon,
  error,
  hint,
  suffix,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  hint?: string;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  const borderColor = hasError
    ? "oklch(0.577 0.245 27.325)"
    : focused
      ? GOLD
      : "oklch(0.88 0.030 82)";
  const boxShadow = focused
    ? `0 0 0 3px ${hasError ? "oklch(0.577 0.245 27.325 / 12%)" : "oklch(0.68 0.13 68 / 14%)"}`
    : "none";

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-widest"
        style={{ color: hasError ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}
      >
        {label}
      </label>

      <div
        className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-150"
        style={{
          background: "oklch(0.998 0.004 85)",
          border: `1px solid ${borderColor}`,
          boxShadow,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {/* Leading icon */}
        <span
          className="flex-shrink-0"
          style={{ color: hasError ? ERROR_COLOR : focused ? GOLD : "oklch(0.62 0.04 55)" }}
        >
          {icon}
        </span>

        {/* Input slot */}
        <div className="flex flex-1 items-center">{children}</div>

        {/* Trailing slot (eye toggle) */}
        {suffix}

        {/* Validation indicator - only when no suffix */}
        {!suffix && (
          <span className="flex-shrink-0">
            {hasError ? (
              <XCircle className="h-4 w-4" style={{ color: ERROR_COLOR }} />
            ) : null}
          </span>
        )}
      </div>

      {/* Error message */}
      {hasError && (
        <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}>
          <XCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}

      {/* Hint (shown when no error) */}
      {!hasError && hint && (
        <p className="text-xs" style={{ color: "oklch(0.68 0.04 55)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}