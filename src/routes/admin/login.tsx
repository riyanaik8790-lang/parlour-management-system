import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, setAdminSession, isAdminAuthenticated } from "@/lib/api";
import { Scissors, Eye, EyeOff, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login - Hemangi Glam" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Already logged in → redirect (must be in useEffect to avoid calling navigate during render)
  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate({ to: "/admin" });
    }
  }, [navigate]);

  if (isAdminAuthenticated()) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.adminLogin({ email, password });
      if (res.user.role !== "ADMIN") {
        toast.error("Access denied. This portal is for administrators only.");
        return;
      }
      setAdminSession(res.token, res.user);
      toast.success("Welcome, " + res.user.name.split(" ")[0] + "!");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f13] px-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-pink-700/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#16161d] shadow-2xl">
          {/* Header stripe */}
          <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Scissors className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">Hemangi Glam</h1>
                <p className="text-xs text-rose-100">Administration Portal</p>
              </div>
              <ShieldCheck className="ml-auto h-5 w-5 text-white/70" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-5 p-8">
            <div>
              <p className="text-lg font-semibold text-white">Admin Sign In</p>
              <p className="mt-0.5 text-sm text-white/40">
                Restricted access - authorised personnel only.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none ring-offset-2 ring-offset-[#16161d] transition focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/40"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none ring-offset-2 ring-offset-[#16161d] transition focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/40"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="admin-login-btn"
              type="submit"
              disabled={busy}
              className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-rose-500 hover:to-pink-500 hover:shadow-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Authenticating…
                </span>
              ) : (
                "Sign In to Admin Panel"
              )}
            </button>

            {/* Back link */}
            <p className="text-center text-xs text-white/25">
              Not an admin?{" "}
              <Link to="/" className="text-white/40 underline underline-offset-2 hover:text-white/70">
                Go to main site
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
