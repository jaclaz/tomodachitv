import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, BookmarkCheck, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  addToYtWatchlist,
  getYtWatched,
  getYtWatchlist,
  markYtWatched,
  removeFromYtWatchlist,
  removeYtWatched,
  type YtKind,
} from "@/lib/youtube.functions";

interface Props {
  yt_id: string;
  kind: YtKind;
  title: string;
  thumbnail_url?: string | null;
  channel_title?: string | null;
  channel_id?: string | null;
  size?: "sm" | "default";
  className?: string;
}

export function YouTubeActions(props: Props) {
  const { size = "default", className } = props;
  const qc = useQueryClient();

  const { data: watchlist = [] } = useQuery({
    queryKey: ["yt-watchlist"],
    queryFn: () => getYtWatchlist(),
  });
  const { data: watched = [] } = useQuery({
    queryKey: ["yt-watched"],
    queryFn: () => getYtWatched(),
  });

  const inWatchlist = watchlist.some(
    (w) => w.kind === props.kind && w.yt_id === props.yt_id,
  );
  const isWatched = watched.some(
    (w) => w.kind === props.kind && w.yt_id === props.yt_id,
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["yt-watchlist"] });
    qc.invalidateQueries({ queryKey: ["yt-watched"] });
  };

  const wlMut = useMutation({
    mutationFn: async () => {
      if (inWatchlist) {
        await removeFromYtWatchlist({
          data: { yt_id: props.yt_id, kind: props.kind },
        });
      } else {
        await addToYtWatchlist({
          data: {
            yt_id: props.yt_id,
            kind: props.kind,
            title: props.title,
            thumbnail_url: props.thumbnail_url ?? null,
            channel_title: props.channel_title ?? null,
            channel_id: props.channel_id ?? null,
          },
        });
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const watchedMut = useMutation({
    mutationFn: async () => {
      if (isWatched) {
        await removeYtWatched({ data: { yt_id: props.yt_id, kind: props.kind } });
      } else {
        await markYtWatched({
          data: {
            yt_id: props.yt_id,
            kind: props.kind,
            title: props.title,
            thumbnail_url: props.thumbnail_url ?? null,
            channel_title: props.channel_title ?? null,
            channel_id: props.channel_id ?? null,
          },
        });
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success(isWatched ? "Marked as unwatched" : "Marked as watched");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Button
        variant="ghost"
        size="icon"
        className={btnSize}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          wlMut.mutate();
        }}
        disabled={wlMut.isPending}
        title={inWatchlist ? "In watchlist" : "Add to watchlist"}
      >
        {inWatchlist ? (
          <BookmarkCheck className={`${iconSize} text-primary`} />
        ) : (
          <BookmarkPlus className={iconSize} />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={btnSize}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          watchedMut.mutate();
        }}
        disabled={watchedMut.isPending}
        title={isWatched ? "Watched" : "Mark watched"}
      >
        {isWatched ? (
          <Check className={`${iconSize} text-green-500`} />
        ) : (
          <Eye className={iconSize} />
        )}
      </Button>
    </div>
  );
}
