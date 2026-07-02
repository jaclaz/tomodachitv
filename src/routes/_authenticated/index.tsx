import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTrendingSeries } from "@/lib/tmdb";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/watchlist.functions";
import { getAllWatchedStats } from "@/lib/watched.functions";
import { HeroSection } from "@/components/hero-section";
import { StatsStrip } from "@/components/stats-strip";
import { SeriesCard } from "@/components/series-card";
import { SearchBar } from "@/components/search-bar";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const queryClient = useQueryClient();

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: () => getTrendingSeries(),
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getAllWatchedStats(),
  });

  const featured = trending?.results?.[0];
  const watchlistIds = new Set(watchlist.map((w) => w.tmdb_id));

  const addMutation = useMutation({
    mutationFn: (data: {
      tmdb_id: number;
      series_name: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      first_air_date?: string | null;
      vote_average?: number | null;
    }) => addToWatchlist({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (tmdb_id: number) => removeFromWatchlist({ data: { tmdb_id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const toggleFeaturedWatchlist = () => {
    if (!featured) return;
    if (watchlistIds.has(featured.id)) {
      removeMutation.mutate(featured.id);
    } else {
      addMutation.mutate({
        tmdb_id: featured.id,
        series_name: featured.name,
        poster_path: featured.poster_path,
        backdrop_path: featured.backdrop_path,
        first_air_date: featured.first_air_date,
        vote_average: featured.vote_average,
      });
    }
  };

  const averageRating =
    watchlist.length > 0
      ? watchlist.reduce((sum, w) => sum + (w.vote_average || 0), 0) / watchlist.length
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 pt-12 sm:pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Esplora</h1>
          <p className="text-sm text-muted-foreground">
            Scopri le serie più seguite della settimana.
          </p>
        </div>
        <SearchBar />
      </div>

      {featured && (
        <HeroSection
          series={featured}
          inWatchlist={watchlistIds.has(featured.id)}
          onToggleWatchlist={toggleFeaturedWatchlist}
        />
      )}

      <StatsStrip
        totalEpisodes={stats?.totalEpisodes ?? 0}
        totalMinutes={stats?.totalMinutes ?? 0}
        watchlistCount={watchlist.length}
        averageRating={averageRating}
      />

      <section>
        <h2 className="font-display text-xl font-semibold text-foreground">In tendenza</h2>
        {trendingLoading ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {trending?.results?.slice(1).map((series) => (
              <SeriesCard key={series.id} series={series} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
