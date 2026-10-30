import { useEffect, useState } from "react";
import { getUser, getAdminUser, clearSession, clearAdminSession } from "@/lib/api";
import { AlertTriangle, UserCheck, LogOut, X } from "lucide-react";

export function AccountMismatchBanner() {
  const [mismatch, setMismatch] = useState<{
    targetUserId: number;
    currentUserName: string;
    currentUserId: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMismatch = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const notifUserIdStr = urlParams.get("notif_user_id");
        if (!notifUserIdStr) {
          setMismatch(null);
          return;
        }

        const targetUserId = parseInt(notifUserIdStr, 10);
        if (isNaN(targetUserId)) {
          setMismatch(null);
          return;
        }

        const currentUser = getUser();
        const adminUser = getAdminUser();
        const activeUser = currentUser || adminUser;

        if (activeUser && activeUser.id !== targetUserId) {
          setMismatch({
            targetUserId,
            currentUserName: activeUser.name,
            currentUserId: activeUser.id,
          });
        } else {
          setMismatch(null);
        }
      } catch (_) {
        setMismatch(null);
      }
    };

    checkMismatch();
    window.addEventListener("popstate", checkMismatch);
    window.addEventListener("salon-auth-change", checkMismatch);
    window.addEventListener("salon-admin-auth-change", checkMismatch);

    return () => {
      window.removeEventListener("popstate", checkMismatch);
      window.removeEventListener("salon-auth-change", checkMismatch);
      window.removeEventListener("salon-admin-auth-change", checkMismatch);
    };
  }, []);

  const dismiss = () => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("notif_user_id");
      window.history.replaceState({}, "", url.toString());
    } catch (_) {}
    setMismatch(null);
  };

  const handleSwitchAccount = () => {
    clearSession();
    clearAdminSession();
    dismiss();
    window.location.href = "/login";
  };

  if (!mismatch) return null;

  return (
    <aside
      role="alert"
      aria-label="Account mismatch warning"
      className="relative z-50 border-b border-amber-300 bg-amber-50/95 px-4 py-3 text-amber-950 backdrop-blur-md transition-all shadow-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-200/80 p-1.5 text-amber-900 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-amber-950">
              Notification recipient mismatch
            </p>
            <p className="mt-0.5 text-amber-800">
              This notification was intended for client account #{mismatch.targetUserId}. You are currently signed in as{" "}
              <strong className="font-semibold text-amber-950">{mismatch.currentUserName}</strong> (User #{mismatch.currentUserId}).
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto shrink-0">
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3.5 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-800 transition-colors shadow-sm"
          >
            <LogOut className="h-3.5 w-3.5" />
            Switch Account
          </button>
          <button
            type="button"
            onClick={dismiss}
            title="Dismiss notice"
            className="rounded-lg p-1.5 text-amber-800 hover:bg-amber-200/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

