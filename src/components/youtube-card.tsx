import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { YouTubeActions } from "@/components/youtube-actions";
import type { YtKind } from "@/lib/youtube.functions";

interface Props {
  yt_id: string;
  kind: YtKind;
  title: string;
  thumbnail_url: string | null;
  channel_title?: string | null;
  channel_id?: string | null;
  subtitle?: string | null;
  showActions?: boolean;
}

export function YouTubeCard(props: Props) {
  const { yt_id, kind, title, thumbnail_url, channel_title, subtitle, showActions = true } = props;

  const to =
    kind === "channel"
      ? `/youtube/channel/${yt_id}`
      : kind === "playlist"
        ? `/youtube/playlist/${yt_id}`
        : `/youtube/video/${yt_id}`;

  const aspect = kind === "channel" ? "aspect-square" : "aspect-video";
  const rounded = kind === "channel" ? "rounded-full" : "rounded-lg";

  return (
    <div className="group relative flex flex-col gap-2">
      <Link to={to} className="block">
        <div
          className={`${aspect} ${rounded} overflow-hidden bg-muted ring-1 ring-border transition group-hover:ring-primary/50`}
        >
          {thumbnail_url ? (
            <img
              src={thumbnail_url}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
        </div>
      </Link>
      <div className="absolute left-2 top-2">
        <Badge variant="secondary" className="bg-red-600 text-white hover:bg-red-600">
          YT · {kind}
        </Badge>
      </div>
      {showActions && (
        <div className="absolute right-1 top-1 rounded-md bg-background/80 opacity-0 backdrop-blur transition group-hover:opacity-100">
          <YouTubeActions
            yt_id={yt_id}
            kind={kind}
            title={title}
            thumbnail_url={thumbnail_url}
            channel_title={channel_title ?? null}
            channel_id={props.channel_id ?? null}
            size="sm"
          />
        </div>
      )}
      <div className="min-w-0">
        <Link to={to} className="line-clamp-2 text-sm font-medium hover:text-primary">
          {title}
        </Link>
        {(subtitle || channel_title) && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle ?? channel_title}
          </p>
        )}
      </div>
    </div>
  );
}
