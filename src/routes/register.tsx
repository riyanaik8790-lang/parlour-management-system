import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { api, setSession } from "@/lib/api";
import { Eye, EyeOff, User, Mail, Phone, Lock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import salonHeroBg from "@/assets/new_salon_hero_bg.jpg";
import floralScissorsImg from "@/assets/image.png";

// ─── Saved-credentials helper (shared with login.tsx) ────────────────────────
const SAVED_CREDS_KEY = "salon_saved_creds";
function saveCredsLocal(name: string, email: string, password: string) {
  window.localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify({ name, email, password }));
}

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account - Hemangi Glam Salon" },
      {
        name: "description",
        content: "Register to book salon appointments online at Hemangi Glam Salon.",
      },
    ],
  }),
  component: RegisterPage,
});

// ─── Validation rules (mirrors the backend exactly) ─────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const STRONG_PW_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+-=[\]{};':"\\|,.<>/?`~]).{8,72}$/;

type FieldErrors = { name?: string; email?: string; phone?: string; password?: string };

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
  if (/\d/.test(pw) && /[!@#$%^&*()_+-=[\]{};':"\\|,.<>/?`~]/.test(pw)) score++;
  const labels = ["", "Weak", "Medium", "Strong"] as const;
  return { score: score as 0 | 1 | 2 | 3, label: labels[score] };
}

// ─── Colours / design tokens (Strictly preserving original colors) ───────────
const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const ERROR_COLOR = "oklch(0.55 0.22 27)";
const SUCCESS_COLOR = "oklch(0.52 0.18 150)";

const strengthColors: Record<0 | 1 | 2 | 3, string> = {
  0: "oklch(0.88 0.025 82)",
  1: "oklch(0.55 0.22 27)",
  2: "oklch(0.68 0.16 70)",
  3: "oklch(0.52 0.18 150)",
};

// ─── PhoneField with Touch Friendly Height & Maroon Focus ─────────────────────
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
      ? BURGUNDY
      : "oklch(0.88 0.030 82)";
  const boxShadow = focused
    ? `0 0 0 2px ${hasError ? "oklch(0.577 0.245 27.325 / 20%)" : "oklch(0.35 0.15 22 / 20%)"}`
    : "none";

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(digits);
  }

  return (
    <div
      className="flex items-center min-h-[44px] rounded-xl px-3 transition-all duration-150"
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
        style={{ color: hasError ? ERROR_COLOR : focused ? BURGUNDY : "oklch(0.62 0.04 55)" }}
      >
        <Phone className="h-4 w-4" />
      </span>
      <span
        className="flex-shrink-0 mr-1 select-none text-sm font-semibold"
        style={{ color: focused ? BURGUNDY : "oklch(0.50 0.06 48)", letterSpacing: "0.02em" }}
      >
        +91
      </span>
      <span
        className="mr-2 h-4 w-px flex-shrink-0"
        style={{ background: "oklch(0.82 0.025 82)" }}
      />
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
        className="flex-1 bg-transparent py-2 text-sm outline-none min-h-[44px]"
        style={{ color: "oklch(0.25 0.05 50)" }}
      />
      {value.length === 10 && !hasError && (
        <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: SUCCESS_COLOR }} />
      )}
      {hasError && (
        <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: ERROR_COLOR }} />
      )}
    </div>
  );
}

