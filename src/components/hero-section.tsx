import { Link } from "@tanstack/react-router";
import { backdropUrl, posterUrl, type MediaItem } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Star, Plus, Check } from "lucide-react";

interface HeroSectionProps {
  item: MediaItem;
  inWatchlist?: boolean;
  onToggleWatchlist?: () => void;
}

export function HeroSection({ item, inWatchlist, onToggleWatchlist }: HeroSectionProps) {
  const backdrop = backdropUrl(item.backdrop_path);
  const poster = posterUrl(item.poster_path);
  const year = item.release_date
    ? new Date(item.release_date).getFullYear()
    : null;
  const to = item.media_type === "tv" ? "/serie/$id" : "/movie/$id";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border">
      <div className="absolute inset-0">
        {backdrop ? (
          <img src={backdrop} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--canvas)_0%,color-mix(in_oklab,var(--canvas)_88%,transparent)_22%,color-mix(in_oklab,var(--canvas)_65%,transparent)_45%,color-mix(in_oklab,var(--canvas)_35%,transparent)_70%,transparent_100%)]" />
      </div>

      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-8 lg:p-10">
        <div className="hidden sm:block sm:w-40 md:w-48 lg:w-52 flex-shrink-0">
          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border shadow-2xl">
            {poster ? (
              <img src={poster} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <span className="font-display text-3xl font-bold text-muted-foreground">
                  {item.title.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
              Trending
            </Badge>
            <Badge variant="secondary">
              {item.media_type === "tv" ? "TV Series" : "Movie"}
            </Badge>
            {year && <Badge variant="secondary">{year}</Badge>}
            <Badge variant="secondary" className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-rating text-rating" />
              {item.vote_average.toFixed(1)}
            </Badge>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {item.title}
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {item.overview || "No description available."}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link to={to} params={{ id: String(item.id) }}>
                <Play className="h-4 w-4 fill-current" />
                Details
              </Link>
            </Button>
            <Button
              variant={inWatchlist ? "secondary" : "outline"}
              className="gap-2"
              onClick={onToggleWatchlist}
            >
              {inWatchlist ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {inWatchlist ? "In your list" : "Add to watchlist"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
