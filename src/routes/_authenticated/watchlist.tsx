import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWatchlist,
  removeFromWatchlist,
  setWatchlistStatus,
  type WatchlistItem,
  type WatchlistStatus,
} from "@/lib/watchlist.functions";
import { posterUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PosterActions } from "@/components/poster-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trash2,
  Star,
  Search,
  X,
  Grid2x2,
  Grid3x3,
  MoreVertical,
  Play,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/watchlist")({
  component: WatchlistPage,
});

type MediaFilter = "all" | "tv" | "movie";
type StatusFilter = "watching" | "caught_up" | "completed" | "all";

const STATUS_LABEL: Record<WatchlistStatus, string> = {
  watching: "Watching",
  caught_up: "Caught up",
  completed: "Completed",
  dropped: "Dropped",
};

function WatchlistPage() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<StatusFilter>("watching");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [query, setQuery] = useState("");
  const [gridSize, setGridSize] = useState<"normal" | "small">(() => {
    if (typeof window === "undefined") return "normal";
    return (
      (localStorage.getItem("watchlist-grid-size") as "normal" | "small") ||
      "normal"
    );
  });
  const setGrid = (size: "normal" | "small") => {
    setGridSize(size);
    if (typeof window !== "undefined")
      localStorage.setItem("watchlist-grid-size", size);
  };
  const gridClass =
    gridSize === "small"
      ? "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
      : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

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

  const statusMutation = useMutation({
    mutationFn: (args: {
      item: WatchlistItem;
      status: WatchlistStatus | null;
    }) =>
      setWatchlistStatus({
        data: {
          tmdb_id: args.item.tmdb_id,
          media_type: args.item.media_type,
          status: args.status,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["dropped-shows"] });
    },
  });

  const counts = {
    watching: data.filter((i) => i.derived_status === "watching").length,
    caught_up: data.filter((i) => i.derived_status === "caught_up").length,
    completed: data.filter((i) => i.derived_status === "completed").length,
    all: data.length,
  };

  const q = query.trim().toLowerCase();
  const filtered = data.filter(
    (item) =>
      (statusTab === "all" || item.derived_status === statusTab) &&
      (mediaFilter === "all" || item.media_type === mediaFilter) &&
      (q === "" || item.series_name.toLowerCase().includes(q)),
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

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as StatusFilter)}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="watching">
            <Play className="mr-1.5 h-3.5 w-3.5" /> Watching ({counts.watching})
          </TabsTrigger>
          <TabsTrigger value="caught_up">
            <Clock className="mr-1.5 h-3.5 w-3.5" /> Caught up (
            {counts.caught_up})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Completed (
            {counts.completed})
          </TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={mediaFilter}
          onValueChange={(v) => setMediaFilter(v as MediaFilter)}
        >
          <SelectTrigger className="h-9 w-full bg-surface sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="tv">TV Shows</SelectItem>
            <SelectItem value="movie">Movies</SelectItem>
          </SelectContent>
        </Select>
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
            {data.length === 0
              ? "Explore titles and add the ones you're interested in."
              : "No titles match this filter."}
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Explore</Link>
          </Button>
        </div>
      ) : (
        <div className={gridClass}>
          {filtered.map((item, index) => (
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
              <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                  {item.media_type === "tv" ? "TV" : "Movie"}
                </span>
                <StatusBadge status={item.derived_status} manual={!!item.status} />
              </div>
              <div className="absolute left-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="secondary" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Set status</DropdownMenuLabel>
                    {(["watching", "caught_up", "completed"] as const).map(
                      (s) => (
                        <DropdownMenuItem
                          key={s}
                          onSelect={() =>
                            statusMutation.mutate({ item, status: s })
                          }
                        >
                          {STATUS_LABEL[s]}
                        </DropdownMenuItem>
                      ),
                    )}
                    {item.status && (
                      <DropdownMenuItem
                        onSelect={() =>
                          statusMutation.mutate({ item, status: null })
                        }
                      >
                        Auto (clear override)
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {item.media_type === "tv" && (
                      <DropdownMenuItem
                        onSelect={() =>
                          statusMutation.mutate({ item, status: "dropped" })
                        }
                        className="text-accent"
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Drop show
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() => removeMutation.mutate(item)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="p-3">
                <h3 className="font-display text-sm font-semibold text-foreground line-clamp-1">
                  {item.series_name}
                </h3>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-rating text-rating" />
                    {item.vote_average?.toFixed(1) ?? "—"}
                  </span>
                  {item.media_type === "tv" &&
                    item.episode_count_aired != null && (
                      <span>
                        {item.episodes_watched ?? 0}/{item.episode_count_aired}{" "}
                        ep
                      </span>
                    )}
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

function StatusBadge({
  status,
  manual,
}: {
  status: WatchlistStatus;
  manual: boolean;
}) {
  const color: Record<WatchlistStatus, string> = {
    watching: "bg-primary/85 text-primary-foreground",
    caught_up: "bg-amber-500/85 text-black",
    completed: "bg-emerald-600/85 text-white",
    dropped: "bg-destructive/85 text-destructive-foreground",
  };
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur ${color[status]}`}
      title={manual ? "Set manually" : "Auto"}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
