/**
 * Skin-Tone Colour Advisor
 *
 * Sends a photo to the Flask /api/analyze-skin route which uses OpenCV in
 * CIE LAB colour space to detect depth + undertone. Displays named colour
 * swatches for hair, makeup and outfits, with a manual-override fallback.
 *
 * The Virtual Hairstyle Try-On feature has been fully removed.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Scissors,
  Brush,
  Shirt,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/try-on")({
  head: () => ({
    meta: [
      { title: "Skin-Tone Colour Advisor – Hemangi Makeover" },
      {
        name: "description",
        content:
          "Discover your undertone and get personalised hair, makeup and outfit colour recommendations powered by computer vision.",
      },
      { property: "og:title", content: "Skin-Tone Colour Advisor – Hemangi Makeover" },
      {
        property: "og:description",
        content: "AI-powered skin tone analysis to find the shades that flatter you most.",
      },
    ],
  }),
  component: SkinAdvisorPage,
});

// ---------------------------------------------------------------------------
// Types
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
  /** Consistency of readings across sampled regions */
  confidence?: "high" | "medium" | "low";
  /** Specific reason when confidence is medium/low */
  confidence_reason?: string | null;
  /** Non-null when the backend detected poor lighting */
  lighting_warning?: string | null;
};

type PageView = "warning" | "capture" | "loading" | "results";

// ---------------------------------------------------------------------------
// Root page — manages view state only
// ---------------------------------------------------------------------------

