import { Link } from "@tanstack/react-router";
import { posterUrl } from "@/lib/tmdb";
import { Star } from "lucide-react";
import type { SeriesResult } from "@/lib/tmdb";

interface SeriesCardProps {
  series: SeriesResult;
}

export function SeriesCard({ series }: SeriesCardProps) {
  const image = posterUrl(series.poster_path);
  const year = series.first_air_date
    ? new Date(series.first_air_date).getFullYear()
    : null;

  return (
    <Link
      to="/serie/$id"
      params={{ id: String(series.id) }}
      className="group relative block overflow-hidden rounded-xl bg-card transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted">
        {image ? (
          <img
            src={image}
            alt={series.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted p-4 text-center">
            <span className="font-display text-2xl font-bold text-muted-foreground">
              {series.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16">
        <h3 className="font-display text-base font-semibold leading-tight text-white line-clamp-2">
          {series.name}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
          {year && <span>{year}</span>}
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-rating text-rating" />
            {series.vote_average.toFixed(1)}
          </span>
        </div>
      </div>
    </Link>
  );
}
