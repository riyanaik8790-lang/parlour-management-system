import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, clearSession, getUser, setSession, getToken, getAdminToken, getAdminUser, setAdminSession, type AppNotification } from "@/lib/api";
import { supabase, AVATAR_BUCKET, AVATAR_MAX_BYTES } from "@/lib/supabase";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import {
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  Save,
  Check,
  AlertTriangle,
  Trash2,
  Settings as SettingsIcon,
  Bell,
  Download,
  Camera,
  Pencil,
  ExternalLink,
  Image as ImageIcon,
  X,
  Volume2,
  VolumeX,
  History,
  Calendar,
  Clock,
  Info,
  Sparkles,
  FileText,
  ChevronRight,
  ArrowLeft,
  RotateCw,
} from "lucide-react";
import { REMINDER_OPTIONS, formatReminderLabel } from "@/lib/services-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
const BURGUNDY = "oklch(0.35 0.15 22)";
const BURGUNDY_MID = "oklch(0.45 0.13 25)";
const GOLD = "oklch(0.68 0.13 68)";
const GOLD_LIGHT = "oklch(0.80 0.10 72)";
const ERROR_COLOR = "oklch(0.55 0.22 27)";
const SUCCESS_COLOR = "oklch(0.42 0.18 150)";
const BG = "oklch(0.968 0.018 85)";
const CARD_BG = "oklch(0.998 0.004 85)";
const BORDER = "oklch(0.88 0.030 82)";

const STRONG_PW_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,72}$/;
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

// ── Avatar helpers ───────────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function initialsColor(initials: string): string {
  const palettes = [
    "oklch(0.82 0.08 22)",   // soft rose
    "oklch(0.80 0.07 68)",   // warm gold
    "oklch(0.78 0.09 160)",  // sage green
    "oklch(0.80 0.08 250)",  // sky blue
    "oklch(0.78 0.08 300)",  // soft lavender
    "oklch(0.80 0.08 30)",   // peach
  ];
  const code = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return palettes[code % palettes.length];
}

