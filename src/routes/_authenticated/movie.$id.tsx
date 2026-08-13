import { ExpandableText } from "@/components/expandable-text";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMovieDetails, posterUrl, backdropUrl } from "@/lib/tmdb";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist.functions";
import {
  getWatchedMovies,
  markMovieWatched,
  unmarkMovieWatched,
} from "@/lib/watched.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Star, ArrowLeft, Clock, Eye, EyeOff } from "lucide-react";
import { WatchProviders } from "@/components/watch-providers";
import { WatchLanguages } from "@/components/watch-languages";
import { CastList } from "@/components/cast-list";
import { MovieInfo } from "@/components/movie-info";
import { FavoriteButton, AddToListButton } from "@/components/list-actions";
import { SearchBar } from "@/components/search-bar";
import { RelatedTitles } from "@/components/related-titles";


export const Route = createFileRoute("/_authenticated/movie/$id")({
  component: MovieDetailPage,
});

function MovieDetailPage() {
  const { id } = Route.useParams();
  const tmdbId = Number(id);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: movie, isLoading } = useQuery({
    queryKey: ["movie", tmdbId],
    queryFn: () => getMovieDetails({ data: { id: tmdbId } }),
    enabled: !isNaN(tmdbId),
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const { data: watchedMovies = [] } = useQuery({
    queryKey: ["watchedMovies"],
    queryFn: () => getWatchedMovies(),
  });

  const inWatchlist = watchlist.some(
    (w) => w.media_type === "movie" && w.tmdb_id === tmdbId
  );
  const isWatched = watchedMovies.some((m) => m.tmdb_id === tmdbId);

  const addMutation = useMutation({
    mutationFn: () =>
      addToWatchlist({
        data: {
          tmdb_id: movie!.id,
          media_type: "movie",
          series_name: movie!.title,
          poster_path: movie!.poster_path,
          backdrop_path: movie!.backdrop_path,
          first_air_date: movie!.release_date,
          vote_average: movie!.vote_average,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      removeFromWatchlist({ data: { tmdb_id: tmdbId, media_type: "movie" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const markMutation = useMutation({
    mutationFn: () =>
      markMovieWatched({
        data: {
          tmdb_id: movie!.id,
          title: movie!.title,
          runtime_minutes: movie!.runtime,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchedMovies"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const unmarkMutation = useMutation({
    mutationFn: () => unmarkMovieWatched({ data: { tmdb_id: tmdbId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchedMovies"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  if (isLoading || !movie) {
    return (
      <div className="space-y-6 pt-12 sm:pt-0">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const backdrop = backdropUrl(movie.backdrop_path);
  const poster = posterUrl(movie.poster_path);
  const year = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : null;
  const releaseDate = movie.release_date ? new Date(movie.release_date + "T00:00:00") : null;
  const isUnreleased = !!releaseDate && releaseDate.getTime() > Date.now();

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
                  alt={movie.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <span className="font-display text-3xl font-bold text-muted-foreground">
                    {movie.title.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Movie</Badge>
              {year && <Badge variant="secondary">{year}</Badge>}
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-rating text-rating" />
                {movie.vote_average.toFixed(1)}
              </Badge>
              {movie.runtime && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {movie.runtime} min
                </Badge>
              )}
              {movie.genres.map((g) => (
                <Badge key={g.id} variant="outline" className="border-border">
                  {g.name}
                </Badge>
              ))}
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {movie.title}
            </h1>

            <ExpandableText
              text={movie.overview || "No description available."}
              lines={5}
              className="text-sm leading-relaxed text-muted-foreground sm:text-base"
            />


            <div className="mt-auto flex flex-wrap gap-3">
              {isUnreleased ? (
                <Button variant="secondary" className="gap-2" disabled>
                  <Clock className="h-4 w-4" />
                  Not yet released
                </Button>
              ) : (
                <Button
                  variant={isWatched ? "secondary" : "default"}
                  className="gap-2"
                  onClick={() =>
                    isWatched ? unmarkMutation.mutate() : markMutation.mutate()
                  }
                >
                  {isWatched ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {isWatched ? "Mark as unwatched" : "Mark as watched"}
                </Button>
              )}
              <Button
                variant={inWatchlist ? "secondary" : "outline"}
                className="gap-2"
                onClick={() =>
                  inWatchlist ? removeMutation.mutate() : addMutation.mutate()
                }
              >
                {inWatchlist ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {inWatchlist ? "In your library" : "Add to library"}
              </Button>
              <FavoriteButton
                media_type="movie"
                tmdb_id={movie.id}
                title={movie.title}
                poster_path={movie.poster_path}
              />
              <AddToListButton
                media_type="movie"
                tmdb_id={movie.id}
                title={movie.title}
                poster_path={movie.poster_path}
              />
            </div>
          </div>
        </div>
      </section>

      <WatchProviders tmdbId={tmdbId} type="movie" />

      <CastList id={tmdbId} type="movie" />

      <WatchLanguages
        tmdbId={tmdbId}
        mediaType="movie"
        title={movie.title}
        year={year ?? undefined}
      />

      <MovieInfo movie={movie} />

      <RelatedTitles id={tmdbId} type="movie" />
    </div>
  );
}

