import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyRatings,
  setRating as setRatingFn,
  clearRating as clearRatingFn,
  type RatingMediaKind,
  type UserRating,
} from "@/lib/ratings.functions";
import { PopcornIcon, type PopcornFill } from "@/components/popcorn-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface RatingInputProps {
  media_type: RatingMediaKind;
  tmdb_id: number;
  title?: string | null;
  poster_path?: string | null;
  className?: string;
}

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function fillFor(index: number, value: number): PopcornFill {
  const full = index + 1;
  if (value >= full) return "full";
  if (value >= full - 0.5) return "half";
  return "empty";
}

export function RatingInput({
  media_type,
  tmdb_id,
  title,
  poster_path,
  className,
}: RatingInputProps) {
  const queryClient = useQueryClient();
  const [hover, setHover] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const { data: ratings = [] } = useQuery({
    queryKey: ["my-ratings"],
    queryFn: () => getMyRatings(),
    staleTime: 60_000,
  });

  const current =
    ratings.find((r) => r.media_type === media_type && r.tmdb_id === tmdb_id)?.rating ?? 0;

  const optimistic = (next: number | null) => {
    queryClient.setQueryData<UserRating[]>(["my-ratings"], (prev = []) => {
      const rest = prev.filter(
        (r) => !(r.media_type === media_type && r.tmdb_id === tmdb_id),
      );
      if (next == null) return rest;
      const existing = prev.find(
        (r) => r.media_type === media_type && r.tmdb_id === tmdb_id,
      );
      const now = new Date().toISOString();
      return [
        {
          id: existing?.id ?? `optimistic-${media_type}-${tmdb_id}`,
          user_id: existing?.user_id ?? "me",
          media_type,
          tmdb_id,
          rating: next,
          title: title ?? null,
          poster_path: poster_path ?? null,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        },
        ...rest,
      ];
    });
  };

  const saveMutation = useMutation({
    mutationFn: (value: number) =>
      setRatingFn({
        data: { media_type, tmdb_id, rating: value, title, poster_path },
      }),
    onMutate: (value) => optimistic(value),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["my-ratings"] }),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearRatingFn({ data: { media_type, tmdb_id } }),
    onMutate: () => optimistic(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["my-ratings"] }),
  });

  const apply = (value: number) => {
    if (value === current) clearMutation.mutate();
    else saveMutation.mutate(value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = STEPS.indexOf(current);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      apply(STEPS[Math.min(STEPS.length - 1, idx + 1)] ?? 0.5);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      if (idx <= 0) clearMutation.mutate();
      else apply(STEPS[idx - 1]);
    } else if (e.key === "Home") {
      e.preventDefault();
      apply(0.5);
    } else if (e.key === "End") {
      e.preventDefault();
      apply(5);
    } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "0") {
      e.preventDefault();
      clearMutation.mutate();
    }
  };

  const display = hover ?? current;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        ref={rowRef}
        role="slider"
        tabIndex={0}
        aria-label="Your score"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={current}
        aria-valuetext={
          current > 0 ? `${current} out of 5 popcorn` : "Not rated"
        }
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
        className="flex items-center gap-0.5 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="relative inline-flex">
            <PopcornIcon
              fill={fillFor(i, display)}
              className={cn(
                "h-6 w-6 transition-colors",
                display >= i + 0.5 ? "text-score" : "text-muted-foreground",
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Rate ${i + 0.5} out of 5`}
              onMouseEnter={() => setHover(i + 0.5)}
              onClick={() => apply(i + 0.5)}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Rate ${i + 1} out of 5`}
              onMouseEnter={() => setHover(i + 1)}
              onClick={() => apply(i + 1)}
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
            />
          </span>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {current > 0 ? current.toFixed(1) : "Rate it"}
      </span>
      {current > 0 && (
        <button
          type="button"
          onClick={() => clearMutation.mutate()}
          className="rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear
        </button>
      )}
    </div>
  );
}

interface ScoreBadgeProps {
  value: number | null | undefined;
  className?: string;
}

/** Read-only compact display of a personal popcorn score. */
export function ScoreBadge({ value, className }: ScoreBadgeProps) {
  if (!value) return null;
  return (
    <span className={cn("flex items-center gap-1 text-score", className)}>
      <PopcornIcon fill="full" className="h-3.5 w-3.5" />
      {value.toFixed(1)}
    </span>
  );
}

interface RatingButtonProps {
  media_type: RatingMediaKind;
  tmdb_id: number;
  title?: string | null;
  poster_path?: string | null;
}

/** Dropdown button matching the other detail-page actions. */
export function RatingButton({
  media_type,
  tmdb_id,
  title,
  poster_path,
}: RatingButtonProps) {
  const queryClient = useQueryClient();
  const { data: ratings = [] } = useQuery({
    queryKey: ["my-ratings"],
    queryFn: () => getMyRatings(),
    staleTime: 60_000,
  });

  const current =
    ratings.find((r) => r.media_type === media_type && r.tmdb_id === tmdb_id)
      ?.rating ?? 0;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["my-ratings"] });

  const saveMutation = useMutation({
    mutationFn: (value: number) =>
      setRatingFn({
        data: { media_type, tmdb_id, rating: value, title, poster_path },
      }),
    onSettled: invalidate,
  });

  const clearMutation = useMutation({
    mutationFn: () => clearRatingFn({ data: { media_type, tmdb_id } }),
    onSettled: invalidate,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={current > 0 ? "secondary" : "outline"} className="gap-2">
          <span aria-hidden="true">🍿</span>
          {current > 0 ? current.toFixed(1) : "Rate"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel>Your score</DropdownMenuLabel>
        {[...STEPS].reverse().map((v) => (
          <DropdownMenuItem
            key={v}
            onSelect={() => saveMutation.mutate(v)}
            className="justify-between"
          >
            <span>🍿 {v.toFixed(1)}</span>
            {current === v && <span className="text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
        {current > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => clearMutation.mutate()}>
              Remove score
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
