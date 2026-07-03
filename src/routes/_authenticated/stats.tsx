import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWatchlist } from "@/lib/watchlist.functions";
import { getAllWatchedStats } from "@/lib/watched.functions";
import { StatsStrip } from "@/components/stats-strip";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

function StatsPage() {
  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getAllWatchedStats(),
  });

  const tvCount = watchlist.filter((w) => w.media_type === "tv").length;
  const movieCount = watchlist.filter((w) => w.media_type === "movie").length;

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold text-foreground">Stats</h1>
        <p className="text-sm text-muted-foreground">
          A summary of your watching habits.
        </p>
      </div>

      <StatsStrip
        totalEpisodes={stats?.totalEpisodes ?? 0}
        totalMovies={stats?.totalMovies ?? 0}
        totalMinutes={stats?.totalMinutes ?? 0}
        watchlistCount={watchlist.length}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold">In your list</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tvCount} TV show{tvCount === 1 ? "" : "s"} and {movieCount} movie
            {movieCount === 1 ? "" : "s"} saved.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold">Total watch time</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            About {Math.round((stats?.totalMinutes ?? 0) / 60)} hours of content
            watched.
          </p>
        </div>
      </div>
    </div>
  );
}
