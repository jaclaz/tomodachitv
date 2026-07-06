import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSeriesDetails, posterUrl, backdropUrl } from "@/lib/tmdb";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist.functions";
import { EpisodeList } from "@/components/episode-list";
import { CastList } from "@/components/cast-list";
import { SeriesInfo } from "@/components/series-info";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Star, ArrowLeft, Clock } from "lucide-react";
import { WatchProviders } from "@/components/watch-providers";
import { FavoriteButton, AddToListButton } from "@/components/list-actions";


export const Route = createFileRoute("/_authenticated/serie/$id")({
  component: SeriesDetailPage,
});

function SeriesDetailPage() {
  const { id } = Route.useParams();
  const tmdbId = Number(id);
  const queryClient = useQueryClient();

  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["series", tmdbId],
    queryFn: () => getSeriesDetails({ data: { id: tmdbId } }),
    enabled: !isNaN(tmdbId),
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const inWatchlist = watchlist.some(
    (w) => w.media_type === "tv" && w.tmdb_id === tmdbId
  );

  const addMutation = useMutation({
    mutationFn: () =>
      addToWatchlist({
        data: {
          tmdb_id: series!.id,
          media_type: "tv",
          series_name: series!.title,
          poster_path: series!.poster_path,
          backdrop_path: series!.backdrop_path,
          first_air_date: series!.release_date,
          vote_average: series!.vote_average,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      removeFromWatchlist({ data: { tmdb_id: tmdbId, media_type: "tv" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const toggleWatchlist = () => {
    if (!series) return;
    if (inWatchlist) removeMutation.mutate();
    else addMutation.mutate();
  };

  if (seriesLoading || !series) {
    return (
      <div className="space-y-6 pt-12 sm:pt-0">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const backdrop = backdropUrl(series.backdrop_path);
  const poster = posterUrl(series.poster_path);
  const year = series.release_date
    ? new Date(series.release_date).getFullYear()
    : null;

  return (
    <div className="space-y-6 pt-12 sm:pt-0">
      <Button variant="ghost" asChild className="-ml-2 gap-2 text-muted-foreground">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <section className="relative overflow-hidden rounded-2xl border border-border">
        <div className="absolute inset-0">
          {backdrop ? (
            <img src={backdrop} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--canvas)_0%,color-mix(in_oklab,var(--canvas)_88%,transparent)_22%,color-mix(in_oklab,var(--canvas)_65%,transparent)_45%,color-mix(in_oklab,var(--canvas)_35%,transparent)_70%,transparent_100%)]" />
        </div>

        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-8">
          <div className="hidden sm:block sm:w-40 md:w-48 lg:w-52 flex-shrink-0">
            <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border shadow-2xl">
              {poster ? (
                <img
                  src={poster}
                  alt={series.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <span className="font-display text-3xl font-bold text-muted-foreground">
                    {series.title.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">TV Series</Badge>
              {year && <Badge variant="secondary">{year}</Badge>}
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-rating text-rating" />
                {series.vote_average.toFixed(1)}
              </Badge>
              {series.episode_run_time && series.episode_run_time.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(
                    series.episode_run_time.reduce((a, b) => a + b, 0) /
                      series.episode_run_time.length
                  )}{" "}
                  min avg
                </Badge>
              )}
              {series.genres.map((g) => (
                <Badge key={g.id} variant="outline" className="border-border">
                  {g.name}
                </Badge>
              ))}
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {series.title}
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {series.overview || "No description available."}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                variant={inWatchlist ? "secondary" : "default"}
                className="gap-2"
                onClick={toggleWatchlist}
              >
                {inWatchlist ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {inWatchlist ? "In your list" : "Add to watchlist"}
              </Button>
              <FavoriteButton
                media_type="tv"
                tmdb_id={series.id}
                title={series.title}
                poster_path={series.poster_path}
              />
              <AddToListButton
                media_type="tv"
                tmdb_id={series.id}
                title={series.title}
                poster_path={series.poster_path}
              />
            </div>
          </div>
        </div>
      </section>

      <WatchProviders tmdbId={tmdbId} type="tv" />

      <EpisodeList series={series} />

      <CastList id={tmdbId} type="tv" />

      <SeriesInfo series={series} />

    </div>
  );
}