function SkinAdvisorPage() {
  const [view, setView] = useState<PageView>("warning");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [manualUndertone, setManualUndertone] = useState<"warm" | "cool" | "neutral" | "">("");

  // Load saved state on mount so results persist across navigation
  useEffect(() => {
    const savedResult = sessionStorage.getItem("skin-advisor-result");
    if (savedResult) {
      try {
        setResult(JSON.parse(savedResult));
        setView("results");
      } catch (e) {
        sessionStorage.removeItem("skin-advisor-result");
        sessionStorage.removeItem("skin-advisor-image");
      }
    }
  }, []);

  const runAnalysis = useCallback(async (file: File) => {
    setView("loading");
    setCaptureError(null);
    try {
      // Cast via unknown because the API type hasn't been updated yet in api.ts;
      // the actual runtime payload matches AnalysisResult exactly.
      const data = (await analyzeSkinImage(file)) as unknown as AnalysisResult;
      setResult(data);
      setView("results");
      
      // Save result and image preview to sessionStorage
      sessionStorage.setItem("skin-advisor-result", JSON.stringify(data));
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          sessionStorage.setItem("skin-advisor-image", e.target.result);
        }
      };
      reader.readAsDataURL(file);

      // Silently persist if the user is logged in
      if (getToken() && data.undertone) {
        try {
          await api.saveSkinAnalysis({
            hex: data.hex,
            depth: data.skin_tone.split(" ")[0],
            undertone: data.undertone,
          });
        } catch {
          /* backend down or offline — keep showing local result */
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setCaptureError(msg);
      toast.error(msg);
      setView("capture");
    }
  }, []);

  const applyOverride = async (undertone: "warm" | "cool" | "neutral") => {
    setManualUndertone(undertone);
    setOverrideLoading(true);
    try {
      const data = await api.recommendations(undertone);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              undertone,
              summary: data.summary,
              hair: data.hair,
              lips: data.lips,
              blush: data.blush,
              outfits: data.outfits,
              services: data.services,
            }
          : prev,
      );
      setOverrideOpen(false);
      toast.success(
        `Palette updated for ${undertone.charAt(0).toUpperCase() + undertone.slice(1)} undertone`,
      );
    } catch {
      toast.error("Could not load palette. Please try again.");
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleRetake = () => {
    sessionStorage.removeItem("skin-advisor-result");
    sessionStorage.removeItem("skin-advisor-image");
    setResult(null);
    setCaptureError(null);
    setOverrideOpen(false);
    setManualUndertone("");
    setView("capture");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Page hero header ── */}
      <div className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-8 text-center">
          <h1 className="font-serif text-4xl text-primary">Skin-Tone Colour Advisor</h1>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-4xl px-4 py-10">
        {view === "warning" && <LightingWarningScreen onProceed={() => setView("capture")} />}

        {view === "capture" && (
          <CaptureSection
            onAnalyze={runAnalysis}
            onBack={() => setView("warning")}
            error={captureError}
          />
        )}

        {view === "loading" && <LoadingScreen />}

        {view === "results" && result && (
          <ResultsSection
            result={result}
            onRetake={handleRetake}
            overrideOpen={overrideOpen}
            overrideLoading={overrideLoading}
            manualUndertone={manualUndertone}
            onOpenOverride={() => setOverrideOpen(true)}
            onManualSelect={applyOverride}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 – Lighting Warning Screen
// ---------------------------------------------------------------------------

const LIGHTING_TIPS = [
  {
    icon: <AppWindow className="mt-0.5 h-5 w-5 text-muted-foreground" />,
    title: "Face a window",
    desc: "Natural daylight is the most accurate light source for skin-tone analysis.",
  },
  {
    icon: <LightbulbOff className="mt-0.5 h-5 w-5 text-muted-foreground" />,
    title: "Turn off yellow lights",
    desc: "Warm indoor bulbs add an orange cast that skews depth and undertone results.",
  },
  {
    icon: <Glasses className="mt-0.5 h-5 w-5 text-muted-foreground" />,
    title: "Remove glasses",
    desc: "Frames and lens reflections can obscure your face and confuse detection.",
  },
  {
    icon: <Droplets className="mt-0.5 h-5 w-5 text-muted-foreground" />,
    title: "Go bare-faced",
    desc: "Foundation and heavy contour significantly change the apparent skin colour.",
  },
];

function LightingWarningScreen({ onProceed }: { onProceed: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-8 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/20">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Sun className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-serif text-2xl text-foreground">
              For the most accurate results…
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lighting is the single biggest factor in colour accuracy. Please spend 10 seconds
              following these tips before you proceed.
            </p>
          </div>
        </div>

        {/* Tips grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {LIGHTING_TIPS.map((tip) => (
            <div
              key={tip.title}
              className="flex gap-3 rounded-xl border border-border bg-background/80 p-4"
            >
              <span className="shrink-0 text-xl" aria-hidden>
                {tip.icon}
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">{tip.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{tip.desc}</div>
              </div>
            </div>
          ))}
        </div>



        <div className="mt-8 flex justify-center">
          <Button
            id="proceed-to-capture-btn"
            size="lg"
            onClick={onProceed}
            className="gap-2 px-10 text-base min-h-[44px]"
          >
            I'm Ready - Proceed
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 – Capture (Upload + Webcam)
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
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [webcamMode, setWebcamMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, WEBP).");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setWebcamMode(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to lighting tips
      </button>

      {webcamMode ? (
        <WebcamCapture
          onCapture={handleFile}
          onCancel={() => setWebcamMode(false)}
        />
      ) : (
        <>
          {/* ── Drop zone ── */}
          <div
            id="skin-upload-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
              dragOver
                ? "scale-[1.01] border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={preview}
                  alt="Selected face preview"
                  className="max-h-72 rounded-xl border border-border object-contain shadow-sm"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFile(null);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive min-h-[44px]"
                >
                  <X className="h-4 w-4" />
                  Remove photo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="text-sm">
                  <span className="font-medium text-foreground">Click to upload</span> or drag and
                  drop
                </div>
                <p className="text-xs">PNG, JPG, WEBP — clear, front-facing, well-lit photo</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Hidden File Input (For Mobile Camera) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {!preview && (
            <>
              {/* Mobile: Camera Only */}
              <div className="sm:hidden">
                <Button
                  variant="outline"
                  className="w-full gap-2 min-h-[44px]"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-5 w-5" />
                  Take a Selfie
                </Button>
              </div>

              {/* Desktop: Webcam Only */}
              <div className="hidden sm:block">
                <Button
                  id="open-webcam-btn"
                  variant="outline"
                  className="w-full gap-2 min-h-[44px]"
                  onClick={() => setWebcamMode(true)}
                >
                  <Camera className="h-5 w-5" />
                  Use Webcam — Take a Selfie
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Analyse button */}
      {file && !webcamMode && (
        <Button
          id="analyze-photo-btn"
          size="lg"
          className="w-full gap-2 min-h-[44px]"
          onClick={() => onAnalyze(file)}
        >
          <Sparkles className="h-4 w-4" />
          Analyse My Skin Tone
        </Button>
      )}

      {/* Error message */}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webcam sub-component
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
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setReady(true));
        }
      })
      .catch(() => setCamError("Camera permission denied or device not available."));
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
      if (n <= 0) {
        clearInterval(id);
        setCountdown(null);
        snap();
      } else {
        setCountdown(n);
      }
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
    // Mirror so the captured image is the correct orientation
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "webcam-selfie.jpg", { type: "image/jpeg" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-border bg-black">
        {camError ? (
          <p className="px-6 text-center text-sm text-destructive">{camError}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="-scale-x-100 block w-full" />
            {/* Oval face guide */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-60 w-44 rounded-full border-2 border-dashed border-white/40" />
            </div>
            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/60 text-5xl font-bold text-white">
                  {countdown}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 min-h-[44px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          id="webcam-shoot-btn"
          className="flex-1 gap-2 min-h-[44px]"
          onClick={shoot}
          disabled={!ready || countdown !== null || !!camError}
        >
          <Camera className="h-4 w-4" />
          {countdown !== null ? `Taking in ${countdown}…` : "Take Photo"}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Align your face inside the oval. We'll count down 3 seconds before capturing.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 – Loading screen with animated progress steps
// ---------------------------------------------------------------------------

const ANALYSIS_STEPS = [
  "Detecting face landmarks…",
  "Extracting forehead skin sample…",
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
    <div className="mx-auto max-w-md py-20 text-center">
      {/* Spinner */}
      <div className="mb-8 flex justify-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
      </div>

      <h2 className="font-serif text-2xl text-primary">Analysing your skin tone…</h2>
      <p className="mt-3 min-h-[1.5rem] text-sm text-muted-foreground transition-all duration-500">
        {ANALYSIS_STEPS[step]}
      </p>

      {/* Progress dots */}
      <div className="mt-6 flex justify-center gap-1.5">
        {ANALYSIS_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= step ? "w-6 bg-primary" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 – Results
// ---------------------------------------------------------------------------

function ResultsSection({
  result,
  onRetake,
  overrideOpen,
  overrideLoading,
  manualUndertone,
  onOpenOverride,
  onManualSelect,
}: {
  result: AnalysisResult;
  onRetake: () => void;
  overrideOpen: boolean;
  overrideLoading: boolean;
  manualUndertone: string;
  onOpenOverride: () => void;
  onManualSelect: (v: "warm" | "cool" | "neutral") => void;
}) {
  const navigate = useNavigate();
  const undertoneStyle: Record<string, string> = {
    warm: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
    cool: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40",
    neutral:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
  };

  return (
    <div className="space-y-6">
      {/* ── Hero result card ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Coloured accent bar matching the undertone */}
        <div
          className="h-1.5 w-full"
          style={{
            background:
              result.undertone === "warm"
                ? "linear-gradient(90deg,#c19a6b,#b7410e)"
                : result.undertone === "cool"
                  ? "linear-gradient(90deg,#0f52ba,#c8b6d6)"
                  : "linear-gradient(90deg,#9caf88,#6a8caf)",
          }}
        />

        {/* Lighting warning banner */}
        {result.lighting_warning && (
          <div className="flex items-start gap-3 border-b border-amber-200/60 bg-amber-50/70 px-5 py-3 dark:border-amber-800/40 dark:bg-amber-950/25">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {result.lighting_warning}
            </p>
          </div>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Swatch orb */}
            <div className="shrink-0 text-center">
              <div
                className="mx-auto h-32 w-32 rounded-full border-4 border-background shadow-xl ring-2 ring-border"
                style={{ background: result.hex }}
                aria-label={`Detected skin colour ${result.hex}`}
              />
              <div className="mt-2 font-mono text-xs text-muted-foreground">{result.hex}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Your skin swatch</div>
            </div>

            {/* Info block */}
            <div className="flex-1 min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-sm">
                  {result.skin_tone}
                </Badge>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${undertoneStyle[result.undertone] ?? ""}`}
                >
                  {result.undertone.charAt(0).toUpperCase() + result.undertone.slice(1)} undertone
                </span>

                {/* Confidence badge */}
                {result.confidence === "high" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    High confidence
                  </span>
                )}
                {result.confidence === "medium" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                    title={result.confidence_reason ?? undefined}
                  >
                    <Info className="h-3 w-3" />
                    Result may vary
                  </span>
                )}
                {result.confidence === "low" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:border-orange-800/40 dark:bg-orange-950/30 dark:text-orange-400"
                    title={result.confidence_reason ?? undefined}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Try better lighting
                  </span>
                )}
              </div>

              {/* Confidence reason — shown as a subtle callout below the badges */}
              {result.confidence_reason && (
                <p className="mt-2 flex items-start gap-1.5 text-xs italic text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  {result.confidence_reason}
                </p>
              )}

              <p className="mt-2 text-sm leading-relaxed text-foreground">{result.summary}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Swatch rows ── */}
      <div className="space-y-4">
        <SwatchSection title="Hair Colours That Flatter You" icon={<Scissors className="h-5 w-5" />} items={result.hair} />
        <div className="px-1">
          <Button onClick={() => navigate({ to: "/book", search: { service: "Global Hair Colour" } })} className="w-full sm:w-auto bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 min-h-[44px]">
            Book a Hair Color Consultation
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <SwatchSection title="Flattering Lip Shades" icon={<Brush className="h-5 w-5" />} items={result.lips ?? []} />
        <SwatchSection title="Perfect Blush Shades" icon={<Brush className="h-5 w-5" />} items={result.blush ?? []} />
        <div className="px-1">
          <Button onClick={() => navigate({ to: "/book", search: { service: "Engagement Look" } })} className="w-full sm:w-auto bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 min-h-[44px]">
            Book a Makeup Session
          </Button>
        </div>
      </div>

      <SwatchSection title="Outfit Colours" icon={<Shirt className="h-5 w-5" />} items={result.outfits} />

      {/* ── Recommended services ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-serif text-xl text-primary">
          <Sparkles className="h-5 w-5" /> Recommended Salon Services
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {result.services.map((svc) => (
            <div
              key={svc}
              className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
            >
              <span className="text-sm font-medium text-foreground">{svc}</span>
              <button
                id={`book-service-${svc.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() =>
                  navigate({ to: "/book", search: { service: svc } })
                }
                className="mt-auto inline-flex w-fit items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all duration-150 hover:bg-primary hover:text-primary-foreground"
              >
                Book this service →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Manual override + retake ── */}
      <div className="rounded-2xl border border-border bg-muted/20 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Doesn't look right?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Retake the photo in better light, or manually select your undertone to refresh the
              palette.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              id="retake-btn"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onRetake}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retake Photo
            </Button>
            {!overrideOpen && (
              <Button
                id="manual-override-btn"
                variant="outline"
                size="sm"
                onClick={onOpenOverride}
              >
                Select Undertone Manually
              </Button>
            )}
          </div>
        </div>

        {overrideOpen && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Select
              value={manualUndertone}
              onValueChange={(v) => onManualSelect(v as "warm" | "cool" | "neutral")}
            >
              <SelectTrigger id="manual-undertone-select" className="w-56">
                <SelectValue placeholder="Choose your undertone…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">🟡 Warm — golden / peachy</SelectItem>
                <SelectItem value="cool">🔵 Cool — pink / bluish</SelectItem>
                <SelectItem value="neutral">⚪ Neutral — balanced</SelectItem>
              </SelectContent>
            </Select>
            {overrideLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating palette…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable swatch row
// ---------------------------------------------------------------------------

function SwatchSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: Swatch[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-5 flex items-center gap-2 font-serif text-xl text-primary">
        {icon} {title}
      </h3>
      <div className="flex flex-wrap gap-4">
        {items.map((swatch) => (
          <div key={swatch.name} className="group w-20 text-center">
            <div
              className="mx-auto h-14 w-14 rounded-full border-2 border-background shadow-md ring-1 ring-border transition-transform duration-200 group-hover:scale-110"
              style={{ background: swatch.hex }}
              title={`${swatch.name} — ${swatch.hex}`}
            />
            <div className="mt-2 text-[11px] font-medium leading-tight text-foreground">
              {swatch.name}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{swatch.hex}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
