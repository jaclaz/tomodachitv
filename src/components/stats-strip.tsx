import { Link } from "@tanstack/react-router";
import { Tv, Film, Clock, ListChecks } from "lucide-react";

interface StatsStripProps {
  totalEpisodes: number;
  totalMovies: number;
  totalMinutes: number;
  watchlistCount: number;
}

export function StatsStrip({
  totalEpisodes,
  totalMovies,
  totalMinutes,
  watchlistCount,
}: StatsStripProps) {
  const hours = Math.round(totalMinutes / 60);

  const stats = [
    { label: "Episodes watched", value: totalEpisodes, icon: Tv, suffix: "" },
    { label: "Movies watched", value: totalMovies, icon: Film, suffix: "" },
    { label: "Hours watched", value: hours, icon: Clock, suffix: "h" },
    { label: "In watchlist", value: watchlistCount, icon: ListChecks, suffix: "" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          to="/stats"
          aria-label={`${stat.label} — open stats`}
          className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/30 hover:bg-card"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <stat.icon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {stat.value}
            <span className="text-lg text-muted-foreground">{stat.suffix}</span>
          </p>
        </Link>
      ))}
    </div>
  );
}
