import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { discoverContent, type MediaType } from "@/lib/tmdb";
import { getTrendingLists, saveList, unsaveList } from "@/lib/lists.functions";
import { posterUrl } from "@/lib/tmdb";
import { MediaCard } from "@/components/media-card";
import { SearchBar } from "@/components/search-bar";
import { FilterBar, DEFAULT_FILTERS, type FilterState } from "@/components/filter-bar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, Flame, Grid2x2, Grid3x3 } from "lucide-react";
import { toast } from "sonner";
import { detectRegion } from "@/lib/region";
import { getCountryTrending } from "@/lib/trending.functions";

export const Route = createFileRoute("/_authenticated/trending")({
  component: TrendingPage,
});



function TrendingPage() {
  const [type, setType] = useState<MediaType>("tv");
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    watchRegion: detectRegion(),
  }));
  const [gridSize, setGridSize] = useState<"normal" | "small">(() => {
    if (typeof window === "undefined") return "normal";
    return (localStorage.getItem("trending-grid-size") as "normal" | "small") || "normal";
  });
  const setGrid = (size: "normal" | "small") => {
    setGridSize(size);
    if (typeof window !== "undefined") localStorage.setItem("trending-grid-size", size);
  };
  const gridClass =
    gridSize === "small"
      ? "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
      : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";


  // With no catalog filters active we show the country-aware trending engine.
  const trendMode =
    filters.providerId == null &&
    filters.genreId == null &&
    filters.yearFrom == null &&
    filters.yearTo == null &&
    filters.minRating == null &&
    filters.sortBy === "popularity.desc";

  const { data, isFetching } = useQuery({
    queryKey: trendMode
      ? ["country-trending", type, filters.watchRegion]
      : ["discover", type, filters],
    placeholderData: undefined,
    queryFn: () =>
      trendMode
        ? getCountryTrending({ data: { type, country: filters.watchRegion } })
        : discoverContent({
        data: {
          type,
          genreId: filters.genreId,
          yearFrom: filters.yearFrom,
          yearTo: filters.yearTo,
          minRating: filters.minRating,
          sortBy: filters.sortBy,
          providerId: filters.providerId,
          watchRegion: filters.watchRegion,
        },
      }),
  });
  const fallback = trendMode && data && "fallback" in data ? data.fallback : false;

  const results = data?.results ?? [];
  const providerActive = filters.providerId != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Discover
          </h1>
          <p className="text-sm text-muted-foreground">
            {providerActive
              ? `Trending on your selected service in ${filters.watchRegion}.`
              : trendMode
                ? `What people are watching in ${filters.watchRegion} this week.${fallback ? " Topped up with regional popularity while local activity grows." : ""}`
                : `Filter and sort the catalog for ${filters.watchRegion}.`}
          </p>
        </div>
        <SearchBar />
      </div>


      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Tabs value={type} onValueChange={(v) => setType(v as MediaType)}>
            <TabsList>
              <TabsTrigger value="tv">TV Shows</TabsTrigger>
              <TabsTrigger value="movie">Movies</TabsTrigger>
            </TabsList>
          </Tabs>
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
        <FilterBar type={type} value={filters} onChange={setFilters} />
      </div>

      {isFetching ? (
        <div className={gridClass}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No results match these filters.
        </p>
      ) : (
        <div className={gridClass}>
          {results.map((item) => (
            <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      )}

      <TrendingListsSection />
    </div>
  );
}

function TrendingListsSection() {
  const qc = useQueryClient();
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["trending-lists"],
    queryFn: () => getTrendingLists(),
  });
  const saveMut = useMutation({
    mutationFn: ({ id, save }: { id: string; save: boolean }) =>
      save ? saveList({ data: { list_id: id } }) : unsaveList({ data: { list_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trending-lists"] });
      qc.invalidateQueries({ queryKey: ["saved-lists"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || lists.length === 0) return null;

  return (
    <section className="space-y-4 pt-4">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Trending Lists</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((l) => {
          const posters = l.preview_posters ?? [];
          return (
            <div key={l.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              <Link to="/list/$id" params={{ id: l.id }} className="block">
                <div className="grid aspect-[16/9] grid-cols-4 gap-[2px] bg-muted">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const p = posters[i];
                    return (
                      <div key={i} className="overflow-hidden bg-muted">
                        {p ? (
                          <img src={posterUrl(p)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1 p-3">
                  <h3 className="line-clamp-1 font-semibold">{l.title}</h3>
                  {l.owner && (
                    <p className="text-[11px] text-muted-foreground">
                      by @{l.owner.username}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {l.item_count ?? 0} items · {l.saves_count ?? 0} saves
                  </p>
                </div>
              </Link>
              <Button
                size="sm"
                variant={l.is_saved_by_me ? "secondary" : "default"}
                onClick={(e) => {
                  e.preventDefault();
                  saveMut.mutate({ id: l.id, save: !l.is_saved_by_me });
                }}
                disabled={saveMut.isPending}
                className="absolute right-2 top-2 h-8 gap-1"
              >
                {l.is_saved_by_me ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

