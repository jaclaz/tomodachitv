import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from "@/lib/watchlist.functions";
import { posterUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosterActions } from "@/components/poster-actions";
import { Trash2, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/watchlist")({
  component: WatchlistPage,
});

type Filter = "all" | "tv" | "movie";

function WatchlistPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const removeMutation = useMutation({
    mutationFn: (item: WatchlistItem) =>
      removeFromWatchlist({
        data: { tmdb_id: item.tmdb_id, media_type: item.media_type },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const filtered = data.filter(
    (item) => filter === "all" || item.media_type === filter
  );

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold text-foreground">
          My watchlist
        </h1>
        <p className="text-sm text-muted-foreground">
          Movies and shows you want to watch or are currently watching.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="tv">TV Shows</TabsTrigger>
          <TabsTrigger value="movie">Movies</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <h3 className="font-display text-lg font-semibold">Empty list</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Explore titles and add the ones you're interested in.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Explore</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <Link
                to={item.media_type === "tv" ? "/serie/$id" : "/movie/$id"}
                params={{ id: String(item.tmdb_id) }}
                className="block p-2 pb-0"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted">
                  {item.poster_path ? (
                    <img
                      src={posterUrl(item.poster_path)}
                      alt={item.series_name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <span className="font-display text-2xl font-bold text-muted-foreground">
                        {item.series_name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
              <div className="absolute right-3 top-3">
                <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                  {item.media_type === "tv" ? "TV" : "Movie"}
                </span>
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="absolute left-3 top-3 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => removeMutation.mutate(item)}
              >
                <Trash2 className="h-4 w-4 text-accent" />
              </Button>
              <div className="p-3">
                <h3 className="font-display text-sm font-semibold text-foreground line-clamp-1">
                  {item.series_name}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-rating text-rating" />
                  {item.vote_average?.toFixed(1) ?? "—"}
                </div>
                <div className="mt-2 flex justify-end">
                  <PosterActions
                    media_type={item.media_type}
                    tmdb_id={item.tmdb_id}
                    title={item.series_name}
                    poster_path={item.poster_path}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
