import { Link } from "@tanstack/react-router";
import { backdropUrl, posterUrl, type MediaItem } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Star, Plus, Check } from "lucide-react";

interface HeroSectionProps {
  item: MediaItem;
  inWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  label?: string;
  reason?: string;
}

export function HeroSection({
  item,
  inWatchlist,
  onToggleWatchlist,
  label = "Trending",
  reason,
}: HeroSectionProps) {
  const backdrop = backdropUrl(item.backdrop_path);
  const poster = posterUrl(item.poster_path);
  const year = item.release_date
    ? new Date(item.release_date).getFullYear()
    : null;
  const to = item.media_type === "tv" ? "/serie/$id" : "/movie/$id";
  const params = { id: String(item.id) };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border">
      {/* Background */}
      <div className="absolute inset-0">
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
        {/* Strong readability overlay: dark base + left-to-right dark fade + bottom fade */}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch sm:p-8 lg:p-10">
        {/* Poster */}
        <div className="hidden sm:block sm:w-40 md:w-48 lg:w-52 flex-shrink-0">
          <Link
            to={to}
            params={params}
            className="block aspect-[2/3] overflow-hidden rounded-xl border border-border shadow-2xl"
          >
            {poster ? (
              <img
                src={poster}
                alt={item.title}
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <span className="font-display text-3xl font-bold text-muted-foreground">
                  {item.title.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Content — constrained to poster height on sm+ */}
        <div className="flex flex-1 min-w-0 flex-col gap-3 sm:max-h-60 md:max-h-72 lg:max-h-[19.5rem] sm:overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary text-primary-foreground hover:bg-primary shadow">
              {label}
            </Badge>
            <Badge className="bg-white/15 text-white backdrop-blur hover:bg-white/25 border-white/20">
              {item.media_type === "tv" ? "TV Series" : "Movie"}
            </Badge>
            {year && (
              <Badge className="bg-white/15 text-white backdrop-blur hover:bg-white/25 border-white/20">
                {year}
              </Badge>
            )}
            <Badge className="bg-white/15 text-white backdrop-blur hover:bg-white/25 border-white/20 flex items-center gap-1">
              <Star className="h-3 w-3 fill-rating text-rating" />
              {item.vote_average.toFixed(1)}
            </Badge>
          </div>

          {reason && (
            <p className="text-xs font-medium uppercase tracking-wide text-white/80 line-clamp-1">
              {reason}
            </p>
          )}

          <Link
            to={to}
            params={params}
            className="font-display text-2xl font-bold tracking-tight text-white line-clamp-2 hover:underline sm:text-3xl lg:text-4xl"
          >
            {item.title}
          </Link>

          <Link
            to={to}
            params={params}
            className="max-w-2xl text-sm leading-relaxed text-white/85 line-clamp-3 hover:text-white sm:line-clamp-4"
          >
            {item.overview || "No description available."}
          </Link>

          <div className="mt-auto flex flex-wrap gap-3 pt-1">
            <Button asChild className="gap-2">
              <Link to={to} params={params}>
                <FileText className="h-4 w-4" />
                Details
              </Link>
            </Button>
            <Button
              variant={inWatchlist ? "secondary" : "outline"}
              className={
                inWatchlist
                  ? "gap-2"
                  : "gap-2 bg-white/10 text-white border-white/30 backdrop-blur hover:bg-white/20 hover:text-white"
              }
              onClick={onToggleWatchlist}
            >
              {inWatchlist ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {inWatchlist ? "In library" : "Add to library"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
