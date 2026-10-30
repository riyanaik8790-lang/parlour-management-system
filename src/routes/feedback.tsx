import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, getUser } from "@/lib/api";
import { toast } from "sonner";
import { Star, Heart, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Share Your Feedback - Hemangi Glam Salon" },
      { name: "description", content: "Tell us about your salon experience at Hemangi Glam Salon." },
    ],
  }),
  component: FeedbackPage,
});

const BURGUNDY = "oklch(0.35 0.15 22)";
const GOLD = "oklch(0.68 0.13 68)";
const BORDER = "oklch(0.88 0.030 82)";

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: "Needs improvement",
  2: "Fair experience",
  3: "Good & satisfied",
  4: "Loved it!",
  5: "Exceptional experience! ✨",
};

export function FeedbackPage() {
  const navigate = useNavigate();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }

    setIsSubmitting(true);
    const currentUser = getUser();
    try {
      await api.submitFeedback({
        rating,
        comments,
        client_name: currentUser?.name || undefined,
      });
      setSubmitted(true);
      toast.success("Thank you for your valuable feedback! 💖");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden flex items-center justify-center px-4 py-8 sm:py-12">
      {/* Background watermark */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 mix-blend-multiply opacity-85"
        style={{
          backgroundImage: "url('/luxury-floral-bg.png')",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundSize: "480px auto",
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-lg">
        <div
          className="rounded-3xl border bg-card/95 backdrop-blur-md p-6 sm:p-8 shadow-xl transition-all"
          style={{ borderColor: BORDER }}
        >
          {submitted ? (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl text-primary">Thank You!</h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                Your feedback helps us continuously elevate our beauty and care services at Hemangi Glam Salon.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => navigate({ to: "/my-bookings" })}
                  className="min-h-[44px]"
                >
                  View My Bookings
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/" })}
                  className="min-h-[44px]"
                >
                  Return to Home
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Client Experience</span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl text-primary">How was your visit?</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  We value your thoughts on your recent appointment and services.
                </p>
              </div>

              {/* Star Rating */}
              <div className="flex flex-col items-center justify-center gap-2 pt-2">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 rounded-full transition-transform hover:scale-115 active:scale-95 focus:outline-none"
                      aria-label={`Rate ${star} star`}
                    >
                      <Star
                        className={cn(
                          "h-8 w-8 sm:h-9 sm:w-9 transition-colors",
                          star <= activeRating
                            ? "fill-amber-400 text-amber-500"
                            : "text-muted-foreground/30 fill-transparent hover:text-muted-foreground/50"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-medium text-muted-foreground h-4">
                  {RATING_DESCRIPTIONS[activeRating] || "Select a rating"}
                </span>
              </div>

              {/* Feedback text area */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Comments (Optional)
                </label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Tell us what you loved about your service or how we can make your next visit even more special..."
                  rows={4}
                  className="bg-background text-sm rounded-xl border-border resize-none"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[46px] text-sm font-medium gap-2 shadow-sm"
                >
                  <Heart className="h-4 w-4 fill-current" />
                  {isSubmitting ? "Submitting..." : "Submit Review"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

