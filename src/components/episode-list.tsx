import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getSeasonDetails,
  posterUrl,
  type Episode,
  type SeriesDetails,
} from "@/lib/tmdb";
import {
  getWatchedEpisodes,
  markEpisodeWatched,
  unmarkEpisodeWatched,
} from "@/lib/watched.functions";
import { Clock } from "lucide-react";

interface EpisodeListProps {
  series: SeriesDetails;
}

function getReleaseCountdown(airDate: string | undefined | null): string | null {
  if (!airDate) return null;
  const air = new Date(airDate + "T00:00:00");
  if (isNaN(air.getTime())) return null;
  const now = new Date();
  const diffMs = air.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.ceil(diffMs / day);
  if (days < 1) {
    const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"}`;
}

export function EpisodeList({ series }: EpisodeListProps) {
  const [activeSeason, setActiveSeason] = useState(() => {
    const first = series.seasons.find((s) => s.season_number > 0);
    return first?.season_number ?? 1;
  });

  const tmdbId = series.id;
  const queryClient = useQueryClient();

  const runtimeFallback =
    series.episode_run_time && series.episode_run_time.length > 0
      ? series.episode_run_time[0]
      : null;

  const { data: seasonDetails, isLoading } = useQuery({
    queryKey: ["season", tmdbId, activeSeason],
    queryFn: () => getSeasonDetails({ data: { id: tmdbId, season: activeSeason } }),
    enabled: !!activeSeason,
  });

  const { data: watched = [] } = useQuery({
    queryKey: ["watched", tmdbId],
    queryFn: () => getWatchedEpisodes({ data: { tmdb_id: tmdbId } }),
  });

  const markMutation = useMutation({
    mutationFn: (vars: {
      tmdb_id: number;
      season_number: number;
      episode_number: number;
      episode_name?: string;
      runtime_minutes?: number | null;
    }) => markEpisodeWatched({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched", tmdbId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const unmarkMutation = useMutation({
    mutationFn: (vars: {
      tmdb_id: number;
      season_number: number;
      episode_number: number;
    }) => unmarkEpisodeWatched({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched", tmdbId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const watchedSet = new Set(
    watched.map((w) => `${w.season_number}-${w.episode_number}`)
  );

  const isWatched = (ep: Episode) =>
    watchedSet.has(`${ep.season_number}-${ep.episode_number}`);

  const toggleEpisode = (ep: Episode) => {
    if (isWatched(ep)) {
      unmarkMutation.mutate({
        tmdb_id: tmdbId,
        season_number: ep.season_number,
        episode_number: ep.episode_number,
      });
    } else {
      markMutation.mutate({
        tmdb_id: tmdbId,
        season_number: ep.season_number,
        episode_number: ep.episode_number,
        episode_name: ep.name,
        runtime_minutes: ep.runtime ?? runtimeFallback,
      });
    }
  };

  const seasons = series.seasons.filter((s) => s.season_number > 0);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <Tabs value={String(activeSeason)} onValueChange={(v) => setActiveSeason(Number(v))}>
        <div className="border-b border-border px-4 pt-4">
          <TabsList className="bg-transparent p-0">
            {seasons.map((seasonInfo) => (
              <TabsTrigger
                key={seasonInfo.season_number}
                value={String(seasonInfo.season_number)}
                className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                Season {seasonInfo.season_number}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {seasons.map((seasonInfo) => (
          <TabsContent
            key={seasonInfo.season_number}
            value={String(seasonInfo.season_number)}
            className="m-0"
          >
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading episodes...
                </div>
              ) : !seasonDetails?.episodes?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  No episodes available.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {seasonDetails.episodes.map((ep) => {
                    const watched = isWatched(ep);
                    const still = posterUrl(ep.still_path, "w300");
                    const countdown = getReleaseCountdown(ep.air_date);
                    const unreleased = countdown !== null;
                    return (
                      <li
                        key={ep.id}
                        className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/30"
                      >
                        <div className="aspect-video w-32 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:w-40">
                          {still ? (
                            <img
                              src={still}
                              alt={ep.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <label
                          htmlFor={`ep-${ep.id}`}
                          className={`flex-1 ${unreleased ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {ep.episode_number}. {ep.name}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              {ep.runtime ? (
                                <>
                                  <Clock className="h-3 w-3" />
                                  {ep.runtime} min
                                </>
                              ) : null}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {ep.overview || "No description."}
                          </p>
                        </label>
                        {unreleased ? (
                          <span className="flex-shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
                            in {countdown}
                          </span>
                        ) : (
                          <Checkbox
                            id={`ep-${ep.id}`}
                            checked={watched}
                            onCheckedChange={() => toggleEpisode(ep)}
                            className="h-6 w-6 flex-shrink-0"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
