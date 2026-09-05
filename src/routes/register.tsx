import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { api, setSession } from "@/lib/api";
import { Eye, EyeOff, User, Mail, Phone, Lock, CheckCircle, XCircle, Loader2 } from "lucide-react";

// ─── Saved-credentials helper (shared with login.tsx) ────────────────────────
const SAVED_CREDS_KEY = "salon_saved_creds";
function saveCredsLocal(name: string, email: string, password: string) {
  window.localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify({ name, email, password }));
}

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account - Hemangi Glam Salon" },
      { name: "description", content: "Register to book salon appointments online at Hemangi Glam Salon." },
    ],
  }),
  component: RegisterPage,
});

// ─── Validation rules (mirrors the backend exactly) ─────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const STRONG_PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]).{8,72}$/;

type FieldErrors = { name?: string; email?: string; phone?: string; password?: string };

// Only strip non-digit chars - no country-code logic needed since we show
// "+91" as a static prefix outside the input and the input holds only digits.
function stripPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function validateField(field: keyof FieldErrors, value: string): string | undefined {
  switch (field) {
    case "name": {
      const trimmed = value.trim();
      if (trimmed.length < 2) return "Full name is required";
      if (trimmed.split(/\s+/).length < 2) return "Please enter at least your first and last name";
      if (trimmed.length > 80) return "Name must be under 80 characters";
      return undefined;
    }
    case "email": {
      if (!value.trim()) return "Email address is required";
      if (!EMAIL_RE.test(value.trim())) return "Enter a valid email address (e.g. you@example.com)";
      return undefined;
    }
    case "phone": {
      const digits = stripPhoneDigits(value);
      if (!digits) return "Phone number is required";
      if (digits.length < 10) return `Enter all 10 digits (${digits.length}/10 entered)`;
      if (!INDIAN_PHONE_RE.test(digits)) return "Must start with 6, 7, 8 or 9";
      return undefined;
    }
    case "password": {
      if (!value) return "Password is required";
      if (value.length < 8) return "At least 8 characters required";
      if (!STRONG_PW_RE.test(value))
        return "Must include uppercase, lowercase, number & special character";
      return undefined;
    }
  }
}

function getPasswordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length === 0) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(pw)) score++;
  const labels = ["", "Weak", "Medium", "Strong"] as const;
  return { score: score as 0 | 1 | 2 | 3, label: labels[score] };
}

// ─── Colours / design tokens ────────────────────────────────────────────────
const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const ERROR_COLOR = "oklch(0.55 0.22 27)";
const SUCCESS_COLOR = "oklch(0.52 0.18 150)";

const strengthColors: Record<0 | 1 | 2 | 3, string> = {
  0: "oklch(0.88 0.025 82)",
  1: "oklch(0.55 0.22 27)",   // red
  2: "oklch(0.68 0.16 70)",   // amber/gold
  3: "oklch(0.52 0.18 150)",  // green
};


