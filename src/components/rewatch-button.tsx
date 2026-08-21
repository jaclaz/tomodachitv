import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import {
  addRewatch,
  getRewatches,
  removeLastRewatch,
} from "@/lib/rewatch.functions";

interface RewatchButtonProps {
  media_type: "tv" | "movie";
  tmdb_id: number;
  title?: string | null;
  poster_path?: string | null;
  runtime_minutes?: number | null;
  /** Series seasons, used to log a rewatch of a single season. */
  seasons?: { season_number: number; name?: string | null }[];
}

export function RewatchButton({
  media_type,
  tmdb_id,
  title,
  poster_path,
  runtime_minutes,
  seasons,
}: RewatchButtonProps) {
  const queryClient = useQueryClient();
  const queryKey = ["rewatches", media_type, tmdb_id];

  const { data: rewatches = [] } = useQuery({
    queryKey,
    queryFn: () => getRewatches({ data: { media_type, tmdb_id } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["advanced-stats"] });
  };

  const addMutation = useMutation({
    mutationFn: (season: number | null) =>
      addRewatch({
        data: {
          media_type,
          tmdb_id,
          season_number: season,
          title,
          poster_path,
          runtime_minutes,
        },
      }),
    onSuccess: (res, season) => {
      invalidate();
      toast.success(
        media_type === "tv"
          ? season == null
            ? `Rewatch logged: +${res.episodes} episodes`
            : `Season ${season} rewatch logged: +${res.episodes} episodes`
          : "Rewatch logged",
      );
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not log the rewatch."),
  });

  const removeMutation = useMutation({
    mutationFn: (season: number | null) =>
      removeLastRewatch({ data: { media_type, tmdb_id, season_number: season } }),
    onSuccess: () => {
      invalidate();
      toast.success("Last rewatch removed");
    },
  });

  const count = rewatches.length;
  const fullCount = rewatches.filter((r) => r.season_number == null).length;
  const totalMinutes = rewatches.reduce((t, r) => t + (r.minutes ?? 0), 0);
  const seasonCount = (season: number) =>
    rewatches.filter((r) => r.season_number === season).length;

  const tvSeasons = (seasons ?? []).filter((s) => s.season_number > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={count > 0 ? "secondary" : "outline"} className="gap-2">
          <Repeat className="h-4 w-4" />
          {count > 0 ? `Rewatched ×${count}` : "Rewatch"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          {count > 0
            ? `${count} rewatch${count === 1 ? "" : "es"} · ${Math.round(totalMinutes / 60)}h counted`
            : "Log a rewatch"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            addMutation.mutate(null);
          }}
          disabled={addMutation.isPending}
        >
          {media_type === "tv"
            ? `I watched the whole show again${fullCount > 0 ? ` (×${fullCount})` : ""}`
            : "I watched it again"}
        </DropdownMenuItem>

        {media_type === "tv" && tvSeasons.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              I rewatched one season
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {tvSeasons.map((s) => {
                const n = seasonCount(s.season_number);
                return (
                  <DropdownMenuItem
                    key={s.season_number}
                    onSelect={(e) => {
                      e.preventDefault();
                      addMutation.mutate(s.season_number);
                    }}
                    disabled={addMutation.isPending}
                  >
                    Season {s.season_number}
                    {n > 0 ? ` · ×${n}` : ""}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            {fullCount > 0 && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  removeMutation.mutate(null);
                }}
                disabled={removeMutation.isPending}
                className="text-destructive focus:text-destructive"
              >
                {media_type === "tv"
                  ? "Remove last full rewatch"
                  : "Remove last rewatch"}
              </DropdownMenuItem>
            )}
            {media_type === "tv" &&
              tvSeasons
                .filter((s) => seasonCount(s.season_number) > 0)
                .map((s) => (
                  <DropdownMenuItem
                    key={`rm-${s.season_number}`}
                    onSelect={(e) => {
                      e.preventDefault();
                      removeMutation.mutate(s.season_number);
                    }}
                    disabled={removeMutation.isPending}
                    className="text-destructive focus:text-destructive"
                  >
                    Remove last season {s.season_number} rewatch
                  </DropdownMenuItem>
                ))}
          </>
        )}

        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {media_type === "tv"
            ? "Counts again the episodes you've marked as watched, for the whole show or just one season."
            : "Adds the movie's runtime to your totals again."}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
