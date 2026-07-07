import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YouTubeActions } from "@/components/youtube-actions";
import {
  getPlaylistItems,
  getYouTubePlaylist,
} from "@/lib/youtube.functions";

export const Route = createFileRoute("/_authenticated/youtube/playlist/$id")({
  loader: async ({ params }) => {
    const playlist = await getYouTubePlaylist({ data: { id: params.id } });
    if (!playlist) throw new Error("Playlist not found");
    return { playlist };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.playlist.title} · YouTube · TomodachiTV` },
          {
            name: "description",
            content: loaderData.playlist.description.slice(0, 160),
          },
        ]
      : [],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button
          className="mt-4"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
      </div>
    );
  },
  notFoundComponent: () => <p className="p-8 text-center text-muted-foreground">Playlist not found.</p>,
  component: PlaylistPage,
});

function PlaylistPage() {
  const { playlist } = Route.useLoaderData();

  const { data: items } = useQuery({
    queryKey: ["yt-playlist-items", playlist.id],
    queryFn: () => getPlaylistItems({ data: { playlistId: playlist.id } }),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="aspect-video w-full max-w-sm shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border">
          {playlist.thumbnail_url && (
            <img src={playlist.thumbnail_url} alt={playlist.title} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-red-600 text-white hover:bg-red-600">YouTube playlist</Badge>
            {playlist.item_count != null && (
              <span className="text-xs text-muted-foreground">{playlist.item_count} videos</span>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold">{playlist.title}</h1>
          {playlist.channel_title && playlist.channel_id && (
            <Link
              to="/youtube/channel/$id"
              params={{ id: playlist.channel_id }}
              className="mt-1 inline-block text-sm text-muted-foreground hover:text-primary"
            >
              by {playlist.channel_title}
            </Link>
          )}
          <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">
            {playlist.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <YouTubeActions
              yt_id={playlist.id}
              kind="playlist"
              title={playlist.title}
              thumbnail_url={playlist.thumbnail_url}
              channel_id={playlist.channel_id}
              channel_title={playlist.channel_title}
            />
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.youtube.com/playlist?list=${playlist.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open on YouTube
              </a>
            </Button>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Videos</h2>
        {!items ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : items.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Playlist is empty.</p>
        ) : (
          <ol className="space-y-3">
            {items.items.map((v, idx) => (
              <li
                key={`${v.videoId}-${idx}`}
                className="flex gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-primary/50"
              >
                <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                  {v.position + 1}
                </span>
                <Link
                  to="/youtube/video/$id"
                  params={{ id: v.videoId }}
                  className="shrink-0"
                >
                  <div className="h-16 w-28 overflow-hidden rounded-md bg-muted">
                    {v.thumbnail_url && (
                      <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/youtube/video/$id"
                    params={{ id: v.videoId }}
                    className="line-clamp-2 text-sm font-medium hover:text-primary"
                  >
                    {v.title}
                  </Link>
                  {v.channel_title && (
                    <p className="truncate text-xs text-muted-foreground">
                      {v.channel_title}
                    </p>
                  )}
                </div>
                <YouTubeActions
                  yt_id={v.videoId}
                  kind="video"
                  title={v.title}
                  thumbnail_url={v.thumbnail_url}
                  channel_id={v.channel_id}
                  channel_title={v.channel_title}
                  size="sm"
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
