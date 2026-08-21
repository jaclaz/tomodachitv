import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
}

export function RewatchButton({
  media_type,
  tmdb_id,
  title,
  poster_path,
  runtime_minutes,
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
    mutationFn: () =>
      addRewatch({
        data: { media_type, tmdb_id, title, poster_path, runtime_minutes },
      }),
    onSuccess: (res) => {
      invalidate();
      toast.success(
        media_type === "tv"
          ? `Rewatch logged: +${res.episodes} episodes`
          : "Rewatch logged",
      );
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not log the rewatch."),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeLastRewatch({ data: { media_type, tmdb_id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Last rewatch removed");
    },
  });

  const count = rewatches.length;
  const totalMinutes = rewatches.reduce((t, r) => t + (r.minutes ?? 0), 0);

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
            : "Log a full rewatch"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          disabled={addMutation.isPending}
        >
          I watched it again
        </DropdownMenuItem>
        {count > 0 && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              removeMutation.mutate();
            }}
            disabled={removeMutation.isPending}
            className="text-destructive focus:text-destructive"
          >
            Remove last rewatch
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {media_type === "tv"
            ? "Adds every episode you've marked as watched to your totals again."
            : "Adds the movie's runtime to your totals again."}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
