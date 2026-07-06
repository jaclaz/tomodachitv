import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTrendingAll,
  getTrendingSeries,
  getTrendingMovies,
  type MediaItem,
} from "@/lib/tmdb";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist.functions";
import { getAllWatchedStats } from "@/lib/watched.functions";
import { HeroSection } from "@/components/hero-section";
import { StatsStrip } from "@/components/stats-strip";
import { MediaCard } from "@/components/media-card";
import { SearchBar } from "@/components/search-bar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrentlyWatching } from "@/components/currently-watching";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

type Filter = "all" | "tv" | "movie";

function HomePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: allTrending } = useQuery({
    queryKey: ["trending", "all"],
    queryFn: () => getTrendingAll(),
  });
  const { data: tvTrending } = useQuery({
    queryKey: ["trending", "tv"],
    queryFn: () => getTrendingSeries(),
  });
  const { data: movieTrending } = useQuery({
    queryKey: ["trending", "movie"],
    queryFn: () => getTrendingMovies(),
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getAllWatchedStats(),
  });

  const source =
    filter === "tv" ? tvTrending : filter === "movie" ? movieTrending : allTrending;
  const results: MediaItem[] = source?.results ?? [];
  const featured = allTrending?.results?.[0];

  const watchlistKey = (m: { media_type: string; tmdb_id: number }) =>
    `${m.media_type}-${m.tmdb_id}`;
  const watchlistSet = new Set(watchlist.map(watchlistKey));

  const addMutation = useMutation({
    mutationFn: (item: MediaItem) =>
      addToWatchlist({
        data: {
          tmdb_id: item.id,
          media_type: item.media_type,
          series_name: item.title,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          first_air_date: item.release_date,
          vote_average: item.vote_average,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (item: MediaItem) =>
      removeFromWatchlist({
        data: { tmdb_id: item.id, media_type: item.media_type },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const toggleFeaturedWatchlist = () => {
    if (!featured) return;
    const inList = watchlistSet.has(
      `${featured.media_type}-${featured.id}`
    );
    if (inList) removeMutation.mutate(featured);
    else addMutation.mutate(featured);
  };

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

      {featured && (
        <HeroSection
          item={featured}
          inWatchlist={watchlistSet.has(
            `${featured.media_type}-${featured.id}`
          )}
          onToggleWatchlist={toggleFeaturedWatchlist}
        />
      )}

      <StatsStrip
        totalEpisodes={stats?.totalEpisodes ?? 0}
        totalMovies={stats?.totalMovies ?? 0}
        totalMinutes={stats?.totalMinutes ?? 0}
        watchlistCount={watchlist.length}
      />

      <CurrentlyWatching />

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Trending
          </h2>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="tv">TV</TabsTrigger>
              <TabsTrigger value="movie">Movies</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {!source ? (
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
            {results.slice(filter === "all" ? 1 : 0).map((item) => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Data provided by TMDB. This product uses the TMDB API but is not
        endorsed or certified by TMDB.
      </p>
    </div>
  );
}
