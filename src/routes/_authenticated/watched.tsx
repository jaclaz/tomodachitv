import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWatchedLibrary } from "@/lib/watched-library.functions";
import { getGenres, posterUrl, type MediaType, type SortBy } from "@/lib/tmdb";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PosterActions } from "@/components/poster-actions";
import { Star, X, CheckCircle2, Search, Grid2x2, Grid3x3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/watched")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: (search.type === "movie" ? "movie" : "tv") as "tv" | "movie",
    fav: search.fav === "1" || search.fav === true ? ("1" as const) : undefined,
  }),
  component: WatchedPage,
});


type TypeTab = "tv" | "movie";
type WatchedSort = "recent.desc" | "recent.asc" | "rating.desc" | "release.desc" | "title.asc";

const CURRENT_YEAR = new Date().getFullYear();
const DECADES = [
  { label: "2020s", from: 2020, to: CURRENT_YEAR },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "1990s", from: 1990, to: 1999 },
  { label: "1980s", from: 1980, to: 1989 },
  { label: "Older", from: 1900, to: 1979 },
];
const RATINGS = [9, 8, 7, 6, 5];

interface Filters {
  genreId: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
  sort: WatchedSort;
}

const DEFAULTS: Filters = {
  genreId: null,
  yearFrom: null,
  yearTo: null,
  minRating: null,
  sort: "recent.desc",
};

