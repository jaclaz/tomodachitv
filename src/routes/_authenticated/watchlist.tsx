import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWatchlist, removeFromWatchlist, type WatchlistItem } from "@/lib/watchlist.functions";
import { getCurrentlyWatching } from "@/lib/currently-watching.functions";
import { posterUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosterActions } from "@/components/poster-actions";
import { Trash2, Star, Search, X, Grid2x2, Grid3x3, Plus, Loader2 } from "lucide-react";
import { markEpisodeWatched, getWatchedShowProgress, getWatchedMovies } from "@/lib/watched.functions";
import { toast } from "sonner";
import type { CurrentlyWatchingItem } from "@/lib/currently-watching.functions";

export const Route = createFileRoute("/_authenticated/watchlist")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: (search.type === "movie" ? "movie" : "tv") as "tv" | "movie",
  }),
  component: WatchlistPage,
});

type Filter = "tv" | "movie";

function WatchlistPage() {
  const queryClient = useQueryClient();
  const { type: filter } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (v: Filter) =>
    navigate({ search: (prev: { type: Filter }) => ({ ...prev, type: v }), replace: true });
  const [query, setQuery] = useState("");
  const [gridSize, setGridSize] = useState<"normal" | "small">(() => {
    if (typeof window === "undefined") return "normal";
    return (localStorage.getItem("watchlist-grid-size") as "normal" | "small") || "normal";
  });
  const setGrid = (size: "normal" | "small") => {
    setGridSize(size);
    if (typeof window !== "undefined") localStorage.setItem("watchlist-grid-size", size);
  };
  const gridClass =
    gridSize === "small"
      ? "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
      : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

  const { data = [], isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const { data: currentlyWatching = [] } = useQuery({
    queryKey: ["currently-watching"],
    queryFn: () => getCurrentlyWatching(),
    staleTime: 60_000,
  });

  const { data: watchedShowProgress = [] } = useQuery({
    queryKey: ["watched-show-progress"],
    queryFn: () => getWatchedShowProgress(),
    staleTime: 60_000,
  });

  const { data: watchedMovies = [] } = useQuery({
    queryKey: ["watched-movies"],
    queryFn: () => getWatchedMovies(),
    staleTime: 60_000,
  });

  const watchedMovieIds = useMemo(
    () => new Set(watchedMovies.map((m) => m.tmdb_id)),
    [watchedMovies],
  );

  const inProgressMap = useMemo(() => {
    const m = new Map<number, CurrentlyWatchingItem>();
    for (const s of currentlyWatching) m.set(s.tmdb_id, s);
    return m;
  }, [currentlyWatching]);

  const progressMap = useMemo(() => {
    const m = new Map<number, (typeof watchedShowProgress)[number]>();
    for (const item of watchedShowProgress) m.set(item.tmdb_id, item);
    return m;
  }, [watchedShowProgress]);

  const startedSet = useMemo(
    () => new Set(watchedShowProgress.filter((i) => i.watched_count >= 1).map((i) => i.tmdb_id)),
    [watchedShowProgress],
  );

  const mathematicallyCurrentlyWatchingSet = useMemo(
    () =>
      new Set(
        watchedShowProgress
          .filter((i) => i.is_currently_watching)
          .map((i) => i.tmdb_id),
      ),
    [watchedShowProgress],
  );

  const markNext = useMutation({
    mutationFn: (item: CurrentlyWatchingItem) =>
      markEpisodeWatched({
        data: {
          tmdb_id: item.tmdb_id,
          season_number: item.next_season,
          episode_number: item.next_episode,
          runtime_minutes: item.runtime_minutes,
        },
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["currently-watching"] });
      const prev = queryClient.getQueryData<CurrentlyWatchingItem[]>(["currently-watching"]);
      if (prev) {
        const next = prev
          .map((s) => {
            if (s.tmdb_id !== vars.tmdb_id) return s;
            const watched = s.episodes_watched + 1;
            if (s.total_episodes > 0 && watched >= s.total_episodes) return null;
            return {
              ...s,
              episodes_watched: watched,
              next_episode: s.next_episode + 1,
              last_watched_at: new Date().toISOString(),
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);
        queryClient.setQueryData(["currently-watching"], next);
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["currently-watching"], ctx.prev);
      toast.error(e.message ?? "Could not mark episode");
    },
    onSuccess: (_r, vars) => {
      toast.success(`Marked ${vars.title} S${vars.next_season}·E${vars.next_episode} as watched`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["currently-watching"] });
      queryClient.invalidateQueries({ queryKey: ["watched-show-progress"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["watched-library"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (item: WatchlistItem) =>
      removeFromWatchlist({
        data: { tmdb_id: item.tmdb_id, media_type: item.media_type },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = data.filter(
      (item) =>
        item.media_type === filter &&
        (item.media_type !== "tv" || !progressMap.get(item.tmdb_id)?.is_completed) &&
        item.status !== "dropped" &&
        (q === "" || item.series_name.toLowerCase().includes(q)),
    );
    if (filter !== "tv") return list;
    return list.slice().sort((a, b) => {
      const aLast = inProgressMap.get(a.tmdb_id)?.last_watched_at;
      const bLast = inProgressMap.get(b.tmdb_id)?.last_watched_at;
      if (aLast && bLast) return bLast.localeCompare(aLast);
      if (aLast) return -1;
      if (bLast) return 1;
      const aInProgress = mathematicallyCurrentlyWatchingSet.has(a.tmdb_id);
      const bInProgress = mathematicallyCurrentlyWatchingSet.has(b.tmdb_id);
      if (aInProgress && !bInProgress) return -1;
      if (bInProgress && !aInProgress) return 1;
      return 0;
    });
  }, [data, filter, q, inProgressMap, mathematicallyCurrentlyWatchingSet, progressMap]);

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold text-foreground">My watchlist</h1>
        <p className="text-sm text-muted-foreground">
          Movies and shows you want to watch or are currently watching.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="tv">TV Shows</TabsTrigger>
            <TabsTrigger value="movie">Movies</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in watchlist..."
              className="h-9 pl-9 pr-9 bg-surface"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={gridSize === "normal" ? "default" : "outline"}
              size="icon"
              onClick={() => setGrid("normal")}
              aria-label="Large grid"
              title="Large grid"
              className="h-9 w-9 flex-shrink-0"
            >
              <Grid2x2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={gridSize === "small" ? "default" : "outline"}
              size="icon"
              onClick={() => setGrid("small")}
              aria-label="Small grid"
              title="Small grid"
              className="h-9 w-9 flex-shrink-0"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
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
        (() => {
          const renderCard = (item: WatchlistItem, index: number) => (
            <div
              key={`${item.media_type}-${item.tmdb_id}-${index}`}
              className="group relative overflow-hidden rounded-xl border border-t-0 border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <Link
                to={item.media_type === "tv" ? "/serie/$id" : "/movie/$id"}
                params={{ id: String(item.tmdb_id) }}
                className="block"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-t-xl bg-muted">
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
              <div className="absolute right-2 top-2">
                <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                  {item.media_type === "tv" ? "TV" : "Movie"}
                </span>
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="absolute left-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
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
                {(() => {
                  const prog =
                    item.media_type === "tv" ? inProgressMap.get(item.tmdb_id) : undefined;
                  if (!prog) return null;
                  const pct =
                    prog.total_episodes > 0
                      ? Math.min(100, (prog.episodes_watched / prog.total_episodes) * 100)
                      : 0;
                  const pending =
                    markNext.isPending && markNext.variables?.tmdb_id === prog.tmdb_id;
                  return (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        Next: S{prog.next_season} · E{prog.next_episode}
                        {prog.total_episodes > 0
                          ? ` · ${prog.episodes_watched}/${prog.total_episodes}`
                          : ""}
                      </p>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markNext.mutate(prog);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {pending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Mark next watched
                      </button>
                    </div>
                  );
                })()}
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
          );

          if (filter === "tv") {
            const inProgress = filtered.filter((i) =>
              mathematicallyCurrentlyWatchingSet.has(i.tmdb_id),
            );
            const notStarted = filtered.filter((i) => !startedSet.has(i.tmdb_id));
            return (
              <div className="space-y-8">
                {inProgress.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Currently watching
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({inProgress.length})
                      </span>
                    </h2>
                    <div className={gridClass}>
                      {inProgress.map((item, index) => renderCard(item, index))}
                    </div>
                  </section>
                )}
                {notStarted.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Not started yet
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({notStarted.length})
                      </span>
                    </h2>
                    <div className={gridClass}>
                      {notStarted.map((item, index) => renderCard(item, inProgress.length + index))}
                    </div>
                  </section>
                )}
              </div>
            );
          }

          return (
            <div className={gridClass}>
              {filtered.map((item, index) => renderCard(item, index))}
            </div>
          );
        })()
      )}
    </div>
  );
}