// ─── PhoneField - static +91 badge, input holds only raw digits ──────────────
function PhoneField({
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (digits: string) => void;
  onBlur: () => void;
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

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(digits);
  }

  return (
    <div
      className="flex items-center rounded-xl px-3 py-3 transition-all duration-150"
      style={{
        background: "oklch(0.998 0.004 85)",
        border: `1px solid ${borderColor}`,
        boxShadow,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <span
        className="flex-shrink-0 mr-2"
        style={{ color: hasError ? ERROR_COLOR : focused ? GOLD : "oklch(0.62 0.04 55)" }}
      >
        <Phone className="h-4 w-4" />
      </span>
      <span
        className="flex-shrink-0 mr-1 select-none text-sm font-semibold"
        style={{ color: focused ? GOLD : "oklch(0.50 0.06 48)", letterSpacing: "0.02em" }}
      >
        +91
      </span>
      <span className="mr-2 h-4 w-px flex-shrink-0" style={{ background: "oklch(0.82 0.025 82)" }} />
      <input
        id="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        value={value}
        onChange={handleInput}
        onBlur={onBlur}
        disabled={disabled}
        maxLength={10}
        className="flex-1 bg-transparent py-0 text-sm outline-none"
        style={{ color: "oklch(0.25 0.05 50)", minWidth: 0 }}
      />
      <span
        className="flex-shrink-0 ml-2 text-xs tabular-nums"
        style={{ color: value.length === 10 ? "oklch(0.52 0.18 150)" : "oklch(0.70 0.04 55)" }}
      >
        {value.length}/10
      </span>
      {hasError && <XCircle className="ml-1 h-4 w-4 flex-shrink-0" style={{ color: ERROR_COLOR }} />}
    </div>
  );
}

// ─── RegisterPage ────────────────────────────────────────────────────────────
function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  // phone is stored as raw digits only (no +91 prefix); +91 is shown as a static badge
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<keyof FieldErrors, boolean>>({
    name: false, email: false, phone: false, password: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const pwStrength = getPasswordStrength(form.password);

  // Touch a field and validate it immediately
  const touch = useCallback(
    (field: keyof FieldErrors) => {
      setTouched((t) => ({ ...t, [field]: true }));
      setErrors((e) => ({ ...e, [field]: validateField(field, form[field]) }));
    },
    [form],
  );

  function handleChange(field: keyof FieldErrors, rawValue: string) {
    setServerError(null);
    let value = rawValue;

    if (field === "phone") {
      // Input only ever holds raw digits (no country code). Just cap at 10.
      value = stripPhoneDigits(rawValue);
    }

    setForm((f) => ({ ...f, [field]: value }));
    if (touched[field]) {
      setErrors((e) => ({ ...e, [field]: validateField(field, value) }));
    }
  }

  function validateAll(): boolean {
    const newErrors: FieldErrors = {};
    (["name", "email", "phone", "password"] as const).forEach((f) => {
      newErrors[f] = validateField(f, form[f]);
    });
    setErrors(newErrors);
    setTouched({ name: true, email: true, phone: true, password: true });
    return !Object.values(newErrors).some(Boolean);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;

    setBusy(true);
    setServerError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone, // already stored as raw 10 digits
        password: form.password,
      };
      const res = await api.register(payload);
      // Save credentials so login page shows the "Welcome back" banner
      saveCredsLocal(payload.name, payload.email, payload.password);
      setSession(res.token, res.user);
      navigate({ to: "/book" });
    } catch (err) {
      if (err instanceof Error) {
        // Try to parse per-field server errors
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.errors) {
            setErrors((e) => ({ ...e, ...parsed.errors }));
            return;
          }
        } catch {/* not JSON */ }
        setServerError(err.message);
      } else {
        setServerError("Registration failed. Please try again.");
      }
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
            Create your account
          </h1>
          <p className="mt-2 text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>
            Book in seconds, track every visit.
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
          {/* Top accent bar */}
          <div
            className="h-1.5 w-full"
            style={{ background: `linear-gradient(90deg, ${BURGUNDY}, ${GOLD})` }}
          />

          <form onSubmit={submit} noValidate className="space-y-5 p-8">
            {/* Server-level error */}
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

            {/* ── Full Name ── */}
            <FieldWrapper
              id="name"
              label="Full Name"
              icon={<User className="h-4 w-4" />}
              error={touched.name ? errors.name : undefined}
              hint="First, middle (optional) and last name"
            >
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Alex Robin Wood"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                onBlur={() => touch("name")}
                disabled={busy}
                className="w-full bg-transparent py-0 pl-10 pr-4 text-sm outline-none"
                style={{ color: "oklch(0.25 0.05 50)" }}
              />
            </FieldWrapper>

            {/* ── Email ── */}
            <FieldWrapper
              id="email"
              label="Email Address"
              icon={<Mail className="h-4 w-4" />}
              error={touched.email ? errors.email : undefined}
            >
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => touch("email")}
                disabled={busy}
                className="w-full bg-transparent py-0 pl-10 pr-4 text-sm outline-none"
                style={{ color: "oklch(0.25 0.05 50)" }}
              />
            </FieldWrapper>

            {/* ── Phone ── */}
            {/* The +91 prefix is a STATIC badge - the input only holds the 10 raw digits
                so there is no re-processing / doubling loop. */}
            <div className="space-y-1.5">
              <label
                htmlFor="phone"
                className="block text-xs font-semibold uppercase tracking-widest"
                style={{ color: touched.phone && errors.phone ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}
              >
                Mobile Number
              </label>
              <PhoneField
                value={form.phone}
                error={touched.phone ? errors.phone : undefined}
                disabled={busy}
                onChange={(digits) => handleChange("phone", digits)}
                onBlur={() => touch("phone")}
              />
              {touched.phone && errors.phone ? (
                <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}>
                  <XCircle className="h-3 w-3 flex-shrink-0" />
                  {errors.phone}
                </p>
              ) : (
                <p className="text-xs" style={{ color: "oklch(0.68 0.04 55)" }}>
                  Used for booking confirmations &amp; SMS reminders
                </p>
              )}
            </div>

            {/* ── Password ── */}
            <div className="space-y-1">
              <FieldWrapper
                id="password"
                label="Password"
                icon={<Lock className="h-4 w-4" />}
                error={touched.password ? errors.password : undefined}
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
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, mixed case + symbol"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  onBlur={() => touch("password")}
                  disabled={busy}
                  className="w-full bg-transparent py-0 pl-10 pr-2 text-sm outline-none"
                  style={{ color: "oklch(0.25 0.05 50)" }}
                />
              </FieldWrapper>

              {/* Password strength meter */}
              {form.password.length > 0 && (
                <div className="pt-1">
                  <div className="flex gap-1.5">
                    {([1, 2, 3] as const).map((level) => (
                      <div
                        key={level}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background:
                            pwStrength.score >= level
                              ? strengthColors[pwStrength.score]
                              : "oklch(0.90 0.020 82)",
                        }}
                      />
                    ))}
                  </div>
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{
                      color: pwStrength.score > 0 ? strengthColors[pwStrength.score] : "transparent",
                    }}
                  >
                    {pwStrength.label} password
                  </p>
                </div>
              )}

              {/* Password checklist */}
              {form.password.length > 0 && (
                <div
                  className="mt-2 grid grid-cols-2 gap-1 rounded-xl p-3 text-xs"
                  style={{
                    background: "oklch(0.96 0.016 83 / 70%)",
                    border: "1px solid oklch(0.90 0.025 82)",
                  }}
                >
                  {[
                    { label: "8+ characters", ok: form.password.length >= 8 },
                    { label: "Uppercase (A–Z)", ok: /[A-Z]/.test(form.password) },
                    { label: "Lowercase (a–z)", ok: /[a-z]/.test(form.password) },
                    { label: "Number (0–9)", ok: /\d/.test(form.password) },
                    { label: "Special char (!@#…)", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(form.password) },
                  ].map(({ label, ok }) => (
                    <span
                      key={label}
                      className="flex items-center gap-1.5"
                      style={{ color: ok ? SUCCESS_COLOR : "oklch(0.62 0.04 55)" }}
                    >
                      {ok ? (
                        <CheckCircle className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <div className="h-3 w-3 flex-shrink-0 rounded-full border" style={{ borderColor: "oklch(0.75 0.030 60)" }} />
                      )}
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Submit ── */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={busy}
              className="relative mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
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
                  Creating your account…
                </>
              ) : (
                "Create account"
              )}
            </button>

            {/* ── Login link ── */}
            <p className="text-center text-sm" style={{ color: "oklch(0.58 0.04 55)" }}>
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: BURGUNDY }}
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs" style={{ color: "oklch(0.68 0.04 55)" }}>
          By creating an account you agree to receive booking confirmations via SMS/email.
        </p>
      </div>
    </div>
  );
}

// ─── Reusable field wrapper ──────────────────────────────────────────────────
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

        {/* Trailing slot (e.g. eye toggle) */}
        {suffix}

        {/* Validation indicator */}
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