function WatchedPage() {
  const { type, fav } = Route.useSearch();
  const favOnly = fav === "1";
  const navigate = useNavigate({ from: Route.fullPath });
  const setType = (v: TypeTab) =>
    navigate({ search: (prev) => ({ ...prev, type: v }), replace: true });
  const clearFav = () =>
    navigate({ search: (prev) => ({ ...prev, fav: undefined }), replace: true });
  const [filters, setFilters] = useState<Filters>(DEFAULTS);

  const [query, setQuery] = useState("");
  const [gridSize, setGridSize] = useState<"normal" | "small">(() => {
    if (typeof window === "undefined") return "normal";
    return (localStorage.getItem("watched-grid-size") as "normal" | "small") || "normal";
  });
  const setGrid = (size: "normal" | "small") => {
    setGridSize(size);
    if (typeof window !== "undefined") localStorage.setItem("watched-grid-size", size);
  };
  const gridClass =
    gridSize === "small"
      ? "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
      : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

  const { data: library = [], isLoading } = useQuery({
    queryKey: ["watched-library"],
    queryFn: () => getWatchedLibrary(),
    staleTime: 60_000,
  });

  const genreType: MediaType = type === "movie" ? "movie" : "tv";
  const { data: genresData } = useQuery({
    queryKey: ["genres", genreType],
    queryFn: () => getGenres({ data: { type: genreType } }),
    staleTime: 60 * 60 * 1000,
  });
  const genres = genresData?.genres ?? [];

  const filtered = useMemo(() => {
    let list = library.slice();
    list = list.filter((i) => i.media_type === type);
    const q = query.trim().toLowerCase();
    if (q !== "") list = list.filter((i) => i.title.toLowerCase().includes(q));
    if (filters.genreId != null)
      list = list.filter((i) => i.genre_ids.includes(filters.genreId as number));
    if (filters.yearFrom != null || filters.yearTo != null) {
      list = list.filter((i) => {
        const y = i.release_date ? parseInt(i.release_date.slice(0, 4), 10) : null;
        if (y == null) return false;
        if (filters.yearFrom != null && y < filters.yearFrom) return false;
        if (filters.yearTo != null && y > filters.yearTo) return false;
        return true;
      });
    }
    if (filters.minRating != null) {
      const r = filters.minRating;
      list = list.filter((i) => (i.vote_average ?? 0) >= r);
    }
    list.sort((a, b) => {
      switch (filters.sort) {
        case "recent.desc":
          return b.watched_at.localeCompare(a.watched_at);
        case "recent.asc":
          return a.watched_at.localeCompare(b.watched_at);
        case "rating.desc":
          return (b.vote_average ?? 0) - (a.vote_average ?? 0);
        case "release.desc":
          return (b.release_date ?? "").localeCompare(a.release_date ?? "");
        case "title.asc":
          return a.title.localeCompare(b.title);
      }
    });
    return list;
  }, [library, type, filters, query]);

  const currentDecadeIdx = DECADES.findIndex(
    (d) => d.from === filters.yearFrom && d.to === filters.yearTo,
  );
  const decadeVal = currentDecadeIdx >= 0 ? String(currentDecadeIdx) : "all";
  const filtersActive =
    filters.genreId != null ||
    filters.yearFrom != null ||
    filters.minRating != null ||
    filters.sort !== "recent.desc";

  return (
    <div className="space-y-6">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold text-foreground">Watched</h1>
        <p className="text-sm text-muted-foreground">
          {library.length} title{library.length === 1 ? "" : "s"} in your library.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={type} onValueChange={(v) => setType(v as TypeTab)}>
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
                placeholder="Search in watched..."
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

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.genreId ? String(filters.genreId) : "all"}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                genreId: v === "all" ? null : Number(v),
              }))
            }
          >
            <SelectTrigger className="h-9 w-[140px] bg-surface">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genres</SelectItem>
              {genres.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={decadeVal}
            onValueChange={(v) => {
              if (v === "all") setFilters((f) => ({ ...f, yearFrom: null, yearTo: null }));
              else {
                const d = DECADES[Number(v)];
                setFilters((f) => ({ ...f, yearFrom: d.from, yearTo: d.to }));
              }
            }}
          >
            <SelectTrigger className="h-9 w-[130px] bg-surface">
              <SelectValue placeholder="Decade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any year</SelectItem>
              {DECADES.map((d, i) => (
                <SelectItem key={d.label} value={String(i)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.minRating != null ? String(filters.minRating) : "all"}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                minRating: v === "all" ? null : Number(v),
              }))
            }
          >
            <SelectTrigger className="h-9 w-[130px] bg-surface">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any rating</SelectItem>
              {RATINGS.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}+ ★
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.sort}
            onValueChange={(v) => setFilters((f) => ({ ...f, sort: v as WatchedSort }))}
          >
            <SelectTrigger className="h-9 w-[170px] bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent.desc">Recently watched</SelectItem>
              <SelectItem value="recent.asc">First watched</SelectItem>
              <SelectItem value="rating.desc">Highest rated</SelectItem>
              <SelectItem value="release.desc">Newest release</SelectItem>
              <SelectItem value="title.asc">A–Z</SelectItem>
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(DEFAULTS)}
              className="gap-1 text-muted-foreground"
            >
              <X className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">Nothing matches</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {library.length === 0
              ? "Mark titles as watched or import from TV Time to build your library."
              : "Try relaxing your filters."}
          </p>
        </div>
      ) : (
        (() => {
          const renderCard = (item: (typeof filtered)[number], index: number) => (
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
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <span className="font-display text-2xl font-bold text-muted-foreground">
                        {item.title.slice(0, 2).toUpperCase()}
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
              <div className="p-3">
                <h3 className="font-display text-sm font-semibold text-foreground line-clamp-1">
                  {item.title}
                </h3>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-rating text-rating" />
                    {item.vote_average?.toFixed(1) ?? "—"}
                  </span>
                  {item.episodes_watched != null && <span>{item.episodes_watched} ep</span>}
                </div>
                <div className="mt-2 flex justify-end">
                  <PosterActions
                    media_type={item.media_type}
                    tmdb_id={item.tmdb_id}
                    title={item.title}
                    poster_path={item.poster_path}
                  />
                </div>
              </div>
            </div>
          );

          if (type === "tv") {
            const isFinished = (s: string | null) =>
              s === "Ended" || s === "Canceled" || s === "Cancelled";
            const active = filtered.filter((i) => !i.dropped);
            const dropped = filtered.filter((i) => i.dropped);
            const finished = active.filter((i) => isFinished(i.series_status));
            const upToDate = active.filter((i) => !isFinished(i.series_status));
            return (
              <div className="space-y-8">
                {upToDate.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Up to date
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({upToDate.length})
                      </span>
                    </h2>
                    <div className={gridClass}>
                      {upToDate.map((item, index) => renderCard(item, index))}
                    </div>
                  </section>
                )}
                {finished.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Finished
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({finished.length})
                      </span>
                    </h2>
                    <div className={gridClass}>
                      {finished.map((item, index) => renderCard(item, upToDate.length + index))}
                    </div>
                  </section>
                )}
                {dropped.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="font-display text-lg font-semibold text-muted-foreground">
                      Dropped
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({dropped.length})
                      </span>
                    </h2>
                    <div className={gridClass}>
                      {dropped.map((item, index) =>
                        renderCard(item, upToDate.length + finished.length + index),
                      )}
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
