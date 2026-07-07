import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YouTubeActions } from "@/components/youtube-actions";
import {
  formatCount,
  getChannelPlaylists,
  getYouTubeChannel,
} from "@/lib/youtube.functions";

export const Route = createFileRoute("/_authenticated/youtube/channel/$id")({
  loader: async ({ params }) => {
    const channel = await getYouTubeChannel({ data: { id: params.id } });
    if (!channel) throw new Error("Channel not found");
    return { channel };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.channel.title} · YouTube · TomodachiTV` },
          {
            name: "description",
            content: loaderData.channel.description.slice(0, 160),
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
  notFoundComponent: () => <p className="p-8 text-center text-muted-foreground">Channel not found.</p>,
  component: ChannelPage,
});

function ChannelPage() {
  const { channel } = Route.useLoaderData();

  const { data: playlists } = useQuery({
    queryKey: ["yt-channel-playlists", channel.id],
    queryFn: () => getChannelPlaylists({ data: { channelId: channel.id } }),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border">
          {channel.thumbnail_url && (
            <img src={channel.thumbnail_url} alt={channel.title} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-red-600 text-white hover:bg-red-600">YouTube channel</Badge>
            {channel.subscriber_count != null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {formatCount(channel.subscriber_count)} subscribers
              </span>
            )}
            {channel.video_count != null && (
              <span className="text-xs text-muted-foreground">
                {formatCount(channel.video_count)} videos
              </span>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold">{channel.title}</h1>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {channel.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <YouTubeActions
              yt_id={channel.id}
              kind="channel"
              title={channel.title}
              thumbnail_url={channel.thumbnail_url}
              channel_id={channel.id}
              channel_title={channel.title}
            />
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.youtube.com/channel/${channel.id}`}
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
        <h2 className="mb-4 font-display text-xl font-semibold">Playlists</h2>
        {!playlists ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : playlists.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">This channel has no public playlists.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {playlists.items.map((p) => (
              <Link
                key={p.id}
                to="/youtube/playlist/$id"
                params={{ id: p.id }}
                className="group block"
              >
                <div className="aspect-video overflow-hidden rounded-lg bg-muted ring-1 ring-border group-hover:ring-primary/50">
                  {p.thumbnail_url && (
                    <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-primary">
                  {p.title}
                </p>
                {p.item_count != null && (
                  <p className="text-xs text-muted-foreground">{p.item_count} videos</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
