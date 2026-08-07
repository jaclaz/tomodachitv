import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getWatchlist } from "@/lib/watchlist.functions";
import { getAllWatchedStats } from "@/lib/watched.functions";
import { getAdvancedStats } from "@/lib/stats.functions";
import { StatsStrip } from "@/components/stats-strip";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-6 ${className}`}>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  valueLabel?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{valueLabel ?? value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatsPage() {
  const [showAllProgress, setShowAllProgress] = useState(false);
  const { data: watchlist = [] } = useQuery({

    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getAllWatchedStats(),
  });

  const { data: adv, isLoading: advLoading } = useQuery({
    queryKey: ["advanced-stats"],
    queryFn: () => getAdvancedStats(),
  });

  const tvCount = watchlist.filter((w) => w.media_type === "tv").length;
  const movieCount = watchlist.filter((w) => w.media_type === "movie").length;

  const topGenres = adv?.genres.slice(0, 6) ?? [];
  const maxGenreMin = topGenres[0]?.minutes ?? 0;

  const maxDecade = adv?.decades.reduce((m, d) => Math.max(m, d.count), 0) ?? 0;
  const maxWeekday =
    adv?.weekdayMinutes.reduce((m, d) => Math.max(m, d.minutes), 0) ?? 0;
  const totalTvMovie = (adv?.tvMinutes ?? 0) + (adv?.movieMinutes ?? 0);
  const tvPct = totalTvMovie > 0 ? ((adv?.tvMinutes ?? 0) / totalTvMovie) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold text-foreground">Stats</h1>
        <p className="text-sm text-muted-foreground">
          A summary of your watching habits.
        </p>
      </div>

      <StatsStrip
        totalEpisodes={stats?.totalEpisodes ?? 0}
        totalMovies={stats?.totalMovies ?? 0}
        totalMinutes={stats?.totalMinutes ?? 0}
        watchlistCount={watchlist.length}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold">In your list</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tvCount} TV show{tvCount === 1 ? "" : "s"} and {movieCount} movie
            {movieCount === 1 ? "" : "s"} saved.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg font-semibold">Total watch time</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            About {Math.round((stats?.totalMinutes ?? 0) / 60)} hours of content
            watched.
          </p>
        </div>
      </div>

      {/* ============ Habits ============ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Your habits</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Last 7 days">
            <p className="font-display text-3xl font-bold">
              {formatHours(adv?.minutesLast7 ?? 0)}
            </p>
          </Card>
          <Card title="Last 30 days">
            <p className="font-display text-3xl font-bold">
              {formatHours(adv?.minutesLast30 ?? 0)}
            </p>
          </Card>
          <Card title="Last 90 days">
            <p className="font-display text-3xl font-bold">
              {formatHours(adv?.minutesLast90 ?? 0)}
            </p>
          </Card>
        </div>

        <Card
          title="Weekday habits"
          subtitle={
            adv?.busiestWeekday
              ? `You watch the most on ${adv.busiestWeekday}`
              : "When you tend to watch"
          }
        >
          {advLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : maxWeekday === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-32">
              {adv?.weekdayMinutes.map((d) => {
                const h = maxWeekday > 0 ? (d.minutes / maxWeekday) * 100 : 0;
                return (
                  <div
                    key={d.day}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t bg-primary transition-all"
                        style={{ height: `${h}%` }}
                        title={`${d.day}: ${formatHours(d.minutes)}`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {/* ============ Tastes ============ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Your tastes</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            title="Top genres"
            subtitle="By minutes watched (split across each title's genres)"
          >
            {advLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : topGenres.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No data yet. Mark something as watched to see this.
              </p>
            ) : (
              <div className="space-y-3">
                {topGenres.map((g) => (
                  <BarRow
                    key={g.name}
                    label={g.name}
                    value={g.minutes}
                    max={maxGenreMin}
                    valueLabel={formatHours(g.minutes)}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card title="Decades" subtitle="Release decade of what you watch">
            {advLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !adv?.decades.length ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {adv.decades.map((d) => (
                  <BarRow
                    key={d.decade}
                    label={d.decade}
                    value={d.count}
                    max={maxDecade}
                    valueLabel={`${d.count} title${d.count === 1 ? "" : "s"}`}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Average rating"
            subtitle="TMDB score of the titles you've watched"
          >
            {advLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : adv?.avgRating == null ? (
              <p className="text-sm text-muted-foreground">Not enough data.</p>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold">
                  {adv.avgRating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  / 10 · across {adv.ratedCount} title
                  {adv.ratedCount === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </Card>

          <Card title="TV vs Movies" subtitle="Distribution of your watch time">
            {advLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : totalTvMovie === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="bg-primary"
                    style={{ width: `${tvPct}%` }}
                  />
                  <div
                    className="bg-accent"
                    style={{ width: `${100 - tvPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    TV · {formatHours(adv?.tvMinutes ?? 0)} (
                    {Math.round(tvPct)}%)
                  </span>
                  <span>
                    Movies · {formatHours(adv?.movieMinutes ?? 0)} (
                    {Math.round(100 - tvPct)}%)
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* ============ Progress ============ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Your progress</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            title="Seasons completed"
            subtitle="Full seasons watched across all your shows"
          >
            <p className="font-display text-4xl font-bold">
              {adv?.seasonsCompleted ?? 0}
            </p>
          </Card>

          <Card
            title="Most-watched shows"
            subtitle="By number of episodes viewed"
          >
            {advLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !adv?.topSeriesByEpisodes.length ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {adv.topSeriesByEpisodes.map((s, i) => (
                  <li key={s.tmdb_id} className="flex items-center gap-3">
                    <span className="w-4 text-muted-foreground">{i + 1}.</span>
                    <Link
                      to="/serie/$id"
                      params={{ id: String(s.tmdb_id) }}
                      className="flex-1 truncate hover:underline"
                    >
                      {s.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {s.episodes} ep
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card
          title="Series in progress"
          subtitle="Aired episodes you've watched, most recent first"
        >
          {advLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !adv?.seriesInProgress.length ? (
            <p className="text-sm text-muted-foreground">
              Nothing in progress right now.
            </p>
          ) : (
            <div className="space-y-3">
              {(showAllProgress
                ? adv.seriesInProgress
                : adv.seriesInProgress.slice(0, 8)
              ).map((s) => (
                <div key={s.tmdb_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Link
                      to="/serie/$id"
                      params={{ id: String(s.tmdb_id) }}
                      className="truncate text-foreground hover:underline"
                    >
                      {s.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {s.watched}/{s.total} · {s.percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${s.percent}%` }}
                    />
                  </div>
                </div>
              ))}
              {adv.seriesInProgress.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllProgress((v) => !v)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {showAllProgress
                    ? "Show less"
                    : `Show all ${adv.seriesInProgress.length}`}
                </button>
              )}
            </div>
          )}
        </Card>

      </section>
    </div>
  );
}
