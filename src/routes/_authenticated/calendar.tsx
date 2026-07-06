import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingReleases, type UpcomingItem } from "@/lib/calendar.functions";
import { posterUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Film, Tv } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — TomodachiTV" },
      {
        name: "description",
        content:
          "Upcoming releases from your watchlist: next episodes and movie premieres.",
      },
      { property: "og:title", content: "Calendar — TomodachiTV" },
      {
        property: "og:description",
        content:
          "Upcoming releases from your watchlist: next episodes and movie premieres.",
      },
    ],
  }),
  component: CalendarPage,
});

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(dateStr: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return `In ${diff} days`;
  if (diff < 30) {
    const w = Math.round(diff / 7);
    return `In ${w} ${w === 1 ? "week" : "weeks"}`;
  }
  const m = Math.round(diff / 30);
  return `In ${m} ${m === 1 ? "month" : "months"}`;
}

function groupByDate(items: UpcomingItem[]) {
  const groups = new Map<string, UpcomingItem[]>();
  for (const it of items) {
    const arr = groups.get(it.release_date) ?? [];
    arr.push(it);
    groups.set(it.release_date, arr);
  }
  return Array.from(groups.entries());
}

function CalendarPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["upcoming"],
    queryFn: () => getUpcomingReleases(),
  });

  const grouped = groupByDate(items);

  return (
    <div className="space-y-6 pt-12 sm:pt-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming releases from your watchlist.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No upcoming releases</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add movies or series to your{" "}
            <Link to="/watchlist" className="text-primary underline">
              watchlist
            </Link>{" "}
            to see their next release dates here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, entries]) => (
            <section key={date} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {formatDay(date)}
                </h2>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {daysUntil(date)}
                </span>
              </div>
              <div className="space-y-2">
                {entries.map((item) => (
                  <UpcomingRow key={`${item.media_type}-${item.tmdb_id}`} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const poster = posterUrl(item.poster_path, "w185");
  const to = item.media_type === "tv" ? "/serie/$id" : "/movie/$id";
  return (
    <Link
      to={to}
      params={{ id: String(item.tmdb_id) }}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-surface"
    >
      <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
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
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            {item.media_type === "tv" ? (
              <Tv className="h-3 w-3" />
            ) : (
              <Film className="h-3 w-3" />
            )}
            {item.media_type === "tv" ? "Series" : "Movie"}
          </Badge>
          {item.media_type === "tv" &&
            item.season_number != null &&
            item.episode_number != null && (
              <Badge variant="outline" className="border-border">
                S{String(item.season_number).padStart(2, "0")}E
                {String(item.episode_number).padStart(2, "0")}
              </Badge>
            )}
        </div>
        <p className="truncate font-medium text-foreground">{item.title}</p>
        {item.episode_name && (
          <p className="truncate text-sm text-muted-foreground">
            {item.episode_name}
          </p>
        )}
      </div>
    </Link>
  );
}
