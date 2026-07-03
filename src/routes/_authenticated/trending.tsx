import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getTrendingAll,
  getTrendingSeries,
  getTrendingMovies,
} from "@/lib/tmdb";
import { MediaCard } from "@/components/media-card";
import { SearchBar } from "@/components/search-bar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/trending")({
  component: TrendingPage,
});

type Filter = "all" | "tv" | "movie";

function TrendingPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: all } = useQuery({
    queryKey: ["trending", "all"],
    queryFn: () => getTrendingAll(),
  });
  const { data: tv } = useQuery({
    queryKey: ["trending", "tv"],
    queryFn: () => getTrendingSeries(),
  });
  const { data: movies } = useQuery({
    queryKey: ["trending", "movie"],
    queryFn: () => getTrendingMovies(),
  });

  const source = filter === "tv" ? tv : filter === "movie" ? movies : all;
  const results = source?.results ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 pt-12 sm:pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Trending
          </h1>
          <p className="text-sm text-muted-foreground">
            The most popular titles this week.
          </p>
        </div>
        <SearchBar />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="tv">TV Shows</TabsTrigger>
          <TabsTrigger value="movie">Movies</TabsTrigger>
        </TabsList>
      </Tabs>

      {!source ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
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
