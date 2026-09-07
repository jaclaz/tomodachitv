import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getSeasonDetails,
  posterUrl,
  type Episode,
  type SeriesDetails,
} from "@/lib/tmdb";
import {
  getWatchedEpisodes,
  markEpisodeWatched,
  markEpisodesBulk,
  unmarkEpisodeWatched,
} from "@/lib/watched.functions";
import { ChevronLeft, ChevronRight, Clock, CheckCheck } from "lucide-react";

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

function isReleased(ep: Episode): boolean {
  return getReleaseCountdown(ep.air_date) === null;
}

const skipPromptKey = (tmdbId: number) => `skip-prev-prompt-${tmdbId}`;

export function EpisodeList({ series }: EpisodeListProps) {
  const [activeSeason, setActiveSeason] = useState(() => {
    const first = series.seasons.find((s) => s.season_number > 0);
    return first?.season_number ?? 1;
  });

  const tmdbId = series.id;
  const queryClient = useQueryClient();

  // Re-render every minute so countdowns tick down and released episodes
  // swap from label to checkbox without a page refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const invalidateWatched = () => {
    queryClient.invalidateQueries({ queryKey: ["watched", tmdbId] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["watched-library"] });
    queryClient.invalidateQueries({ queryKey: ["currently-watching"] });
  };

  const markMutation = useMutation({
    mutationFn: (vars: {
      tmdb_id: number;
      season_number: number;
      episode_number: number;
      episode_name?: string;
      runtime_minutes?: number | null;
    }) => markEpisodeWatched({ data: vars }),
    onSuccess: invalidateWatched,
  });

  const bulkMutation = useMutation({
    mutationFn: (vars: {
      tmdb_id: number;
      episodes: {
        season_number: number;
        episode_number: number;
        episode_name?: string;
        runtime_minutes?: number | null;
      }[];
    }) => markEpisodesBulk({ data: vars }),
    onSuccess: invalidateWatched,
  });

  const unmarkMutation = useMutation({
    mutationFn: (vars: {
      tmdb_id: number;
      season_number: number;
      episode_number: number;
    }) => unmarkEpisodeWatched({ data: vars }),
    onSuccess: invalidateWatched,
  });

  const watchedSet = useMemo(
    () => new Set(watched.map((w) => `${w.season_number}-${w.episode_number}`)),
    [watched]
  );

  const isWatched = (ep: Episode) =>
    watchedSet.has(`${ep.season_number}-${ep.episode_number}`);

  // Bulk-mark prompt state
  const [pendingPrompt, setPendingPrompt] = useState<{
    trigger: Episode;
    previous: Episode[];
  } | null>(null);

  const toEpisodePayload = (ep: Episode) => ({
    season_number: ep.season_number,
    episode_number: ep.episode_number,
    episode_name: ep.name,
    runtime_minutes: ep.runtime ?? runtimeFallback,
  });

  const toggleEpisode = (ep: Episode) => {
    if (isWatched(ep)) {
      unmarkMutation.mutate({
        tmdb_id: tmdbId,
        season_number: ep.season_number,
        episode_number: ep.episode_number,
      });
      return;
    }

    // Find previous released & unwatched episodes in this season, up to this ep
    const episodes = seasonDetails?.episodes ?? [];
    const previous = episodes.filter(
      (e) =>
        e.episode_number < ep.episode_number &&
        isReleased(e) &&
        !isWatched(e)
    );

    const skip =
      typeof window !== "undefined" &&
      window.localStorage.getItem(skipPromptKey(tmdbId)) === "1";

    if (previous.length > 0 && !skip) {
      setPendingPrompt({ trigger: ep, previous });
      return;
    }

    markMutation.mutate({ tmdb_id: tmdbId, ...toEpisodePayload(ep) });
  };

  const confirmMarkPrevious = () => {
    if (!pendingPrompt) return;
    bulkMutation.mutate({
      tmdb_id: tmdbId,
      episodes: [
        ...pendingPrompt.previous.map(toEpisodePayload),
        toEpisodePayload(pendingPrompt.trigger),
      ],
    });
    setPendingPrompt(null);
  };

  const markOnlyThis = () => {
    if (!pendingPrompt) return;
    markMutation.mutate({
      tmdb_id: tmdbId,
      ...toEpisodePayload(pendingPrompt.trigger),
    });
    setPendingPrompt(null);
  };

  const neverAskAgain = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(skipPromptKey(tmdbId), "1");
    }
    markOnlyThis();
  };

  const markWholeSeason = () => {
    const episodes = seasonDetails?.episodes ?? [];
    const toMark = episodes.filter((e) => isReleased(e) && !isWatched(e));
    if (!toMark.length) return;
    bulkMutation.mutate({
      tmdb_id: tmdbId,
      episodes: toMark.map(toEpisodePayload),
    });
  };

  const seasons = series.seasons.filter((s) => s.season_number > 0);

  const currentEpisodes = seasonDetails?.episodes ?? [];
  const releasedInSeason = currentEpisodes.filter(isReleased);
  const allSeasonWatched =
    releasedInSeason.length > 0 && releasedInSeason.every(isWatched);

  const tabsListRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScroll = () => {
    const el = tabsListRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };

  useEffect(() => {
    const el = tabsListRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener("scroll", updateScroll);
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScroll);
      ro.disconnect();
    };
  }, [seasons.length]);

  const scrollTabs = (direction: "left" | "right") => {
    const el = tabsListRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className="rounded-xl border border-border bg-surface">
      <Tabs value={String(activeSeason)} onValueChange={(v) => setActiveSeason(Number(v))}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 pt-4">
          <div className="relative flex min-w-0 flex-1 items-center">
            <TabsList
              ref={tabsListRef}
              className="scrollbar-hide flex min-w-0 flex-1 flex-nowrap items-center justify-start overflow-x-auto bg-transparent p-0"
            >
              {seasons.map((seasonInfo) => (
                <TabsTrigger
                  key={seasonInfo.season_number}
                  value={String(seasonInfo.season_number)}
                  className="shrink-0 rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-primary data-[state=active]:text-primary"
                >
                  Season {seasonInfo.season_number}
                </TabsTrigger>
              ))}
            </TabsList>
            {canScroll.left && (
              <button
                type="button"
                onClick={() => scrollTabs("left")}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-1 shadow-md backdrop-blur-sm"
                aria-label="Scroll seasons left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {canScroll.right && (
              <button
                type="button"
                onClick={() => scrollTabs("right")}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-1 shadow-md backdrop-blur-sm"
                aria-label="Scroll seasons right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={markWholeSeason}
            disabled={
              isLoading ||
              allSeasonWatched ||
              bulkMutation.isPending ||
              releasedInSeason.length === 0
            }
            className="mb-2 shrink-0"
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            {allSeasonWatched ? "Season watched" : "Mark season as watched"}
          </Button>
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

      <Dialog
        open={pendingPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPrompt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark previous episodes as watched?</DialogTitle>
            <DialogDescription>
              There {pendingPrompt && pendingPrompt.previous.length === 1 ? "is" : "are"}{" "}
              {pendingPrompt?.previous.length} earlier episode
              {pendingPrompt && pendingPrompt.previous.length === 1 ? "" : "s"} in this
              season that you haven't marked yet. Do you want to mark them as watched too?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-3 gap-2 sm:flex sm:flex-row sm:flex-nowrap">
            <Button
              variant="ghost"
              onClick={neverAskAgain}
              aria-label="Never for this series"
              title="Never for this series"
              className="min-w-0 px-2 text-xs sm:mr-auto sm:px-3 sm:text-sm"
            >
              Never
            </Button>
            <Button
              variant="outline"
              onClick={markOnlyThis}
              aria-label="Only this one"
              title="Only this one"
              className="min-w-0 px-2 text-xs sm:px-3 sm:text-sm"
            >
              Only this
            </Button>
            <Button
              onClick={confirmMarkPrevious}
              aria-label="Yes, mark all previous"
              title="Yes, mark all previous"
              className="min-w-0 px-2 text-xs sm:px-3 sm:text-sm"
            >
              Mark previous
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
