import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YouTubeActions } from "@/components/youtube-actions";
import {
  formatCount,
  formatDuration,
  getYouTubeVideo,
} from "@/lib/youtube.functions";

export const Route = createFileRoute("/_authenticated/youtube/video/$id")({
  loader: async ({ params }) => {
    const video = await getYouTubeVideo({ data: { id: params.id } });
    if (!video) throw new Error("Video not found");
    return { video };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.video.title} · YouTube · TomodachiTV` },
          {
            name: "description",
            content: loaderData.video.description.slice(0, 160),
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
  notFoundComponent: () => <p className="p-8 text-center text-muted-foreground">Video not found.</p>,
  component: VideoPage,
});

function VideoPage() {
  const { video } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-border">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-red-600 text-white hover:bg-red-600">YouTube video</Badge>
          {video.duration && (
            <span className="text-xs text-muted-foreground">{formatDuration(video.duration)}</span>
          )}
          {video.view_count != null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              {formatCount(video.view_count)} views
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold">{video.title}</h1>
        {video.channel_title && video.channel_id && (
          <Link
            to="/youtube/channel/$id"
            params={{ id: video.channel_id }}
            className="inline-block text-sm text-muted-foreground hover:text-primary"
          >
            {video.channel_title}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <YouTubeActions
            yt_id={video.id}
            kind="video"
            title={video.title}
            thumbnail_url={video.thumbnail_url}
            channel_id={video.channel_id}
            channel_title={video.channel_title}
          />
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open on YouTube
            </a>
          </Button>
        </div>
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {video.description}
        </p>
      </div>
    </div>
  );
}
