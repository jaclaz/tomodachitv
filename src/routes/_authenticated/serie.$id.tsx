import { ExpandableText } from "@/components/expandable-text";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSeriesDetails, posterUrl, backdropUrl } from "@/lib/tmdb";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setLibraryStatus,
} from "@/lib/watchlist.functions";
import { EpisodeList } from "@/components/episode-list";
import { CastList } from "@/components/cast-list";
import { SeriesInfo } from "@/components/series-info";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Star, ArrowLeft, Clock, X, Play } from "lucide-react";
import { WatchProviders } from "@/components/watch-providers";
import { WatchLanguages } from "@/components/watch-languages";
import { FavoriteButton, AddToListButton } from "@/components/list-actions";
import { SearchBar } from "@/components/search-bar";
import { RelatedTitles } from "@/components/related-titles";
import { RatingButton } from "@/components/rating-input";


export const Route = createFileRoute("/_authenticated/serie/$id")({
  component: SeriesDetailPage,
});

function SeriesDetailPage() {
  const { id } = Route.useParams();
  const tmdbId = Number(id);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["series", tmdbId],
    queryFn: () => getSeriesDetails({ data: { id: tmdbId } }),
    enabled: !isNaN(tmdbId),
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const libItem = watchlist.find(
    (w) => w.media_type === "tv" && w.tmdb_id === tmdbId
  );
  const inWatchlist = !!libItem;
  const isDropped = libItem?.status === "dropped";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["watched-library"] });
    queryClient.invalidateQueries({ queryKey: ["currently-watching"] });
  };

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
          status: "watching",
        },
      }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      removeFromWatchlist({ data: { tmdb_id: tmdbId, media_type: "tv" } }),
    onSuccess: invalidate,
  });

  const dropMutation = useMutation({
    mutationFn: (status: "dropped" | "watching") =>
      setLibraryStatus({ data: { tmdb_id: tmdbId, media_type: "tv", status } }),
    onSuccess: invalidate,
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => router.history.back()}
          className="-ml-2 gap-2 self-start text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <SearchBar />
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-border">
        <div className="absolute inset-0">
          {backdrop ? (
            <img src={backdrop} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20" />
          )}
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--canvas)_0%,color-mix(in_oklab,var(--canvas)_88%,transparent)_22%,color-mix(in_oklab,var(--canvas)_65%,transparent)_45%,color-mix(in_oklab,var(--canvas)_35%,transparent)_70%,transparent_100%)]" />
        </div>

        <div className="relative grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
          <div className="hidden sm:block sm:w-40 md:w-48 lg:w-52">
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

          <div className="min-h-0 overflow-y-auto flex flex-col gap-4">
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

            <ExpandableText
              text={series.overview || "No description available."}
              lines={5}
              className="text-sm leading-relaxed text-muted-foreground sm:text-base"
            />



            <div className="mt-auto flex flex-wrap gap-3">
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
                {inWatchlist ? "In your library" : "Add to library"}
              </Button>
              {inWatchlist && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    dropMutation.mutate(isDropped ? "watching" : "dropped")
                  }
                  disabled={dropMutation.isPending}
                >
                  {isDropped ? (
                    <>
                      <Play className="h-4 w-4" /> Resume
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" /> Drop show
                    </>
                  )}
                </Button>
              )}
              <RatingButton
                media_type="tv"
                tmdb_id={series.id}
                title={series.title}
                poster_path={series.poster_path}
              />
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

      <EpisodeList series={series} />

      <WatchProviders tmdbId={tmdbId} type="tv" />

      <CastList id={tmdbId} type="tv" />

      <WatchLanguages
        tmdbId={tmdbId}
        mediaType="tv"
        title={series.title}
        year={year ?? undefined}
      />

      <SeriesInfo series={series} />

      <RelatedTitles id={tmdbId} type="tv" />

    </div>
  );
}

