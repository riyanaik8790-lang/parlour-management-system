/**
 * Skin-Tone Colour Advisor — Mobile-First Redesign
 * @mobile single column, thumb targets, native camera, 5-colour hierarchy
 *
 * • Single vertical column optimised for smartphone screens
 * • Thumb-friendly tap targets (min 56px height)
 * • Native phone camera via capture="user" on hidden file input
 * • Results: strict 5-colour hierarchy that fits the screen
 * • Extended palette available via collapsible toggle
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { api, getToken, analyzeSkinImage } from "@/lib/api";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  X,
  Camera,
  Sun,
  RefreshCw,
  ChevronRight,
  Sparkles,
  AppWindow,
  LightbulbOff,
  Glasses,
  Droplets,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/try-on-LAPTOP-86KPKNIN")({
  head: () => ({
    meta: [
      { title: "Skin-Tone Colour Advisor – Hemangi Makeover" },
      {
        name: "description",
        content: "Discover your undertone and get personalised hair, makeup and outfit colour recommendations.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: SkinAdvisorPage,
});

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Swatch = { name: string; hex: string };
type AnalysisResult = {
  skin_tone: string;
  undertone: "warm" | "cool" | "neutral";
  hex: string;
  summary: string;
  hair: Swatch[];
  lips: Swatch[];
  blush: Swatch[];
  outfits: Swatch[];
  services: string[];
};

type PageView = "warning" | "capture" | "loading" | "results";

const UNDERTONE_GRADIENT: Record<string, string> = {
  warm: "linear-gradient(135deg,#c19a6b 0%,#b7410e 100%)",
  cool: "linear-gradient(135deg,#0f52ba 0%,#c8b6d6 100%)",
  neutral: "linear-gradient(135deg,#9caf88 0%,#6a8caf 100%)",
};

const UNDERTONE_LABEL: Record<string, string> = {
  warm: "Warm — golden / peachy",
  cool: "Cool — pink / bluish",
  neutral: "Neutral — balanced",
};

// ---------------------------------------------------------------------------
// Root page — manages view state only
// ---------------------------------------------------------------------------


function SkinAdvisorPage() {
  const [view, setView] = useState<PageView>("warning");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("skin-advisor-result");
    if (saved) {
      try {
        setResult(JSON.parse(saved));
        setView("results");
      } catch {
        sessionStorage.removeItem("skin-advisor-result");
      }
    }
  }, []);

  const runAnalysis = useCallback(async (file: File) => {
    setView("loading");
    setCaptureError(null);
    try {
      const data = (await analyzeSkinImage(file)) as unknown as AnalysisResult;
      setResult(data);
      setView("results");
      sessionStorage.setItem("skin-advisor-result", JSON.stringify(data));
      if (getToken() && data.undertone) {
        try {
          await api.saveSkinAnalysis({
            hex: data.hex,
            depth: data.skin_tone.split(" ")[0],
            undertone: data.undertone,
          });
        } catch { /* offline */ }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed. Please try a different photo.";
      setCaptureError(msg);
      toast.error(msg);
      setView("capture");
    }
  }, []);

  const handleRetake = () => {
    sessionStorage.removeItem("skin-advisor-result");
    setResult(null);
    setCaptureError(null);
    setView("capture");
  };

  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center justify-center px-4">
          <h1 className="font-serif text-lg font-semibold text-primary">
            Skin-Tone Colour Advisor
          </h1>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">
        {view === "warning" && (
          <LightingWarningScreen onProceed={() => setView("capture")} />
        )}
        {view === "capture" && (
          <CaptureSection
            onAnalyze={runAnalysis}
            onBack={() => setView("warning")}
            error={captureError}
          />
        )}
        {view === "loading" && <LoadingScreen />}
        {view === "results" && result && (
          <ResultsSection result={result} onRetake={handleRetake} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 – Lighting Warning Screen (mobile-first)
// ---------------------------------------------------------------------------

const LIGHTING_TIPS = [
  { icon: <AppWindow className="h-5 w-5" />, title: "Face a window", desc: "Natural daylight is the most accurate light source." },
  { icon: <LightbulbOff className="h-5 w-5" />, title: "Turn off yellow lights", desc: "Warm bulbs add an orange cast that skews results." },
  { icon: <Glasses className="h-5 w-5" />, title: "Remove glasses", desc: "Frames and lens reflections confuse the detector." },
  { icon: <Droplets className="h-5 w-5" />, title: "Go bare-faced", desc: "Foundation significantly changes apparent skin colour." },
];

function LightingWarningScreen({ onProceed }: { onProceed: () => void }) {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-amber-200/70 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 p-5 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <Sun className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h2 className="font-serif text-2xl text-foreground">Best results start with good light</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Spend 10 seconds on these tips before you proceed.
        </p>
      </div>

      {/* Tips list — each row is a large tap target */}
      <div className="space-y-3">
        {LIGHTING_TIPS.map((tip) => (
          <div
            key={tip.title}
            className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
            style={{ minHeight: 60 }}
          >
            <span className="shrink-0 text-muted-foreground">{tip.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">{tip.title}</div>
              <div className="text-xs text-muted-foreground">{tip.desc}</div>
            </div>
            <Check className="h-4 w-4 shrink-0 text-green-500" />
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        id="proceed-to-capture-btn"
        onClick={onProceed}
        className="flex w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white shadow-lg active:scale-95 transition-transform"
        style={{
          background: "linear-gradient(135deg,#c96b52,#a0522d)",
          minHeight: 60,
          padding: "16px",
        }}
      >
        I'm Ready - Proceed
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Device detection helper
// Returns true when running on a real mobile/tablet device.
// We combine UA sniffing with touch support — width alone is unreliable because
// desktop browsers can be resized narrow, but they still lack native camera capture.
// ---------------------------------------------------------------------------
function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  const mobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 1;
  // iPad on iOS 13+ reports as Macintosh in UA but has touch points
  return mobileUA || (hasTouch && /Macintosh/.test(ua));
}

// ---------------------------------------------------------------------------
// Step 2 – Capture (gallery + native selfie camera + webcam)
// ---------------------------------------------------------------------------

function CaptureSection({
  onAnalyze,
  onBack,
  error,
}: {
  onAnalyze: (file: File) => void;
  onBack: () => void;
  error: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [webcamMode, setWebcamMode] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  // capture="user" opens the front-facing camera directly on iOS & Android
  const cameraRef = useRef<HTMLInputElement | null>(null);

  // Detect device type once on mount (stable across re-renders)
  const [isMobile] = useState(() => isMobileDevice());

  const handleFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (!f) { setFile(null); setPreview(null); return; }
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose a PNG, JPG or WEBP image.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setWebcamMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        ← Back to lighting tips
      </button>

      {webcamMode ? (
        <WebcamCapture onCapture={handleFile} onCancel={() => setWebcamMode(false)} />
      ) : (
        <>
          {/* Preview / drop zone */}
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl border border-border">
              <img
                src={preview}
                alt="Selected photo preview"
                className="w-full object-cover"
                style={{ maxHeight: 320 }}
              />
              <button
                onClick={() => handleFile(null)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              id="skin-upload-dropzone"
              onClick={() => uploadRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 py-12 text-center active:bg-muted/60"
              style={{ minHeight: 180 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Upload className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Tap to upload</span> from gallery
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — clear, well-lit selfie</p>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {/* Native front camera — works on iOS Safari & Android Chrome */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {/* Primary action row — device-aware */}
          <div className="grid grid-cols-2 gap-3">
            {/* Gallery upload — always shown */}
            <button
              onClick={() => uploadRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold text-foreground active:scale-95 transition-transform"
              style={{ minHeight: 56, fontSize: 14 }}
            >
              <Upload className="h-4 w-4" />
              Gallery
            </button>

            {/* Mobile: native camera capture. Desktop: open webcam. */}
            {isMobile ? (
              <button
                id="open-camera-btn"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl font-semibold text-white active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(135deg,#c96b52,#a0522d)",
                  minHeight: 56,
                  fontSize: 14,
                }}
              >
                <Camera className="h-4 w-4" />
                Take Selfie
              </button>
            ) : (
              <button
                id="open-webcam-btn"
                onClick={() => setWebcamMode(true)}
                className="flex items-center justify-center gap-2 rounded-xl font-semibold text-white active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(135deg,#c96b52,#a0522d)",
                  minHeight: 56,
                  fontSize: 14,
                }}
              >
                <Camera className="h-4 w-4" />
                Use Webcam
              </button>
            )}
          </div>

          {/* On mobile, show a small hint that webcam is desktop-only */}
          {isMobile && (
            <p className="text-center text-xs text-muted-foreground">
              Upload a selfie from gallery, or tap <strong>Take Selfie</strong> to use your camera directly.
            </p>
          )}
        </>
      )}

      {/* Analyse CTA */}
      {file && !webcamMode && (
        <button
          id="analyze-photo-btn"
          onClick={() => onAnalyze(file)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl font-bold text-white shadow-lg active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg,#c96b52,#7b2a3d)",
            minHeight: 64,
            fontSize: 16,
          }}
        >
          <Sparkles className="h-5 w-5" />
          Analyse My Skin Tone
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webcam sub-component (desktop / HTTPS-mobile)
// ---------------------------------------------------------------------------

function WebcamCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    // Guard: mediaDevices is only available on secure contexts (HTTPS / localhost).
    // On plain HTTP over LAN it will be undefined — show a clear message.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError(
        "Camera access requires HTTPS. The dev server is now configured for HTTPS — " +
        "restart it and open https://<your-IP>:<port> on your phone. " +
        "Accept the self-signed certificate warning to proceed."
      );
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setReady(true));
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        // Provide a specific, actionable message for each failure mode.
        let message: string;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          message =
            "Camera permission was denied. Please tap the camera icon in your browser's address bar and allow access, then try again.";
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          message =
            "No camera found on this device. Please upload a selfie from your gallery instead.";
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          message =
            "Your camera is in use by another app. Close it and try again.";
        } else if (name === "OverconstrainedError") {
          message = "Camera resolution not supported. Try a different browser.";
        } else if (
          window.location.protocol !== "https:" &&
          window.location.hostname !== "localhost"
        ) {
          message =
            "Camera access is blocked on plain HTTP. Open this page over HTTPS (the dev server now supports it — restart it and use https://<your-IP>:<port>).";
        } else {
          message = `Camera error: ${
            err instanceof Error ? err.message : String(err)
          }. Try uploading a photo from your gallery instead.`;
        }
        setCamError(message);
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const shoot = () => {
    let n = 3;
    setCountdown(n);
    const id = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(id); setCountdown(null); snap(); }
      else setCountdown(n);
    }, 1000);
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(new File([blob], "webcam-selfie.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-black"
        style={{ aspectRatio: "4/3" }}
      >
        {camError ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 px-5 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Camera className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-destructive">Camera unavailable</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{camError}</p>
            <button
              onClick={onCancel}
              className="mt-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground"
            >
              ← Back to upload
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="-scale-x-100 block h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-56 w-40 rounded-full border-2 border-dashed border-white/40" />
            </div>
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/60 text-4xl font-bold text-white">
                  {countdown}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {!camError && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-border font-semibold text-foreground"
            style={{ minHeight: 56 }}
          >
            Cancel
          </button>
          <button
            id="webcam-shoot-btn"
            onClick={shoot}
            disabled={!ready || countdown !== null}
            className="flex items-center justify-center gap-2 rounded-xl font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#c96b52,#a0522d)", minHeight: 56 }}
          >
            <Camera className="h-4 w-4" />
            {countdown !== null ? `${countdown}…` : "Take Photo"}
          </button>
        </div>
      )}
      {!camError && (
        <p className="text-center text-xs text-muted-foreground">
          Align your face inside the oval. We'll count down 3 seconds.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 – Loading screen
// ---------------------------------------------------------------------------

const ANALYSIS_STEPS = [
  "Detecting face region…",
  "Extracting skin pixels…",
  "Converting to CIE LAB colour space…",
  "Calculating depth from L channel…",
  "Determining undertone from A/B channels…",
  "Building your personalised palette…",
];

function LoadingScreen() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)),
      750,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 py-20 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h2 className="font-serif text-2xl text-primary">Analysing your skin tone…</h2>
        <p className="mt-2 min-h-[1.5rem] text-sm text-muted-foreground transition-all duration-500">
          {ANALYSIS_STEPS[step]}
        </p>
      </div>
      <div className="flex gap-1.5">
        {ANALYSIS_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? "w-6 bg-primary" : "w-2 bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 – Results: strict 5-colour hierarchy
// ---------------------------------------------------------------------------

function ResultsSection({
  result,
  onRetake,
}: {
  result: AnalysisResult;
  onRetake: () => void;
}) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  // ── 5-colour hierarchy ──────────────────────────────────────────────────
  // Ranked by visual impact / practical importance for a salon visit:
  //   1. Detected skin swatch  (the foundation of everything)
  //   2. Hero hair shade       (biggest makeover lever)
  //   3. Signature lip colour  (daily go-to)
  //   4. Power blush           (defining face shape)
  //   5. Wardrobe anchor       (outfit base colour)
  const hierarchy: { role: string; swatch: Swatch }[] = [
    { role: "Your Skin",       swatch: { name: result.skin_tone, hex: result.hex } },
    { role: "Hero Hair",       swatch: result.hair[0]    ?? { name: "—", hex: "#aaa" } },
    { role: "Signature Lip",   swatch: result.lips[0]    ?? { name: "—", hex: "#aaa" } },
    { role: "Power Blush",     swatch: result.blush[0]   ?? { name: "—", hex: "#aaa" } },
    { role: "Wardrobe Anchor", swatch: result.outfits[0] ?? { name: "—", hex: "#aaa" } },
  ];

  const grad = UNDERTONE_GRADIENT[result.undertone];

  return (
    <div className="space-y-5">

      {/* ── Hero result card ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-1.5 w-full" style={{ background: grad }} />
        <div className="flex items-center gap-4 p-5">
          <div
            className="h-16 w-16 shrink-0 rounded-full border-4 border-background shadow-lg ring-2 ring-border"
            style={{ background: result.hex }}
            aria-label={`Detected skin colour ${result.hex}`}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your skin tone
            </div>
            <div className="mt-0.5 font-serif text-xl text-foreground">{result.skin_tone}</div>
            <div
              className="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ background: grad }}
            >
              {UNDERTONE_LABEL[result.undertone]}
            </div>
          </div>
        </div>
        <p className="border-t border-border px-5 py-3 text-sm leading-relaxed text-muted-foreground">
          {result.summary}
        </p>
      </div>

      {/* ── 5-colour hierarchy ── */}
      <div>
        <h2 className="mb-3 font-serif text-lg text-primary">Your 5-Colour Palette</h2>
        <div className="grid grid-cols-5 gap-2 pt-2">
          {hierarchy.map(({ role, swatch }, idx) => (
            <div key={role} className="flex flex-col items-center gap-1.5 text-center">
              <div className="relative">
                <div
                  className="h-14 w-14 rounded-full border-2 border-background shadow-md ring-1 ring-border"
                  style={{ background: swatch.hex }}
                  title={`${swatch.name} — ${swatch.hex}`}
                />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-foreground text-[9px] font-bold text-background">
                  {idx + 1}
                </span>
              </div>
              <span className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                {role}
              </span>
              <span className="text-[9px] leading-tight text-foreground">{swatch.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick-book cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate({ to: "/book", search: { service: "Global Hair Colour" } })}
          className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left active:bg-muted/50"
          style={{ minHeight: 80 }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hair</span>
          <span className="text-sm font-bold text-foreground">Book Colour →</span>
          <span className="text-xs text-muted-foreground">Match your palette</span>
        </button>
        <button
          onClick={() => navigate({ to: "/book", search: { service: "Engagement Look" } })}
          className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left active:bg-muted/50"
          style={{ minHeight: 80 }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Makeup</span>
          <span className="text-sm font-bold text-foreground">Book Session →</span>
          <span className="text-xs text-muted-foreground">Your shades applied</span>
        </button>
      </div>

      {/* ── Recommended services ── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-serif text-base text-primary">
          <Sparkles className="h-4 w-4" /> Recommended Services
        </h3>
        <div className="space-y-2">
          {result.services.map((svc) => (
            <button
              key={svc}
              id={`book-service-${svc.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => navigate({ to: "/book", search: { service: svc } })}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm font-medium text-foreground active:bg-muted/50"
              style={{ minHeight: 52 }}
            >
              {svc}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Extended full palette (hidden by default) ── */}
      {!showAll ? (
        <button
          onClick={() => setShowAll(true)}
          className="w-full rounded-xl border border-border bg-muted/20 py-3 text-sm font-medium text-muted-foreground active:bg-muted/50"
        >
          See full extended palette ↓
        </button>
      ) : (
        <div className="space-y-4">
          <ExtendedSwatchRow title="All Hair Shades" items={result.hair} />
          <ExtendedSwatchRow title="Lip Colours" items={result.lips} />
          <ExtendedSwatchRow title="Blush Shades" items={result.blush} />
          <ExtendedSwatchRow title="Outfit Colours" items={result.outfits} />
          <button
            onClick={() => setShowAll(false)}
            className="w-full rounded-xl border border-border bg-muted/20 py-3 text-sm text-muted-foreground"
          >
            ↑ Collapse
          </button>
        </div>
      )}

      {/* ── Manual undertone override ── */}
      <ManualOverridePanel result={result} />

      {/* ── Retake ── */}
      <button
        id="retake-btn"
        onClick={onRetake}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold text-foreground active:bg-muted/40 transition-transform active:scale-95"
        style={{ minHeight: 56 }}
      >
        <RefreshCw className="h-4 w-4" /> Retake Photo
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extended palette row — horizontally scrollable
// ---------------------------------------------------------------------------

function ExtendedSwatchRow({ title, items }: { title: string; items: Swatch[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      <div className="flex gap-3 overflow-x-auto pb-2 pt-2">
        {items.map((s) => (
          <div
            key={s.name}
            className="flex shrink-0 flex-col items-center gap-1 text-center"
            style={{ width: 60 }}
          >
            <div
              className="h-12 w-12 rounded-full border-2 border-background shadow-sm ring-1 ring-border"
              style={{ background: s.hex }}
              title={`${s.name} — ${s.hex}`}
            />
            <span className="text-[10px] leading-tight text-foreground">{s.name}</span>
            <span className="font-mono text-[9px] text-muted-foreground">{s.hex}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual undertone override (native list, no dropdown)
// ---------------------------------------------------------------------------

function ManualOverridePanel({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const apply = async (undertone: "warm" | "cool" | "neutral") => {
    setLoading(true);
    try {
      const data = await api.recommendations(undertone);
      const updated: AnalysisResult = {
        ...result,
        undertone,
        summary: data.summary,
        hair: data.hair,
        lips: data.lips,
        blush: data.blush,
        outfits: data.outfits,
        services: data.services,
      };
      sessionStorage.setItem("skin-advisor-result", JSON.stringify(updated));
      toast.success(`Palette updated for ${undertone} undertone`);
      // Reload to re-render with new data (simpler than prop drilling)
      window.location.reload();
    } catch {
      toast.error("Could not load palette. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        id="manual-override-btn"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-border bg-muted/10 py-3 text-sm text-muted-foreground active:bg-muted/30"
      >
        Doesn't look right? Override undertone
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Choose your undertone:</p>
      {(["warm", "cool", "neutral"] as const).map((u) => (
        <button
          key={u}
          id={`manual-undertone-${u}`}
          onClick={() => apply(u)}
          disabled={loading}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm font-medium text-foreground disabled:opacity-50 active:bg-muted/50"
          style={{ minHeight: 52 }}
        >
          <span>
            {u === "warm" ? "🟡" : u === "cool" ? "🔵" : "⚪"}{" "}
            {UNDERTONE_LABEL[u]}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      ))}
      <button
        onClick={() => setOpen(false)}
        className="w-full py-2 text-xs text-muted-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

