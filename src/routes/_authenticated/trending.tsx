import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTrendingSeries } from "@/lib/tmdb";
import { SeriesCard } from "@/components/series-card";
import { SearchBar } from "@/components/search-bar";

export const Route = createFileRoute("/_authenticated/trending")({
  component: TrendingPage,
});

function TrendingPage() {
  const { data: trending, isLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: () => getTrendingSeries(),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 pt-12 sm:pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            In Tendenza
          </h1>
          <p className="text-sm text-muted-foreground">
            Le serie più popolari di questa settimana.
          </p>
        </div>
        <SearchBar />
      </div>

      {isLoading ? (
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
          {trending?.results?.map((series) => (
            <SeriesCard key={series.id} series={series} />
          ))}
        </div>
      )}
    </div>
  );
}