// ── Section enum ──────────────────────────────────────────────────────────────
type Section = "profile" | "notifications" | "password" | "danger" | "storage";

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionUser = getUser();

  useEffect(() => {
    if (!sessionUser) navigate({ to: "/login" });
  }, []);

  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Profile state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [savingPush, setSavingPush] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Notification settings state
  const [notifSubTab, setNotifSubTab] = useState<"preferences" | "history">("preferences");
  const [alertSoundEnabled, setAlertSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("salon_audio_unlocked") === "true";
    }
    return false;
  });
  const [historyNotifications, setHistoryNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifHistory, setLoadingNotifHistory] = useState(false);
  const [deletingNotifId, setDeletingNotifId] = useState<number | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [defaultReminderMinutes, setDefaultReminderMinutes] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("salon_reminder_pref");
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 30;
  });
  const isInitialPreset = REMINDER_OPTIONS.some((o) => o.value === defaultReminderMinutes);
  const [isCustomReminder, setIsCustomReminder] = useState<boolean>(!isInitialPreset);
  const [customReminderVal, setCustomReminderVal] = useState<string>(() => {
    if (!isInitialPreset) {
      if (defaultReminderMinutes >= 1440 && defaultReminderMinutes % 1440 === 0) return String(Math.round(defaultReminderMinutes / 1440));
      if (defaultReminderMinutes >= 60 && defaultReminderMinutes % 60 === 0) return String(Math.round(defaultReminderMinutes / 60));
      return String(defaultReminderMinutes);
    }
    return "45";
  });
  const [customReminderUnit, setCustomReminderUnit] = useState<"mins" | "hours" | "days">(() => {
    if (!isInitialPreset) {
      if (defaultReminderMinutes >= 1440 && defaultReminderMinutes % 1440 === 0) return "days";
      if (defaultReminderMinutes >= 60 && defaultReminderMinutes % 60 === 0) return "hours";
    }
    return "mins";
  });
  const [savingReminderPref, setSavingReminderPref] = useState(false);
  const [customReminderSaved, setCustomReminderSaved] = useState(false);
  const [customReminderError, setCustomReminderError] = useState<string | null>(null);

  // Sync alert sound state when modified elsewhere
  useEffect(() => {
    const handleSync = () => {
      setAlertSoundEnabled(localStorage.getItem("salon_audio_unlocked") === "true");
    };
    window.addEventListener("salon-audio-toggle", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("salon-audio-toggle", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const loadNotifHistory = useCallback(async () => {
    setLoadingNotifHistory(true);
    try {
      const res = await api.getNotifications();
      setHistoryNotifications(res.notifications);
    } catch (e) {
      console.error("Failed to load notification history:", e);
    } finally {
      setLoadingNotifHistory(false);
    }
  }, []);

  const handleDeleteNotification = async (id: number) => {
    setDeletingNotifId(id);
    // 1. Optimistic removal - disappears immediately
    setHistoryNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notification removed");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("notifications-changed"));
    }
    // 2. Persist deletion to localStorage & backend
    try {
      await api.deleteNotification(id);
    } catch (e) {
      console.warn("Failed to sync notification deletion to backend:", e);
    } finally {
      setDeletingNotifId(null);
    }
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    const allIds = historyNotifications.map((n) => n.id);
    // 1. Optimistic removal - disappears immediately
    setHistoryNotifications([]);
    setShowClearConfirm(false);
    toast.success("Notification history cleared");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("notifications-changed"));
    }
    // 2. Persist clear to localStorage & backend
    try {
      await api.clearAllNotifications(allIds);
    } catch (e) {
      console.warn("Failed to sync notification clear to backend:", e);
    } finally {
      setClearingHistory(false);
    }
  };

  const toggleAlertSounds = () => {
    const next = !alertSoundEnabled;
    // 1. Flip state
    setAlertSoundEnabled(next);
    // 2. Show toast IMMEDIATELY — synchronous, before any I/O
    if (next) {
      toast.success("Alert sounds turned ON", { id: "audio-toggle", duration: 2500 });
    } else {
      toast.success("Alert sounds turned OFF", { id: "audio-toggle", duration: 2500 });
    }
    // 3. Persist & broadcast in background
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("salon_audio_unlocked", next ? "true" : "false");
        window.dispatchEvent(new Event("salon-audio-toggle"));
      } catch (err) {
        console.error("Failed to save audio preference:", err);
      }
    }
    // 4. Play preview asynchronously — never blocks toast
    if (next) {
      const audio = new Audio("/notification-ding.mp3");
      audio.volume = 1;
      audio.play().catch(() => { /* silent catch */ });
    }
  };

  // Support deep-linking from Notification bell dropdown (e.g. ?section=notifications&view=history)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const section = params.get("section");
      const view = params.get("view");
      if (section === "notifications") {
        setActiveSection("notifications");
      }
      if (view === "history") {
        setActiveSection("notifications");
        setNotifSubTab("history");
        loadNotifHistory();
      }
    }
  }, [loadNotifHistory]);

  // Close avatar dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        avatarContainerRef.current &&
        !avatarContainerRef.current.contains(e.target as Node)
      ) {
        setIsAvatarMenuOpen(false);
      }
    }
    if (isAvatarMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAvatarMenuOpen]);

  // Info save state
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Field errors (shared)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Storage state
  const [storageData, setStorageData] = useState<{used_mb: number, total_mb: number} | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [archivesData, setArchivesData] = useState<{name: string, size: number, created_at: string, url: string}[]>([]);
  const [deletingArchive, setDeletingArchive] = useState<string | null>(null); // filename being deleted
  const [archiveToDelete, setArchiveToDelete] = useState<string | null>(null);  // filename pending confirm

  // Helper to decompose minutes into value and unit
  const parseMinutesToCustom = useCallback((mins: number): { val: number; unit: "mins" | "hours" | "days" } => {
    if (mins >= 1440 && mins % 1440 === 0) {
      return { val: Math.round(mins / 1440), unit: "days" };
    }
    if (mins >= 60 && mins % 60 === 0) {
      return { val: Math.round(mins / 60), unit: "hours" };
    }
    return { val: mins, unit: "mins" };
  }, []);

  // Helper to apply reminder minutes to React state and localStorage
  const applyReminderPreference = useCallback(
    (m: number) => {
      if (!m || isNaN(m) || m <= 0) return;
      setDefaultReminderMinutes(m);
      localStorage.setItem("salon_reminder_pref", String(m));
      const preset = REMINDER_OPTIONS.some((o) => o.value === m);
      if (!preset) {
        setIsCustomReminder(true);
        const parsed = parseMinutesToCustom(m);
        setCustomReminderVal(String(parsed.val));
        setCustomReminderUnit(parsed.unit);
      } else {
        setIsCustomReminder(false);
      }
    },
    [parseMinutesToCustom],
  );

  // Load profile and sync reminder preference
  useEffect(() => {
    // 1. Immediately read from localStorage on mount so selection is active instantly
    const saved = localStorage.getItem("salon_reminder_pref");
    if (saved) {
      const m = Number(saved);
      if (!isNaN(m) && m > 0) {
        applyReminderPreference(m);
      }
    }

    // 2. Fetch authenticated user profile
    setLoadingProfile(true);
    api
      .getProfile()
      .then((p) => {
        setName(p.name);
        setPhone(p.phone);
        setEmail(p.email);
        setRole(p.role);
        setAvatarUrl(p.avatar_url ?? null);
        setPushEnabled(p.push_enabled ?? false);
        if (p.default_reminder_minutes) {
          applyReminderPreference(p.default_reminder_minutes);
        }
      })
      .catch(() => {
        const u = getUser();
        if (u) {
          setName(u.name);
          setEmail(u.email);
          setRole(u.role ?? "");
        }
      })
      .finally(() => setLoadingProfile(false));
  }, [applyReminderPreference]);

  // Sync reminder state across tabs and booking page
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "salon_reminder_pref" && e.newValue) {
        const m = Number(e.newValue);
        if (!isNaN(m) && m > 0) {
          applyReminderPreference(m);
        }
      }
    };
    const handleCustomSync = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail && typeof customEvent.detail === "number") {
        applyReminderPreference(customEvent.detail);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("salon-reminder-updated", handleCustomSync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("salon-reminder-updated", handleCustomSync);
    };
  }, [applyReminderPreference]);

  const handleReminderPrefChange = (mins: number) => {
    // 1. Update React state and localStorage synchronously — instant UI feedback
    setDefaultReminderMinutes(mins);
    localStorage.setItem("salon_reminder_pref", String(mins));
    window.dispatchEvent(new CustomEvent("salon-reminder-updated", { detail: mins }));
    // 2. Persist to backend in background — never blocks or locks the UI
    api.updateProfile({ default_reminder_minutes: mins }).catch((err) => {
      console.warn("[settings] Background reminder sync failed (preference already saved locally):", err);
    });
  };

  const handleReminderSelect = (val: string) => {
    setCustomReminderError(null);
    if (val === "custom") {
      setIsCustomReminder(true);
      const numVal = Number(customReminderVal);
      const safeVal = numVal > 0 ? numVal : 45;
      setCustomReminderVal(String(safeVal));
      const m =
        customReminderUnit === "days"
          ? safeVal * 1440
          : customReminderUnit === "hours"
            ? safeVal * 60
            : safeVal;
      handleReminderPrefChange(m);
    } else {
      setIsCustomReminder(false);
      handleReminderPrefChange(Number(val));
      toast.success(`Notification reminder set to ${formatReminderLabel(Number(val))}`);
    }
  };

  const handleCustomValChange = (raw: string) => {
    // Allow free typing including empty string — do NOT force to 1
    setCustomReminderVal(raw);
    setCustomReminderSaved(false);
    setCustomReminderError(null);
    const numVal = Number(raw);
    if (raw !== "" && !isNaN(numVal) && numVal >= 1) {
      // Only update live state when value is valid
      const m =
        customReminderUnit === "days"
          ? numVal * 1440
          : customReminderUnit === "hours"
            ? numVal * 60
            : numVal;
      setDefaultReminderMinutes(m);
      localStorage.setItem("salon_reminder_pref", String(m));
      window.dispatchEvent(new CustomEvent("salon-reminder-updated", { detail: m }));
    }
  };

  const handleCustomUnitChange = (unit: "mins" | "hours" | "days") => {
    setCustomReminderUnit(unit);
    setCustomReminderSaved(false);
    setCustomReminderError(null);
    const numVal = Number(customReminderVal);
    if (!isNaN(numVal) && numVal >= 1) {
      const m =
        unit === "days"
          ? numVal * 1440
          : unit === "hours"
            ? numVal * 60
            : numVal;
      setDefaultReminderMinutes(m);
      localStorage.setItem("salon_reminder_pref", String(m));
      window.dispatchEvent(new CustomEvent("salon-reminder-updated", { detail: m }));
    }
  };

  const handleSaveCustomReminder = () => {
    const numVal = Number(customReminderVal);
    if (customReminderVal === "" || isNaN(numVal) || numVal < 1) {
      setCustomReminderError("Please enter a valid number (minimum 1).");
      return;
    }
    const max = customReminderUnit === "days" ? 30 : customReminderUnit === "hours" ? 72 : 1440;
    if (numVal > max) {
      setCustomReminderError(`Maximum is ${max} ${customReminderUnit}.`);
      return;
    }
    setCustomReminderError(null);
    // Normalise display value (e.g. strip leading zeros)
    setCustomReminderVal(String(numVal));
    const m =
      customReminderUnit === "days"
        ? numVal * 1440
        : customReminderUnit === "hours"
          ? numVal * 60
          : numVal;
    // 1. Persist synchronously (localStorage + background API) — no await, no spinner
    handleReminderPrefChange(m);
    // 2. Show toast immediately
    toast.success(`Reminder set to ${formatReminderLabel(m)}`);
    // 3. Flash "Saved ✓" on the button immediately
    setCustomReminderSaved(true);
    setTimeout(() => setCustomReminderSaved(false), 2500);
  };

  // ── Upload Avatar File helper ──────────────────────────────────────────────
  async function uploadAvatarFile(file: File) {
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(`Image is too large. Maximum size is 2 MB (your file: ${(file.size / 1_048_576).toFixed(1)} MB).`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPEG, PNG, WebP, etc.).");
      return;
    }

    setIsUploading(true);

    try {
      const user = getUser();
      if (!user) {
        toast.error("Please login first.");
        navigate({ to: "/login" });
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error("[avatar] Supabase upload error:", uploadError);
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await api.updateAvatarUrl(publicUrl);

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      setIsAvatarMenuOpen(false);
      window.dispatchEvent(new Event("salon-profile-updated"));
      window.dispatchEvent(new Event("salon-auth-change"));
      window.dispatchEvent(new Event("salon-admin-auth-change"));
      toast.success("Profile photo updated!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  // ── Avatar input change ────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      await uploadAvatarFile(file);
    }
  }

  // ── Remove photo ───────────────────────────────────────────────────────────
  async function handleRemoveAvatar() {
    setIsAvatarMenuOpen(false);
    const user = getUser();
    if (!user) return;

    setIsUploading(true);
    try {
      // 1. Delete from Supabase Storage avatars bucket using extracted filePath or user prefix
      if (avatarUrl) {
        try {
          // Extract file path from publicUrl (e.g. .../avatars/user-id/avatar.jpg -> user-id/avatar.jpg)
          const urlObj = new URL(avatarUrl.split("?")[0]);
          const parts = urlObj.pathname.split(`/${AVATAR_BUCKET}/`);
          if (parts[1]) {
            const filePath = decodeURIComponent(parts[1]);
            await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);
          }
        } catch {
          // Fallback to removing standard user avatars
          const extensions = ["jpg", "jpeg", "png", "webp", "gif"];
          const filesToRemove = extensions.map((ext) => `${user.id}/avatar.${ext}`);
          await supabase.storage.from(AVATAR_BUCKET).remove(filesToRemove);
        }
      }

      // 2. Direct Supabase / Backend database update to set avatar_url: null
      try {
        await supabase
          .from("users")
          .update({ avatar_url: null })
          .eq("id", user.id);
      } catch {
        /* fallback to backend api if direct table RLS is restricted */
      }

      // Also sync through backend API endpoint
      await api.updateProfile({ avatar_url: null });

      // 3. Update React state immediately so UI switches back to initials fallback
      setAvatarUrl(null);
      window.dispatchEvent(new Event("salon-profile-updated"));
      window.dispatchEvent(new Event("salon-auth-change"));
      window.dispatchEvent(new Event("salon-admin-auth-change"));
      toast.success("Profile photo removed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove photo";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  // ── Save profile ────────────────────────────────────────────────────────────
  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoError(null);
    setInfoSuccess(false);
    setFieldErrors({});
    const fe: Record<string, string> = {};
    const trimName = name.trim();
    const trimPhone = phone.trim().replace(/\D/g, "");
    if (trimName.split(" ").length < 2) fe.name = "Please enter your first and last name";
    if (!INDIAN_PHONE_RE.test(trimPhone)) fe.phone = "Enter a valid 10-digit Indian mobile number";
    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      return;
    }
    setSavingInfo(true);
    try {
      const res = await api.updateProfile({ name: trimName, phone: trimPhone });
      const stored = getUser();
      const adminStored = getAdminUser();
      const token = getAdminToken() ?? getToken() ?? "";
      if (stored) {
        setSession(
          token,
          { ...stored, name: res.user.name, avatar_url: res.profile.avatar_url ?? stored.avatar_url },
          localStorage.getItem("salon_remember") === "1",
        );
      }
      if (adminStored) {
        setAdminSession(
          token,
          { ...adminStored, name: res.user.name, avatar_url: res.profile.avatar_url ?? adminStored.avatar_url },
        );
      }
      window.dispatchEvent(new Event("salon-profile-updated"));
      window.dispatchEvent(new Event("salon-auth-change"));
      window.dispatchEvent(new Event("salon-admin-auth-change"));
      setName(res.profile.name);
      setPhone(res.profile.phone);
      setInfoSuccess(true);
      setTimeout(() => setInfoSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      try {
        const p = JSON.parse(msg);
        if (p.errors) {
          setFieldErrors(p.errors);
          return;
        }
      } catch {
        /**/
      }
      setInfoError(msg);
    } finally {
      setSavingInfo(false);
    }
  }

  // ── Change password ─────────────────────────────────────────────────────────
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    setFieldErrors({});
    const fe: Record<string, string> = {};
    if (!currentPw) fe.current_password = "Enter your current password";
    if (!newPw) fe.new_password = "Enter a new password";
    else if (!STRONG_PW_RE.test(newPw))
      fe.new_password = "Min 8 chars — uppercase, lowercase, number & special character";
    if (newPw && newPw !== confirmPw) fe.confirm_password = "Passwords do not match";
    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      return;
    }
    setSavingPw(true);
    try {
      await api.updateProfile({ current_password: currentPw, new_password: newPw });
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Password change failed";
      try {
        const p = JSON.parse(msg);
        if (p.errors) {
          setFieldErrors(p.errors);
          return;
        }
      } catch {
        /**/
      }
      setPwError(msg);
    } finally {
      setSavingPw(false);
    }
  }

  // ── Delete account ──────────────────────────────────────────────────────────
  async function doDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (deleteConfirm !== "DELETE") {
      setDeleteError('Type "DELETE" to confirm');
      return;
    }
    if (!deletePw) {
      setDeleteError("Enter your password to confirm");
      return;
    }
    setDeleting(true);
    try {
      await api.deleteAccount(deletePw);
      clearSession();
      window.dispatchEvent(new Event("salon-auth-change"));
      navigate({ to: "/" });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeleting(false);
    }
  }

  // ── Delete archive ──────────────────────────────────────────────────────────
  async function deleteArchive(filename: string) {
    setArchiveToDelete(null);
    setDeletingArchive(filename);
    try {
      await api.adminDeleteArchive(filename);
      setArchivesData((prev) => prev.filter((f) => f.name !== filename));
      toast.success(`Archive "${filename}" deleted successfully.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete archive.");
    } finally {
      setDeletingArchive(null);
    }
  }

  if (!sessionUser) return null;

  const tabs: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Edit Profile", icon: <User className="h-4 w-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
    { id: "password", label: "Change Password", icon: <Lock className="h-4 w-4" /> },
    ...(role === "ADMIN" ? [{ id: "storage", label: "Storage", icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg> } as { id: Section; label: string; icon: React.ReactNode }] : []),
    { id: "danger", label: "Danger Zone", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  useEffect(() => {
    if (activeSection === "storage" && role === "ADMIN") {
      setLoadingStorage(true);
      Promise.all([
        api.adminGetStorage().catch(console.error),
        api.adminGetArchives().catch(console.error)
      ]).then(([storageRes, archivesRes]) => {
        if (storageRes) setStorageData(storageRes);
        if (archivesRes) setArchivesData(archivesRes);
      }).finally(() => setLoadingStorage(false));
    }
  }, [activeSection, role]);

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: BG }}>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4 animate-fade-up">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-md"
            style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
          >
            <SettingsIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
            >
              Account Settings
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm" style={{ color: "oklch(0.55 0.04 50)" }}>
                {email}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background:
                    role === "ADMIN" ? "oklch(0.35 0.15 22 / 8%)" : "oklch(0.92 0.030 83 / 60%)",
                  color: role === "ADMIN" ? BURGUNDY : "oklch(0.55 0.04 50)",
                  border: `1px solid ${role === "ADMIN" ? "oklch(0.35 0.15 22 / 18%)" : "oklch(0.84 0.042 80 / 60%)"}`,
                }}
              >
                {role === "ADMIN" && (
                  <ShieldCheck className="h-2.5 w-2.5" style={{ color: GOLD }} />
                )}
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
                  background:
                    activeSection === t.id
                      ? t.id === "danger"
                        ? "oklch(0.577 0.245 27.325 / 8%)"
                        : `linear-gradient(135deg, ${BURGUNDY}/8%, ${GOLD}/5%)`
                      : "transparent",
                  color:
                    activeSection === t.id
                      ? t.id === "danger"
                        ? ERROR_COLOR
                        : BURGUNDY
                      : "oklch(0.50 0.04 50)",
                  border: `1px solid ${
                    activeSection === t.id
                      ? t.id === "danger"
                        ? "oklch(0.577 0.245 27.325 / 20%)"
                        : "oklch(0.35 0.15 22 / 15%)"
                      : "transparent"
                  }`,
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
                <h2
                  className="mb-5 text-base font-semibold"
                  style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                >
                  Edit Profile
                </h2>
                {loadingProfile ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: BURGUNDY }} />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Avatar with Google-style dropdown menu */}
                    <div className="flex flex-col items-center justify-center pb-2">
                      <div ref={avatarContainerRef} className="relative">
                        {/* Circle Avatar (clickable to toggle menu) */}
                        <div
                          onClick={() => !isUploading && setIsAvatarMenuOpen((prev) => !prev)}
                          className="h-24 w-24 rounded-full overflow-hidden shadow-md ring-4 ring-[oklch(0.88_0.030_82)] cursor-pointer transition-transform hover:opacity-95"
                          title="Click to manage profile photo"
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={`${name || "User"} avatar`}
                              className="h-full w-full object-cover"
                              onError={() => setAvatarUrl(null)}
                            />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center text-2xl font-bold select-none"
                              style={{
                                background: initialsColor(getInitials(name || sessionUser?.name || "?")),
                                color: BURGUNDY,
                              }}
                            >
                              {getInitials(name || sessionUser?.name || "?")}
                            </div>
                          )}

                          {isUploading && (
                            <div
                              className="absolute inset-0 flex items-center justify-center rounded-full"
                              style={{ background: "oklch(0 0 0 / 45%)" }}
                            >
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>

                        {/* Circular Pencil Icon button at bottom-right */}
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAvatarMenuOpen((prev) => !prev);
                          }}
                          aria-label="Edit profile photo"
                          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md p-1 border transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                          style={{ borderColor: "oklch(0.88 0.030 82)" }}
                        >
                          <Pencil className="h-4 w-4" style={{ color: BURGUNDY }} />
                        </button>

                        {/* Hidden camera capture input (Take photo - forces front camera) */}
                        <input
                          ref={cameraRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          hidden
                          onChange={handleAvatarChange}
                          aria-label="Take photo with camera"
                        />

                        {/* Hidden standard gallery file input (Upload photo - opens gallery/files) */}
                        <input
                          ref={galleryRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={handleAvatarChange}
                          aria-label="Upload photo from files"
                        />

                        {/* Google-style Dropdown Menu */}
                        {isAvatarMenuOpen && (
                          <div
                            className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl border animate-fade-up"
                            style={{ borderColor: "oklch(0.88 0.030 82)" }}
                          >
                            <div className="space-y-1">
                              {/* 1. View photo */}
                              {avatarUrl ? (
                                <a
                                  href={avatarUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => setIsAvatarMenuOpen(false)}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  <ExternalLink className="h-4 w-4 text-gray-500" />
                                  <span>View photo</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
                                >
                                  <ExternalLink className="h-4 w-4 text-gray-300" />
                                  <span>View photo</span>
                                </button>
                              )}

                              {/* 2. Take photo */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAvatarMenuOpen(false);
                                  // If browser supports getUserMedia (desktop webcam or modern mobile), open live camera modal
                                  if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
                                    setIsWebcamOpen(true);
                                  } else {
                                    cameraRef.current?.click();
                                  }
                                }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <Camera className="h-4 w-4 text-gray-500" />
                                <span>Take photo</span>
                              </button>

                              {/* 3. Upload photo */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAvatarMenuOpen(false);
                                  galleryRef.current?.click();
                                }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <ImageIcon className="h-4 w-4 text-gray-500" />
                                <span>Upload photo</span>
                              </button>

                              {/* 4. Remove photo */}
                              {avatarUrl && (
                                <>
                                  <div className="my-1 border-t" style={{ borderColor: "oklch(0.92 0.02 85)" }} />
                                  <button
                                    type="button"
                                    onClick={handleRemoveAvatar}
                                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4 text-rose-500" />
                                    <span>Remove photo</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Camera Viewfinder Modal */}
                    {isWebcamOpen && (
                      <WebcamAvatarModal
                        onCapture={(file) => uploadAvatarFile(file)}
                        onClose={() => setIsWebcamOpen(false)}
                      />
                    )}

                    <form onSubmit={saveInfo} className="space-y-4">
                      {infoSuccess && <Banner type="success" msg="Profile updated successfully!" />}
                      {infoError && <Banner type="error" msg={infoError} />}

                    {/* Email (read-only) */}
                    <div className="space-y-1.5">
                      <label
                        className="block text-xs font-semibold uppercase tracking-widest"
                        style={{ color: "oklch(0.60 0.04 55)" }}
                      >
                        Email Address
                      </label>
                      <div
                        className="relative flex items-center rounded-xl"
                        style={{
                          background: "oklch(0.93 0.020 83 / 40%)",
                          border: `1px solid ${BORDER}`,
                        }}
                      >
                        <input
                          type="email"
                          value={email}
                          readOnly
                          disabled
                          className="w-full bg-transparent px-3 py-3 pr-28 sm:pr-32 truncate text-sm outline-none cursor-not-allowed"
                          style={{ color: "oklch(0.55 0.04 50)" }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-gray-400 whitespace-nowrap pointer-events-none">
                          Cannot change
                        </span>
                      </div>
                    </div>

                    <InputField
                      label="Full Name"
                      icon={<User className="h-4 w-4" />}
                      error={fieldErrors.name}
                      value={name}
                      onChange={(v) => {
                        setName(v);
                        setFieldErrors((p) => ({ ...p, name: "" }));
                      }}
                      placeholder="Your full name"
                    />
                    <InputField
                      label="Phone Number"
                      icon={<Phone className="h-4 w-4" />}
                      error={fieldErrors.phone}
                      value={phone}
                      onChange={(v) => {
                        setPhone(v);
                        setFieldErrors((p) => ({ ...p, phone: "" }));
                      }}
                      placeholder="10-digit mobile number"
                      type="tel"
                    />

                    <button
                      type="submit"
                      disabled={savingInfo}
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-70"
                      style={{
                        background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
                        color: "oklch(0.99 0.01 85)",
                      }}
                    >
                      {savingInfo ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                    </form>
                  </div>
                )}
              </Card>
            )}

            {/* ── Notifications ── */}
            {activeSection === "notifications" && (
              <Card gradient={`linear-gradient(90deg, ${BURGUNDY}, ${GOLD})`}>
                {notifSubTab === "history" ? (
                  /* ── Notification History Sub-View ── */
                  <div>
                    {/* Clean Top Action Bar */}
                    <div className="flex items-center justify-between border-b pb-3 mb-5" style={{ borderColor: BORDER }}>
                      <button
                        type="button"
                        onClick={() => setNotifSubTab("preferences")}
                        className="flex items-center gap-2 text-xs sm:text-sm font-semibold transition-opacity hover:opacity-80 cursor-pointer"
                        style={{ color: BURGUNDY }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>
                      <div className="flex items-center gap-3">
                        {/* Icon-only refresh button (rotating arrow) */}
                        <button
                          type="button"
                          onClick={loadNotifHistory}
                          title="Refresh notifications"
                          aria-label="Refresh notifications"
                          disabled={loadingNotifHistory}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-black/5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RotateCw className={cn("h-4 w-4", loadingNotifHistory && "animate-spin")} style={{ color: BURGUNDY }} />
                        </button>
                        {historyNotifications.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowClearConfirm(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Clear</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dedicated Title and Description with comfortable spacing */}
                    <div className="mb-5 space-y-1">
                      <h2
                        className="text-base sm:text-lg font-bold leading-tight"
                        style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                      >
                        Notification History
                      </h2>
                      <p className="text-xs text-muted-foreground leading-normal">
                        Past alerts and appointment updates for your account.
                      </p>
                    </div>

                    {showClearConfirm && (
                      <div
                        className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl p-3 border"
                        style={{
                          background: "oklch(0.98 0.02 25)",
                          borderColor: "oklch(0.577 0.245 27.325 / 30%)",
                        }}
                      >
                        <div className="flex items-center gap-2 text-xs text-red-900 font-medium">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                          <span>Clear all {historyNotifications.length} notification{historyNotifications.length > 1 ? "s" : ""}? This cannot be undone.</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end shrink-0">
                          <button
                            type="button"
                            disabled={clearingHistory}
                            onClick={() => setShowClearConfirm(false)}
                            className="px-2.5 py-1 text-xs rounded-lg border bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                            style={{ borderColor: BORDER }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={clearingHistory}
                            onClick={handleClearHistory}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg text-white font-medium bg-red-600 hover:bg-red-700 transition-colors shadow-xs"
                          >
                            {clearingHistory ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Clearing…</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-3 w-3" />
                                <span>Yes, Clear All</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {loadingNotifHistory ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: BURGUNDY }} />
                        <span className="text-xs">Loading past notifications…</span>
                      </div>
                    ) : historyNotifications.length === 0 ? (
                      <div
                        className="flex flex-col items-center justify-center gap-2 py-12 rounded-xl border border-dashed text-center"
                        style={{ borderColor: BORDER, background: "oklch(0.99 0.005 85)" }}
                      >
                        <History className="h-7 w-7 opacity-30" style={{ color: BURGUNDY }} />
                        <p className="text-sm font-medium text-gray-700">No past notifications</p>
                        <p className="text-xs text-muted-foreground">
                          Older notifications will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                        {historyNotifications.map((n) => {
                          const dateObj = new Date(
                            n.created_at.replace(" ", "T") +
                              (n.created_at.includes("Z") || n.created_at.includes("+") ? "" : "Z")
                          );
                          const formattedDate = dateObj.toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "Asia/Kolkata",
                          });

                          return (
                            <div
                              key={n.id}
                              className="flex items-start gap-3 rounded-xl p-3.5 transition-all"
                              style={{
                                background: n.is_read ? "oklch(0.99 0.005 85)" : "oklch(0.97 0.02 85)",
                                border: `1px solid ${n.is_read ? BORDER : `${BURGUNDY}30`}`,
                              }}
                            >
                              <div
                                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                style={{
                                  background:
                                    n.type === "new_booking"
                                      ? "oklch(0.35 0.15 22 / 10%)"
                                      : "oklch(0.68 0.13 68 / 10%)",
                                  color: n.type === "new_booking" ? BURGUNDY : GOLD,
                                }}
                              >
                                {n.type === "new_booking" ? (
                                  <Calendar className="h-4 w-4" />
                                ) : n.type === "appointment_reminder" ? (
                                  <Clock className="h-4 w-4" />
                                ) : n.type === "booking_status_update" ? (
                                  <Info className="h-4 w-4" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 pr-1">
                                <p className="text-xs font-medium text-gray-800 leading-relaxed">
                                  {n.message}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500">{formattedDate}</span>
                                  {n.is_read ? (
                                    <span className="text-[10px] text-gray-400">&bull; Read</span>
                                  ) : (
                                    <span
                                      className="text-[10px] font-semibold"
                                      style={{ color: BURGUNDY }}
                                    >
                                      &bull; New
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                title="Delete notification"
                                aria-label="Delete notification"
                                disabled={deletingNotifId === n.id}
                                onClick={() => handleDeleteNotification(n.id)}
                                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                {deletingNotifId === n.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Streamlined 3-Option Notification Settings ── */
                  <div>
                    <h2
                      className="mb-1 text-base font-semibold"
                      style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                    >
                      Notifications
                    </h2>
                    <p className="mb-5 text-xs text-muted-foreground">
                      Manage sound alerts, device permissions, and past history.
                    </p>

                    <div className="divide-y" style={{ borderColor: BORDER }}>
                      {/* Option 1: Notification Sounds */}
                      <div className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-xl"
                            style={{
                              background: alertSoundEnabled
                                ? "oklch(0.42 0.18 150 / 12%)"
                                : "oklch(0.50 0.04 50 / 10%)",
                              color: alertSoundEnabled ? SUCCESS_COLOR : "oklch(0.50 0.04 50)",
                            }}
                          >
                            {alertSoundEnabled ? (
                              <Volume2 className="h-5 w-5" />
                            ) : (
                              <VolumeX className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-900 block truncate">
                              Notification Sounds
                            </span>
                            <span className="text-xs text-muted-foreground block truncate">
                              {alertSoundEnabled ? "Sounds are turned on" : "Sounds are muted"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          id="alert-sound-toggle-btn"
                          onClick={toggleAlertSounds}
                          className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-2"
                          style={{
                            backgroundColor: alertSoundEnabled ? SUCCESS_COLOR : "oklch(0.85 0.02 85)",
                            boxShadow: alertSoundEnabled
                              ? `0 0 0 2px oklch(0.998 0.004 85), 0 0 0 4px ${SUCCESS_COLOR}`
                              : "none",
                          }}
                          role="switch"
                          aria-checked={alertSoundEnabled}
                          aria-label="Toggle Notification Sounds"
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                              alertSoundEnabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Option 2: Allow Notifications */}
                      <div className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-xl"
                            style={{
                              background: pushEnabled
                                ? "oklch(0.42 0.18 150 / 12%)"
                                : "oklch(0.50 0.04 50 / 10%)",
                              color: pushEnabled ? SUCCESS_COLOR : "oklch(0.50 0.04 50)",
                            }}
                          >
                            <Bell className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-900 block truncate">
                              Allow Notifications
                            </span>
                            <span className="text-xs text-muted-foreground block truncate">
                              {pushEnabled ? "Device notifications enabled" : "Device notifications disabled"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            if (savingPush) return;
                            const nextState = !pushEnabled;
                            // 1. Flip state immediately for instant visual feedback
                            setPushEnabled(nextState);
                            // 2. Fire toast RIGHT NOW — before any async work
                            const toastId = "push-toggle";
                            if (nextState) {
                              toast.loading("Enabling notifications…", { id: toastId, duration: 8000 });
                            } else {
                              toast.success("Notifications turned off.", { id: toastId, duration: 2500 });
                            }
                            setSavingPush(true);

                            try {
                              if (nextState) {
                                const permission = await Notification.requestPermission();
                                if (permission === "denied") {
                                  setPushEnabled(false);
                                  toast.error("Notifications blocked. Please allow them in your browser settings.", { id: toastId });
                                  return;
                                }
                                if (permission !== "granted") {
                                  setPushEnabled(false);
                                  toast.dismiss(toastId);
                                  return;
                                }
                                const result = await subscribeToPush();
                                if (result === "granted" || result === "already") {
                                  await api.updateProfile({ push_enabled: true });
                                  queryClient.invalidateQueries({ queryKey: ["profile"] });
                                  toast.success("Notifications allowed!", { id: toastId, duration: 2500 });
                                } else {
                                  setPushEnabled(false);
                                  toast.error("Failed to enable notifications. Please try again.", { id: toastId });
                                }
                              } else {
                                await unsubscribeFromPush();
                                await api.updateProfile({ push_enabled: false });
                                queryClient.invalidateQueries({ queryKey: ["profile"] });
                                // Toast already shown above — no-op
                              }
                            } catch (e) {
                              setPushEnabled(!nextState);
                              console.error("[push toggle]", e);
                              toast.error(
                                e instanceof Error ? e.message : "An unexpected error occurred.",
                                { id: toastId },
                              );
                            } finally {
                              setSavingPush(false);
                            }
                          }}
                          className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-2"
                          style={{
                            backgroundColor: pushEnabled ? SUCCESS_COLOR : "oklch(0.85 0.02 85)",
                            boxShadow: pushEnabled
                              ? `0 0 0 2px oklch(0.998 0.004 85), 0 0 0 4px ${SUCCESS_COLOR}`
                              : "none",
                          }}
                          role="switch"
                          aria-checked={pushEnabled}
                          aria-label="Toggle Allow Notifications"
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                              pushEnabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Option: Notification Reminder */}
                      <div className="flex flex-col gap-3 py-4 border-t border-b border-border/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div
                              className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-xl"
                              style={{
                                background: "oklch(0.68 0.13 68 / 15%)",
                                color: GOLD,
                              }}
                            >
                              <Clock className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-gray-900 block truncate">
                                Notification Reminder
                              </span>
                              <span className="text-xs text-muted-foreground block">
                                Choose how soon before your visit you wish to be notified
                              </span>
                            </div>
                          </div>

                          <div className="w-full sm:w-56 shrink-0">
                            <Select
                              value={isCustomReminder ? "custom" : String(defaultReminderMinutes)}
                              onValueChange={handleReminderSelect}
                            >
                              <SelectTrigger className="w-full h-10 bg-background text-xs font-medium">
                                <SelectValue placeholder="Select reminder">
                                  {isCustomReminder
                                    ? `Custom: ${customReminderVal} ${customReminderUnit} before`
                                    : formatReminderLabel(defaultReminderMinutes)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {REMINDER_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                                <SelectItem value="custom" className="text-xs font-semibold text-primary">
                                  {isCustomReminder
                                    ? `⏱️ Custom (${customReminderVal} ${customReminderUnit} before)`
                                    : "⏱️ Custom time..."}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Inline Custom Reminder Controls with explicit Save Button */}
                        {isCustomReminder && (
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-primary/20 bg-primary/5 text-xs animate-fade-in sm:ml-13.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="font-semibold text-foreground shrink-0 text-xs">Remind me:</span>
                              <div className="flex flex-col gap-1">
                                <Input
                                  type="number"
                                  min={1}
                                  max={customReminderUnit === "days" ? 30 : customReminderUnit === "hours" ? 72 : 1440}
                                  value={customReminderVal}
                                  onChange={(e) => handleCustomValChange(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveCustomReminder();
                                    }
                                  }}
                                  placeholder="e.g. 30"
                                  className={cn(
                                    "h-8.5 w-18 text-center text-xs font-semibold bg-background border-border rounded-lg",
                                    customReminderError && "border-destructive focus-visible:ring-destructive"
                                  )}
                                />
                              </div>
                              <div className="flex rounded-lg border border-border bg-background p-0.5">
                                {(["mins", "hours", "days"] as const).map((unit) => (
                                  <button
                                    key={unit}
                                    type="button"
                                    onClick={() => handleCustomUnitChange(unit)}
                                    className={cn(
                                      "px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition cursor-pointer",
                                      customReminderUnit === unit
                                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {unit}
                                  </button>
                                ))}
                              </div>
                              <span className="text-[11px] text-muted-foreground">before appointment</span>
                            </div>
                            {customReminderError && (
                              <p className="w-full text-[11px] font-medium text-destructive mt-1 pl-0.5">
                                ⚠ {customReminderError}
                              </p>
                            )}

                            {/* Explicit Save Button */}
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleSaveCustomReminder}
                              className="h-8.5 px-4 text-xs font-semibold rounded-xl shrink-0 gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ml-auto"
                              style={{
                                background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})`,
                                color: "white",
                              }}
                            >
                              {customReminderSaved ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                                  <span>Saved</span>
                                </>
                              ) : (
                                <>
                                  <Save className="h-3.5 w-3.5" />
                                  <span>Save</span>
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Option 3: Notification History */}
                      <button
                        type="button"
                        onClick={() => {
                          setNotifSubTab("history");
                          loadNotifHistory();
                        }}
                        className="w-full flex items-center justify-between py-4 text-left transition-colors hover:bg-black/[0.02] rounded-xl px-1"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-xl"
                            style={{
                              background: "oklch(0.35 0.15 22 / 8%)",
                              color: BURGUNDY,
                            }}
                          >
                            <History className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-900 block truncate">
                              Notification History
                            </span>
                            <span className="text-xs text-muted-foreground block truncate">
                              View all past alerts and appointment updates
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* ── Change Password ── */}
            {activeSection === "password" && (
              <Card gradient={`linear-gradient(90deg, ${GOLD}, ${BURGUNDY})`}>
                <h2
                  className="mb-5 text-base font-semibold"
                  style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                >
                  Change Password
                </h2>
                <form onSubmit={changePassword} className="space-y-4">
                  {pwSuccess && <Banner type="success" msg="Password changed successfully!" />}
                  {pwError && <Banner type="error" msg={pwError} />}

                  <PwField
                    id="cur-pw"
                    label="Current Password"
                    value={currentPw}
                    onChange={setCurrentPw}
                    show={showCurrent}
                    onToggle={() => setShowCurrent((v) => !v)}
                    error={fieldErrors.current_password}
                    onClear={() => setFieldErrors((p) => ({ ...p, current_password: "" }))}
                  />
                  <PwField
                    id="new-pw"
                    label="New Password"
                    value={newPw}
                    onChange={setNewPw}
                    show={showNew}
                    onToggle={() => setShowNew((v) => !v)}
                    error={fieldErrors.new_password}
                    onClear={() => setFieldErrors((p) => ({ ...p, new_password: "" }))}
                    hint="Min 8 chars — uppercase, lowercase, number & special character"
                  />
                  <PwField
                    id="conf-pw"
                    label="Confirm New Password"
                    value={confirmPw}
                    onChange={setConfirmPw}
                    show={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    error={fieldErrors.confirm_password}
                    onClear={() => setFieldErrors((p) => ({ ...p, confirm_password: "" }))}
                  />

                  <button
                    type="submit"
                    disabled={savingPw}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-70"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                      color: "white",
                    }}
                  >
                    {savingPw ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </form>
              </Card>
            )}

            {/* ── Storage ── */}
            {activeSection === "storage" && role === "ADMIN" && (
              <Card gradient={`linear-gradient(90deg, ${BURGUNDY}, ${GOLD})`}>
                <h2
                  className="mb-5 text-base font-semibold"
                  style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}
                >
                  Storage
                </h2>

                {loadingStorage ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: BURGUNDY }} />
                  </div>
                ) : storageData ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-700">Storage Used</span>
                      <span className="font-medium text-gray-900">{storageData.used_mb} MB / {storageData.total_mb} MB Used</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          storageData.used_mb / storageData.total_mb > 0.9 ? 'bg-red-500' :
                          storageData.used_mb / storageData.total_mb > 0.7 ? 'bg-yellow-400' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, (storageData.used_mb / storageData.total_mb) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <Banner type="error" msg="Failed to load storage data" />
                )}

                {/* Historical Data Archives */}
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b pb-2">Historical Data Archives</h3>
                  {archivesData.length > 0 ? (
                    <div className="space-y-3">
                      {archivesData.map((file) => (
                        <div key={file.name} className="flex items-center justify-between p-3 bg-white/50 border border-gray-100 rounded-xl hover:bg-white transition-colors duration-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0">
                              <FileText className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                              <p className="text-xs text-gray-400">
                                {file.created_at ? new Date(file.created_at).toLocaleDateString() : ""} • {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                            <button
                              id={`delete-archive-${file.name}`}
                              onClick={() => setArchiveToDelete(file.name)}
                              disabled={deletingArchive === file.name}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingArchive === file.name ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              {deletingArchive === file.name ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 bg-white/40 p-4 rounded-xl text-center border border-dashed border-gray-200">
                      No historical archives available yet. Archives are automatically generated when the database reaches 400 MB.
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* ── Delete Archive Confirmation Modal ── */}
            {archiveToDelete && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: "oklch(0.10 0.03 50 / 60%)" }}
                onClick={() => setArchiveToDelete(null)}
              >
                <div
                  className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fade-up"
                  style={{ background: CARD_BG, border: `1px solid oklch(0.577 0.245 27.325 / 30%)` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Red top bar */}
                  <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, oklch(0.577 0.245 27.325), oklch(0.65 0.20 28))" }} />
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "oklch(0.577 0.245 27.325 / 10%)" }}>
                        <AlertTriangle className="h-5 w-5" style={{ color: ERROR_COLOR }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: ERROR_COLOR }}>Delete Archive?</h3>
                        <p className="text-xs" style={{ color: "oklch(0.55 0.04 50)" }}>This action cannot be undone.</p>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed" style={{ color: "oklch(0.40 0.04 50)" }}>
                      Are you sure you want to delete{" "}
                      <span className="font-semibold" style={{ color: BURGUNDY }}>«{archiveToDelete}»</span>?
                    </p>
                    <div
                      className="flex items-start gap-2 rounded-xl p-3 text-xs"
                      style={{ background: "oklch(0.577 0.245 27.325 / 6%)", border: "1px solid oklch(0.577 0.245 27.325 / 20%)" }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: ERROR_COLOR }} />
                      <span style={{ color: ERROR_COLOR }}>
                        Please ensure you have <strong>downloaded this file</strong> first. Once deleted from Supabase storage it cannot be recovered.
                      </span>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setArchiveToDelete(null)}
                        className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
                        style={{ background: "oklch(0.93 0.020 83 / 60%)", border: `1px solid ${BORDER}`, color: "oklch(0.40 0.04 50)" }}
                      >
                        Cancel
                      </button>
                      <button
                        id="confirm-delete-archive"
                        onClick={() => deleteArchive(archiveToDelete)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] shadow-lg"
                        style={{ background: "linear-gradient(135deg, oklch(0.577 0.245 27.325), oklch(0.65 0.20 28))" }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Yes, Delete It
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Danger Zone ── */}
            {activeSection === "danger" && (
              <div
                className="overflow-hidden rounded-3xl shadow-xl"
                style={{
                  background: CARD_BG,
                  border: "1.5px solid oklch(0.577 0.245 27.325 / 30%)",
                  boxShadow: "0 8px 40px oklch(0.577 0.245 27.325 / 10%)",
                }}
              >
                <div
                  className="h-1.5 w-full"
                  style={{
                    background:
                      "linear-gradient(90deg, oklch(0.577 0.245 27.325), oklch(0.65 0.20 28))",
                  }}
                />
                <div className="p-8 space-y-5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" style={{ color: ERROR_COLOR }} />
                    <h2
                      className="text-base font-semibold"
                      style={{ color: ERROR_COLOR, fontFamily: "var(--font-serif)" }}
                    >
                      Delete Account
                    </h2>
                  </div>

                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.45 0.04 50)" }}>
                    This action <strong>cannot be undone</strong>. Your account, all personal data,
                    and any upcoming bookings will be permanently deleted. Upcoming confirmed
                    bookings will be automatically cancelled.
                  </p>

                  {deleteError && <Banner type="error" msg={deleteError} />}

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        className="block text-xs font-semibold uppercase tracking-widest"
                        style={{ color: ERROR_COLOR }}
                      >
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

                    <PwField
                      id="del-pw"
                      label="Confirm with your password"
                      value={deletePw}
                      onChange={setDeletePw}
                      show={showDeletePw}
                      onToggle={() => setShowDeletePw((v) => !v)}
                      onClear={() => setDeleteError(null)}
                      danger
                    />

                    <button
                      type="button"
                      onClick={doDelete}
                      disabled={
                        deleting ||
                        (deleteConfirm !== "DELETE" && deleteConfirm !== "delete") ||
                        !deletePw
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.577 0.245 27.325), oklch(0.65 0.20 28))",
                        color: "white",
                      }}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete My Account
                        </>
                      )}
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

