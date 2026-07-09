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
import { Bookmark, BookmarkCheck, Flame } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trending")({
  component: TrendingPage,
});


function TrendingPage() {
  const [type, setType] = useState<MediaType>("tv");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const { data, isFetching } = useQuery({
    queryKey: ["discover", type, filters],
    queryFn: () =>
      discoverContent({
        data: {
          type,
          genreId: filters.genreId,
          yearFrom: filters.yearFrom,
          yearTo: filters.yearTo,
          minRating: filters.minRating,
          sortBy: filters.sortBy,
        },
      }),
  });

  const results = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pt-12 sm:pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Discover
          </h1>
          <p className="text-sm text-muted-foreground">
            Filter and sort the TMDB catalog.
          </p>
        </div>
        <SearchBar />
      </div>

      <div className="flex flex-col gap-3">
        <Tabs value={type} onValueChange={(v) => setType(v as MediaType)}>
          <TabsList>
            <TabsTrigger value="tv">TV Shows</TabsTrigger>
            <TabsTrigger value="movie">Movies</TabsTrigger>
          </TabsList>
        </Tabs>
        <FilterBar type={type} value={filters} onChange={setFilters} />
      </div>

      {isFetching && results.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No results match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((item) => (
            <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