// ─── RegisterPage Component ───────────────────────────────────────────────────
function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const strength = getPasswordStrength(form.password);

  const setField = useCallback((field: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setServerError(null);
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  }, []);

  const touch = useCallback(
    (field: keyof typeof form) => {
      setTouched((t) => ({ ...t, [field]: true }));
      setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }));
    },
    [form],
  );

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
        phone: form.phone,
        password: form.password,
      };
      const res = await api.register(payload);
      saveCredsLocal(payload.name, payload.email, payload.password);
      setSession(res.token, res.user);
      navigate({ to: "/book" });
    } catch (err) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.errors) {
            setErrors((e) => ({ ...e, ...parsed.errors }));
            return;
          }
        } catch {
          /* not JSON */
        }
        setServerError(err.message);
      } else {
        setServerError("Registration failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-[#FAF6F0]">
      {/* ── LEFT COLUMN: Clean salon interior image, no marketing copy or dark overlays ── */}
      <div className="relative hidden lg:block h-full w-full overflow-hidden">
        <img
          src={salonHeroBg}
          alt="Hemangi Glam Salon Interior"
          className="h-full w-full object-cover object-center"
        />
      </div>

      {/* ── RIGHT COLUMN: Vertically and Horizontally Centered Form Container ── */}
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-8 md:px-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Brand header with Vertical Floral Scissors */}
          <div className="mb-6 text-center auth-stagger-1">
            <img
              src={floralScissorsImg}
              alt="Floral Scissors"
              className="mx-auto h-28 sm:h-32 w-auto mb-4 object-contain select-none mix-blend-multiply"
            />
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

          {/* Form Card */}
          <div
            className="rounded-3xl shadow-xl auth-stagger-2 overflow-visible"
            style={{
              background: "oklch(0.998 0.004 85)",
              border: "1px solid oklch(0.88 0.030 82)",
              boxShadow: "0 8px 48px oklch(0.35 0.15 22 / 10%)",
            }}
          >
            <form onSubmit={submit} noValidate className="space-y-4 p-7 sm:p-8">
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

              {/* ── Full Name ── */}
              <div className="auth-stagger-3">
                <FieldWrapper
                  id="name"
                  label="Full Name"
                  icon={<User className="h-4 w-4" />}
                  error={touched.name ? errors.name : undefined}
                >
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Priya Sharma"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    onBlur={() => touch("name")}
                    disabled={busy}
                    className="w-full bg-transparent py-0 pl-10 pr-4 text-sm outline-none min-h-[44px]"
                    style={{ color: "oklch(0.25 0.05 50)" }}
                  />
                </FieldWrapper>
              </div>

              {/* ── Email Address ── */}
              <div className="auth-stagger-3">
                <FieldWrapper
                  id="email"
                  label="Email Address"
                  icon={<Mail className="h-4 w-4" />}
                  error={touched.email ? errors.email : undefined}
                >
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="priya@example.com"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    onBlur={() => touch("email")}
                    disabled={busy}
                    className="w-full bg-transparent py-0 pl-10 pr-4 text-sm outline-none min-h-[44px]"
                    style={{ color: "oklch(0.25 0.05 50)" }}
                  />
                </FieldWrapper>
              </div>

              {/* ── Phone Number ── */}
              <div className="space-y-1.5 auth-stagger-3">
                <label
                  htmlFor="phone"
                  className="block text-xs font-semibold uppercase tracking-widest"
                  style={{
                    color: touched.phone && errors.phone ? ERROR_COLOR : "oklch(0.50 0.06 48)",
                  }}
                >
                  Mobile Number
                </label>
                <PhoneField
                  value={form.phone}
                  error={touched.phone ? errors.phone : undefined}
                  disabled={busy}
                  onChange={(digits) => setField("phone", digits)}
                  onBlur={() => touch("phone")}
                />
                {touched.phone && errors.phone && (
                  <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}>
                    <XCircle className="h-3 w-3 flex-shrink-0" />
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* ── Password ── */}
              <div className="auth-stagger-4">
                <FieldWrapper
                  id="password"
                  label="Password"
                  icon={<Lock className="h-4 w-4" />}
                  error={touched.password ? errors.password : undefined}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="flex-shrink-0 p-1 transition-opacity hover:opacity-70 min-h-[44px] flex items-center justify-center"
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
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Min 8 chars, Aa1@..."
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    onBlur={() => touch("password")}
                    disabled={busy}
                    className="w-full bg-transparent py-0 pl-10 pr-2 text-sm outline-none min-h-[44px]"
                    style={{ color: "oklch(0.25 0.05 50)" }}
                  />
                </FieldWrapper>

                {/* Password strength indicator */}
                {form.password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1.5">
                      {([1, 2, 3] as const).map((step) => (
                        <div
                          key={step}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            background:
                              strength.score >= step
                                ? strengthColors[strength.score]
                                : strengthColors[0],
                          }}
                        />
                      ))}
                    </div>
                    {strength.label && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: strengthColors[strength.score] }}>
                          {strength.label} password
                        </span>
                        <span style={{ color: "oklch(0.68 0.04 55)" }}>
                          {strength.score === 3 ? "Great password" : "Use mixed case, numbers & symbols"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Submit Button with Interactive Hover & Scale ── */}
              <div className="pt-2 auth-stagger-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="relative flex w-full items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 min-h-[46px]"
                  style={{
                    background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
                    color: "oklch(0.99 0.01 85)",
                    boxShadow: `0 6px 24px ${BURGUNDY}35`,
                  }}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>
              </div>

              {/* ── Login link ── */}
              <p className="text-center text-sm auth-stagger-4" style={{ color: "oklch(0.58 0.04 55)" }}>
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
            By creating an account, you agree to our terms of service and booking policies.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable FieldWrapper with Smooth Maroon Focus Ring ──────────────────────
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
      ? BURGUNDY
      : "oklch(0.88 0.030 82)";
  const boxShadow = focused
    ? `0 0 0 2px ${hasError ? "oklch(0.577 0.245 27.325 / 20%)" : "oklch(0.35 0.15 22 / 20%)"}`
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
        className="relative flex items-center min-h-[44px] rounded-xl px-3 transition-all duration-150"
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
          className="absolute left-3 flex-shrink-0 pointer-events-none"
          style={{ color: hasError ? ERROR_COLOR : focused ? BURGUNDY : "oklch(0.62 0.04 55)" }}
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
            {hasError ? <XCircle className="h-4 w-4" style={{ color: ERROR_COLOR }} /> : null}
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
