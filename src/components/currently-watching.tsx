import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { getCurrentlyWatching } from "@/lib/currently-watching.functions";
import { markEpisodeWatched } from "@/lib/watched.functions";
import { posterUrl } from "@/lib/tmdb";
import { toast } from "sonner";

export function CurrentlyWatching() {
  const queryClient = useQueryClient();

  const { data: shows, isLoading } = useQuery({
    queryKey: ["currently-watching"],
    queryFn: () => getCurrentlyWatching(),
  });

  const markNext = useMutation({
    mutationFn: (item: {
      tmdb_id: number;
      next_season: number;
      next_episode: number;
      runtime_minutes: number | null;
      title: string;
    }) =>
      markEpisodeWatched({
        data: {
          tmdb_id: item.tmdb_id,
          season_number: item.next_season,
          episode_number: item.next_episode,
          runtime_minutes: item.runtime_minutes,
        },
      }),
    onSuccess: (_res, vars) => {
      toast.success(
        `Marked ${vars.title} S${vars.next_season}·E${vars.next_episode} as watched`
      );
      queryClient.invalidateQueries({ queryKey: ["currently-watching"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["watched-library"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not mark episode"),
  });

  if (isLoading) {
    return (
      <section>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Currently watching
        </h2>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-40 w-72 flex-shrink-0 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!shows || shows.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Currently watching
        </h2>
        <span className="text-xs text-muted-foreground">
          Quick +1 for the next episode
        </span>
      </div>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {shows.map((s) => {
          const pending =
            markNext.isPending && markNext.variables?.tmdb_id === s.tmdb_id;
          const progress =
            s.total_episodes > 0
              ? Math.min(100, (s.episodes_watched / s.total_episodes) * 100)
              : 0;
          return (
            <div
              key={s.tmdb_id}
              className="group relative flex w-72 flex-shrink-0 snap-start gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/40"
            >
              <Link
                to="/serie/$id"
                params={{ id: String(s.tmdb_id) }}
                className="flex-shrink-0"
              >
                <div className="h-32 w-[86px] overflow-hidden rounded-md bg-muted">
                  {s.poster_path ? (
                    <img
                      src={posterUrl(s.poster_path, "w185")}
                      alt={s.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      {s.title.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="min-w-0">
                  <Link
                    to="/serie/$id"
                    params={{ id: String(s.tmdb_id) }}
                    className="block truncate font-display text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {s.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Next: S{s.next_season} · E{s.next_episode}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {s.episodes_watched}
                    {s.total_episodes > 0 ? ` / ${s.total_episodes}` : ""}{" "}
                    episodes
                  </p>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    markNext.mutate({
                      tmdb_id: s.tmdb_id,
                      next_season: s.next_season,
                      next_episode: s.next_episode,
                      runtime_minutes: s.runtime_minutes,
                      title: s.title,
                    })
                  }
                  className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Mark next watched
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
