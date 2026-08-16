import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Shuffle } from "lucide-react";
import {
  getTrendingSeries,
  getTrendingMovies,
  getUserRecommendations,
  type MediaItem,
} from "@/lib/tmdb";
import { dismissRecommendation, undoDismissRecommendation } from "@/lib/recommendations.functions";
import { toast } from "sonner";
import { getWatchlist } from "@/lib/watchlist.functions";
import { getAllWatchedStats } from "@/lib/watched.functions";
import { HeroCarousel } from "@/components/hero-carousel";
import { StatsStrip } from "@/components/stats-strip";
import { MediaCard } from "@/components/media-card";
import { SearchBar } from "@/components/search-bar";
import { CurrentlyWatching } from "@/components/currently-watching";
import { UpcomingPreview } from "@/components/upcoming-preview";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function MediaRow({
  title,
  items,
  loading,
  emptyLabel,
  onDismiss,
}: {
  title: string;
  items: MediaItem[];
  loading: boolean;
  emptyLabel?: string;
  onDismiss?: (item: MediaItem) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-base font-semibold text-foreground">
        {title}
      </h3>
      {loading && items.length === 0 ? (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] w-[140px] flex-shrink-0 animate-pulse rounded-xl bg-muted sm:w-[160px]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {emptyLabel ?? "Nothing to show yet."}
        </p>
      ) : (
        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
          {items.map((item) => (
            <div
              key={`${item.media_type}-${item.id}`}
              className="w-[140px] flex-shrink-0 snap-start sm:w-[160px]"
            >
              <MediaCard item={item} onDismiss={onDismiss} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HomePage() {
  const { data: tvTrending, isFetching: tvLoading } = useQuery({
    queryKey: ["trending", "tv"],
    queryFn: () => getTrendingSeries(),
  });
  const { data: movieTrending, isFetching: movieLoading } = useQuery({
    queryKey: ["trending", "movie"],
    queryFn: () => getTrendingMovies(),
  });

  // Daily rotation: the seed changes every day (Refresh forces a new one now).
  const [recSeed, setRecSeed] = useState(() =>
    Math.floor(Date.now() / 86400000)
  );

  const { data: recommendations, isFetching: recLoading } = useQuery({
    queryKey: ["recommendations", recSeed],
    queryFn: () => getUserRecommendations({ data: { seed: recSeed } }),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });


  const queryClient = useQueryClient();
  const handleDismiss = async (item: MediaItem) => {
    const payload = {
      media_type: item.media_type === "movie" ? ("movie" as const) : ("tv" as const),
      tmdb_id: item.id,
    };
    queryClient.setQueryData(
      ["recommendations", recSeed],
      (old: { tv: MediaItem[]; movie: MediaItem[] } | undefined) =>
        old
          ? {
              tv: old.tv.filter((i) => i.id !== item.id),
              movie: old.movie.filter((i) => i.id !== item.id),
            }
          : old,
    );
    try {
      await dismissRecommendation({ data: payload });
      toast.success(`"${item.title}" non verrà più consigliato`, {
        action: {
          label: "Annulla",
          onClick: async () => {
            await undoDismissRecommendation({ data: payload });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
          },
        },
      });
    } catch {
      toast.error("Non è stato possibile salvare la preferenza");
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    }
  };

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getAllWatchedStats(),
  });

  const watchlistKey = (m: { media_type: string; tmdb_id: number }) =>
    `${m.media_type}-${m.tmdb_id}`;
  const watchlistSet = new Set(watchlist.map(watchlistKey));

  const tvItems: MediaItem[] = tvTrending?.results ?? [];
  const movieItems: MediaItem[] = movieTrending?.results ?? [];
  const recTv = recommendations?.tv ?? [];
  const recMovies = recommendations?.movie ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 pt-12 sm:pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Home</h1>
          <p className="text-sm text-muted-foreground">
            Discover the most-watched movies and shows this week.
          </p>
        </div>
        <SearchBar />
      </div>

      <HeroCarousel watchlistKeys={watchlistSet} />

      <StatsStrip
        totalEpisodes={stats?.totalEpisodes ?? 0}
        totalMovies={stats?.totalMovies ?? 0}
        totalMinutes={stats?.totalMinutes ?? 0}
        watchlistCount={watchlist.length}
      />

      <CurrentlyWatching />

      <UpcomingPreview />

      <section className="space-y-5">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Trending this week
        </h2>
        <MediaRow title="TV Shows" items={tvItems} loading={tvLoading} />
        <MediaRow title="Movies" items={movieItems} loading={movieLoading} />
      </section>

      <section className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Recommended for you
            </h2>
            <p className="text-sm text-muted-foreground">
              Based on what you've been watching.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecSeed((s) => s + 1)}
            disabled={recLoading}
            className="gap-2"
          >
            <Shuffle className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
        <MediaRow
          title="TV Shows"
          items={recTv}
          loading={recLoading}
          onDismiss={handleDismiss}
          emptyLabel="Watch some episodes to get TV recommendations."
        />
        <MediaRow
          title="Movies"
          items={recMovies}
          loading={recLoading}
          onDismiss={handleDismiss}
          emptyLabel="Mark some movies as watched to get recommendations."
        />
      </section>

      <p className="text-xs text-muted-foreground">
        Data provided by TMDB. This product uses the TMDB API but is not
        endorsed or certified by TMDB.
      </p>
    </div>
  );
}
