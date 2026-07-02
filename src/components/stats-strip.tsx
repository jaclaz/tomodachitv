import { Tv, Clock, ListChecks, Star } from "lucide-react";

interface StatsStripProps {
  totalEpisodes: number;
  totalMinutes: number;
  watchlistCount: number;
  averageRating: number;
}

export function StatsStrip({
  totalEpisodes,
  totalMinutes,
  watchlistCount,
  averageRating,
}: StatsStripProps) {
  const hours = Math.round(totalMinutes / 60);

  const stats = [
    {
      label: "Episodi visti",
      value: totalEpisodes,
      icon: Tv,
      suffix: "",
    },
    {
      label: "Ore guardate",
      value: hours,
      icon: Clock,
      suffix: "h",
    },
    {
      label: "In lista",
      value: watchlistCount,
      icon: ListChecks,
      suffix: "",
    },
    {
      label: "Media voti",
      value: averageRating.toFixed(1),
      icon: Star,
      suffix: "",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/30"
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
        </div>
      ))}
    </div>
  );
}
