import { Link } from "@tanstack/react-router";
import { posterUrl, type MediaItem } from "@/lib/tmdb";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getMyRatings } from "@/lib/ratings.functions";
import { ScoreBadge } from "@/components/rating-input";

interface MediaCardProps {
  item: MediaItem;
}

export function MediaCard({ item }: MediaCardProps) {
  const image = posterUrl(item.poster_path);
  const year = item.release_date
    ? new Date(item.release_date).getFullYear()
    : null;
  const to = item.media_type === "tv" ? "/serie/$id" : "/movie/$id";

  const { data: ratings = [] } = useQuery({
    queryKey: ["my-ratings"],
    queryFn: () => getMyRatings(),
    staleTime: 60_000,
  });
  const myScore =
    ratings.find((r) => r.media_type === item.media_type && r.tmdb_id === item.id)?.rating ??
    null;

  return (
    <Link
      to={to}
      params={{ id: String(item.id) }}
      className="group relative block overflow-hidden rounded-xl bg-card transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted">
        {image ? (
          <img
            src={image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted p-4 text-center">
            <span className="font-display text-2xl font-bold text-muted-foreground">
              {item.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="absolute right-2 top-2">
        <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
          {item.media_type === "tv" ? "TV" : "Movie"}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 poster-fade" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="font-display text-base font-semibold leading-tight text-white line-clamp-2">
          {item.title}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
          {year && <span>{year}</span>}
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-rating text-rating" />
            {item.vote_average.toFixed(1)}
          </span>
          <ScoreBadge value={myScore} />
        </div>
      </div>
    </Link>
  );
}
