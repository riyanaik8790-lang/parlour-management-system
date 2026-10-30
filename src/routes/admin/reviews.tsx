import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import {
  Star,
  MessageSquareHeart,
  Search,
  Filter,
  RefreshCw,
  Heart,
  User,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviewsPage,
});

type Review = {
  id: number;
  user_id?: number | null;
  client_name: string;
  service_name?: string | null;
  rating: number;
  comments?: string | null;
  created_at: string;
  client_email?: string | null;
  client_phone?: string | null;
};

const BURGUNDY = "oklch(0.35 0.15 22)";
const GOLD = "oklch(0.68 0.13 68)";
const BORDER = "oklch(0.88 0.030 82)";

export function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReviews();
      setReviews(res.reviews || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load client reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Aggregated analytics
  const stats = useMemo(() => {
    if (!reviews.length) {
      return { total: 0, average: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    reviews.forEach((r) => {
      sum += r.rating;
      dist[r.rating] = (dist[r.rating] || 0) + 1;
    });
    return {
      total: reviews.length,
      average: Number((sum / reviews.length).toFixed(1)),
      distribution: dist,
    };
  }, [reviews]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const matchesSearch =
        search === "" ||
        r.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.service_name && r.service_name.toLowerCase().includes(search.toLowerCase())) ||
        (r.comments && r.comments.toLowerCase().includes(search.toLowerCase()));

      const matchesStar = starFilter === null || r.rating === starFilter;
      return matchesSearch && matchesStar;
    });
  }, [reviews, search, starFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl" style={{ color: BURGUNDY }}>
              Client Reviews & Feedback
            </h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                background: "oklch(0.35 0.15 22 / 8%)",
                color: BURGUNDY,
                border: "1px solid oklch(0.35 0.15 22 / 18%)",
              }}
            >
              {stats.total} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Ratings and thoughts submitted by clients through automated post-treatment push alerts.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchReviews}
          disabled={loading}
          className="h-9 gap-1.5 self-start sm:self-auto text-xs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Analytics Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Average Rating */}
        <div
          className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Rating</span>
            <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-serif font-bold" style={{ color: BURGUNDY }}>
              {stats.total > 0 ? stats.average : "—"}
            </span>
            <div className="flex items-center text-amber-500">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "h-4 w-4",
                    stats.total > 0 && s <= Math.round(stats.average)
                      ? "fill-amber-400 text-amber-500"
                      : "text-muted-foreground/30 fill-transparent"
                  )}
                />
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Based on {stats.total} verified client submissions
          </p>
        </div>

        {/* Card 2: 5-Star Satisfaction */}
        <div
          className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">5-Star Experiences</span>
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500/20" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
              {stats.distribution[5] || 0}
            </span>
            <span className="text-xs text-muted-foreground">
              ({stats.total > 0 ? Math.round(((stats.distribution[5] || 0) / stats.total) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Rated exceptional by delighted clients
          </p>
        </div>

        {/* Card 3: Feedback Coverage */}
        <div
          className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Feedback Sentiment</span>
            <MessageSquareHeart className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {[5, 4, 3, 2, 1].map((s) => (
              <button
                key={s}
                onClick={() => setStarFilter(starFilter === s ? null : s)}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer",
                  starFilter === s
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                <span>{s}★</span>
                <span className="opacity-70 text-[10px]">({stats.distribution[s] || 0})</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Click any rating above to filter
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div
        className="rounded-2xl border bg-card p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between"
        style={{ borderColor: BORDER }}
      >
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or comment..."
            className="pl-9 h-9 text-xs sm:text-sm bg-background rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
          {starFilter !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStarFilter(null)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filter ({starFilter}★)
            </Button>
          )}
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-xs text-muted-foreground">Loading reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <MessageSquareHeart className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="font-serif text-lg text-foreground">No reviews found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {search || starFilter !== null
              ? "Try clearing your filters to see all customer feedback."
              : "When clients complete their appointments and receive automated post-treatment notifications, their feedback will appear right here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-2xl border bg-card/95 backdrop-blur-sm p-5 shadow-xs flex flex-col justify-between space-y-3 transition-shadow hover:shadow-md"
              style={{ borderColor: BORDER }}
            >
              {/* Review Card Top: Client & Stars */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{
                        background: "oklch(0.35 0.15 22 / 10%)",
                        color: BURGUNDY,
                      }}
                    >
                      {rev.client_name ? rev.client_name.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <span>{rev.client_name}</span>
                        {rev.service_name && (
                          <span className="text-[11px] font-normal text-muted-foreground">
                            &middot; {rev.service_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        {rev.client_phone && <span>{rev.client_phone}</span>}
                        {rev.client_email && <span>{rev.client_email}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stars Pill */}
                  <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-xs shrink-0">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span>{rev.rating}.0</span>
                  </div>
                </div>

                {/* Comment Body */}
                {rev.comments ? (
                  <p className="mt-3 text-xs sm:text-sm text-foreground/90 leading-relaxed italic bg-muted/30 p-3 rounded-xl border border-border/40">
                    "{rev.comments}"
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-muted-foreground italic">
                    (No written comments provided)
                  </p>
                )}
              </div>

              {/* Review Card Bottom: Timestamp */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {rev.created_at ? format(new Date(rev.created_at), "d MMM yyyy, h:mm a") : "Recent"}
                </span>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  Verified Post-Treatment
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