function Card({ children, gradient }: { children: React.ReactNode; gradient?: string }) {
  return (
    <div
      className="overflow-hidden rounded-3xl shadow-xl"
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 8px 40px oklch(0.35 0.15 22 / 10%)",
      }}
    >
      <div className="p-8">{children}</div>
    </div>
  );
}

function Banner({ type, msg }: { type: "success" | "error"; msg: string }) {
  const isSuccess = type === "success";
  return (
    <div
      className="flex items-center gap-2 rounded-xl p-3 text-sm"
      style={{
        background: isSuccess ? "oklch(0.42 0.18 150 / 8%)" : "oklch(0.577 0.245 27.325 / 8%)",
        border: `1px solid ${isSuccess ? "oklch(0.42 0.18 150 / 25%)" : "oklch(0.577 0.245 27.325 / 25%)"}`,
        color: isSuccess ? SUCCESS_COLOR : ERROR_COLOR,
      }}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 flex-shrink-0" />
      )}
      {msg}
    </div>
  );
}

function InputField({
  label,
  icon,
  error,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  icon: React.ReactNode;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  return (
    <div className="space-y-1.5">
      <label
        className="block text-xs font-semibold uppercase tracking-widest"
        style={{ color: hasError ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-150"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: CARD_BG,
          border: `1px solid ${hasError ? "oklch(0.577 0.245 27.325)" : focused ? GOLD : BORDER}`,
          boxShadow: focused
            ? `0 0 0 3px ${hasError ? "oklch(0.577 0.245 27.325 / 12%)" : "oklch(0.68 0.13 68 / 14%)"}`
            : "none",
        }}
      >
        <span
          className="flex-shrink-0"
          style={{ color: hasError ? ERROR_COLOR : focused ? GOLD : "oklch(0.62 0.04 55)" }}
        >
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent pl-2 text-sm outline-none"
          style={{ color: "oklch(0.25 0.05 50)" }}
        />
        {hasError && <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: ERROR_COLOR }} />}
      </div>
      {hasError && (
        <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}>
          <XCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function PwField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  error,
  onClear,
  hint,
  danger,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
  onClear: () => void;
  hint?: string;
  danger?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const accentColor = danger ? "oklch(0.577 0.245 27.325)" : GOLD;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-widest"
        style={{ color: hasError ? ERROR_COLOR : "oklch(0.50 0.06 48)" }}
      >
        {label}
      </label>
      {/* Outer focus-ring wrapper */}
      <div
        className="rounded-xl transition-all duration-150"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: CARD_BG,
          border: `1px solid ${hasError ? "oklch(0.577 0.245 27.325)" : focused ? accentColor : BORDER}`,
          boxShadow: focused
            ? `0 0 0 3px ${hasError ? "oklch(0.577 0.245 27.325 / 12%)" : `${accentColor}22`}`
            : "none",
        }}
      >
        {/* Inner row: lock icon + input + eye button all inside the border */}
        <div className="relative flex w-full items-center px-3 py-3">
          <Lock
            className="h-4 w-4 flex-shrink-0"
            style={{ color: hasError ? ERROR_COLOR : focused ? accentColor : "oklch(0.62 0.04 55)" }}
          />
          <input
            id={id}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              onClear();
            }}
            placeholder="••••••••"
            className="w-full bg-transparent pl-2 pr-10 text-sm outline-none"
            style={{ color: "oklch(0.25 0.05 50)" }}
          />
          <button
            type="button"
            onClick={onToggle}
            tabIndex={-1}
            aria-label={show ? "Hide" : "Show"}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity hover:opacity-70"
            style={{ color: "oklch(0.60 0.04 50)" }}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {hasError && (
        <p className="flex items-center gap-1 text-xs" style={{ color: ERROR_COLOR }}>
          <XCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      {!hasError && hint && (
        <p className="text-xs" style={{ color: "oklch(0.68 0.04 55)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Webcam Modal for Profile Photo ───────────────────────────────────────────
function WebcamAvatarModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Camera is not supported on this browser or connection.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" },
        audio: false,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setReady(true)).catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCamError("Camera permission was denied. Please allow camera access in browser settings.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCamError("No camera detected on this device.");
        } else {
          setCamError("Could not access camera. Please check permissions.");
        }
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    // Make it a clean square capture
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Crop center and mirror
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(file);
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl animate-fade-up"
        style={{ border: "1px solid oklch(0.88 0.030 82)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "oklch(0.92 0.02 85)" }}>
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" style={{ color: BURGUNDY }} />
            <h3 className="text-sm font-semibold" style={{ color: BURGUNDY, fontFamily: "var(--font-serif)" }}>
              Take Profile Photo
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Video stream container */}
        <div className="relative aspect-square w-full bg-black overflow-hidden flex items-center justify-center">
          {camError ? (
            <div className="p-6 text-center text-white">
              <Camera className="mx-auto mb-2 h-8 w-8 text-rose-400" />
              <p className="text-xs text-rose-300">{camError}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="-scale-x-100 h-full w-full object-cover"
              />
              {/* Circular guide outline */}
              <div
                className="pointer-events-none absolute inset-8 rounded-full border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 border-t" style={{ borderColor: "oklch(0.92 0.02 85)" }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-xs font-semibold border bg-white transition-colors hover:bg-gray-100"
            style={{ color: "oklch(0.40 0.04 50)", borderColor: "oklch(0.88 0.030 82)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || Boolean(camError)}
            onClick={snap}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${BURGUNDY}, ${BURGUNDY_MID})` }}
          >
            <Camera className="h-4 w-4" />
            Capture Photo
          </button>
        </div>
      </div>
    </div>
  );
}
