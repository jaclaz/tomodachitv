import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingReleases } from "@/lib/calendar.functions";
import { posterUrl } from "@/lib/tmdb";
import { CalendarDays, ChevronRight } from "lucide-react";

function daysUntil(dateStr: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return `In ${diff}d`;
  if (diff < 30) return `In ${Math.round(diff / 7)}w`;
  return `In ${Math.round(diff / 30)}mo`;
}

export function UpcomingPreview() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["upcoming"],
    queryFn: () => getUpcomingReleases(),
  });

  if (!isLoading && items.length === 0) return null;

  const preview = items.slice(0, 4);

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold text-foreground">
            Upcoming
          </h2>
        </div>
        <Link
          to="/calendar"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          View calendar <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {preview.map((item, index) => {
            const to = item.media_type === "tv" ? "/serie/$id" : "/movie/$id";
            const poster = posterUrl(item.poster_path, "w185");
            return (
              <Link
                key={`${item.media_type}-${item.tmdb_id}-${item.season_number ?? "movie"}-${item.episode_number ?? index}`}
                to={to}
                params={{ id: String(item.tmdb_id) }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-surface"
              >
                <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                  {poster ? (
                    <img
                      src={poster}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  {item.media_type === "tv" &&
                  item.season_number != null &&
                  item.episode_number != null ? (
                    <p className="truncate text-xs text-muted-foreground">
                      S{String(item.season_number).padStart(2, "0")}E
                      {String(item.episode_number).padStart(2, "0")}
                    </p>
                  ) : (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.media_type === "tv" ? "Series" : "Movie"}
                    </p>
                  )}
                  <p className="text-xs font-medium text-primary">
                    {daysUntil(item.release_date)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
