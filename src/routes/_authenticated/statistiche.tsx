import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWatchlist } from "@/lib/watchlist.functions";
import { getAllWatchedStats } from "@/lib/watched.functions";
import { StatsStrip } from "@/components/stats-strip";

export const Route = createFileRoute("/_authenticated/statistiche")({
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

  const averageRating =
    watchlist.length > 0
      ? watchlist.reduce((sum, w) => sum + (w.vote_average || 0), 0) / watchlist.length
      : 0;

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Statistiche
        </h1>
        <p className="text-sm text-muted-foreground">
          Il riepilogo del tuo guarda-serie.
        </p>
      </div>

      <StatsStrip
        totalEpisodes={stats?.totalEpisodes ?? 0}
        totalMinutes={stats?.totalMinutes ?? 0}
        watchlistCount={watchlist.length}
        averageRating={averageRating}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold">Serie in lista</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Hai salvato {watchlist.length} serie nella tua watchlist.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold">Tempo totale</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Circa {Math.round((stats?.totalMinutes ?? 0) / 60)} ore di contenuti visti.
          </p>
        </div>
      </div>
    </div>
  );
}
