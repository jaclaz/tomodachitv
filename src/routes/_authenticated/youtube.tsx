import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Youtube, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { YouTubeCard } from "@/components/youtube-card";
import {
  getYtWatchlist,
  getYtWatched,
  removeFromYtWatchlist,
  removeYtWatched,
  searchYouTube,
  type YtItem,
} from "@/lib/youtube.functions";

export const Route = createFileRoute("/_authenticated/youtube")({
  head: () => ({
    meta: [
      { title: "YouTube · TomodachiTV" },
      {
        name: "description",
        content: "Track YouTube channels, playlists and videos alongside your movies and shows.",
      },
    ],
  }),
  component: YouTubePage,
});

function YouTubePage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tab, setTab] = useState<"discover" | "watchlist" | "watched">("discover");

  const searchQuery = useQuery({
    queryKey: ["yt-search", submitted],
    queryFn: () => searchYouTube({ data: { query: submitted } }),
    enabled: submitted.length > 0,
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["yt-watchlist"],
    queryFn: () => getYtWatchlist(),
  });
  const { data: watched = [] } = useQuery({
    queryKey: ["yt-watched"],
    queryFn: () => getYtWatched(),
  });

  const removeWlMut = useMutation({
    mutationFn: (v: { yt_id: string; kind: "channel" | "playlist" | "video" }) =>
      removeFromYtWatchlist({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["yt-watchlist"] }),
  });
  const removeWatchedMut = useMutation({
    mutationFn: (v: { yt_id: string; kind: "channel" | "playlist" | "video" }) =>
      removeYtWatched({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["yt-watched"] }),
  });

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <div className="flex items-center gap-3">
          <Youtube className="h-7 w-7 text-red-500" />
          <h1 className="font-display text-2xl font-bold text-foreground">YouTube</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow channels and playlists — think of a channel as a show and a playlist as a season. Paste any YouTube URL or search by keyword.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
          setTab("discover");
        }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or paste a YouTube URL"
          className="flex-1"
        />
        <Button type="submit" disabled={!query.trim()}>
          <Search className="mr-2 h-4 w-4" /> Search
        </Button>
      </form>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="watchlist">
            Watchlist
            {watchlist.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {watchlist.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="watched">
            Watched
            {watched.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {watched.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="mt-6">
          {!submitted && (
            <EmptyState
              title="Find something to track"
              description="Try searching for a channel, podcast, or paste a full YouTube URL (channel, playlist, or video)."
            />
          )}
          {submitted && searchQuery.isLoading && <GridSkeleton />}
          {submitted && searchQuery.isError && (
            <p className="text-sm text-destructive">
              {(searchQuery.error as Error).message}
            </p>
          )}
          {submitted &&
            !searchQuery.isLoading &&
            (searchQuery.data?.length ?? 0) === 0 && (
              <EmptyState title="No results" description="Try a different query." />
            )}
          {submitted && (searchQuery.data?.length ?? 0) > 0 && (
            <ResultsGrid items={searchQuery.data!} />
          )}
        </TabsContent>

        <TabsContent value="watchlist" className="mt-6">
          {watchlist.length === 0 ? (
            <EmptyState
              title="Watchlist empty"
              description="Add channels, playlists and videos you want to watch later."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {watchlist.map((w) => (
                <TrackedRow
                  key={`${w.kind}-${w.yt_id}`}
                  item={w}
                  onRemove={() =>
                    removeWlMut.mutate({ yt_id: w.yt_id, kind: w.kind })
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="watched" className="mt-6">
          {watched.length === 0 ? (
            <EmptyState title="Nothing watched yet" description="Mark items as watched to see them here." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {watched.map((w) => (
                <TrackedRow
                  key={`${w.kind}-${w.yt_id}`}
                  item={w}
                  onRemove={() =>
                    removeWatchedMut.mutate({ yt_id: w.yt_id, kind: w.kind })
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultsGrid({ items }: { items: YtItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((it) => (
        <YouTubeCard
          key={`${it.kind}-${it.id}`}
          yt_id={it.id}
          kind={it.kind}
          title={it.title}
          thumbnail_url={it.thumbnail_url}
          channel_title={it.channel_title}
          channel_id={it.channel_id}
        />
      ))}
    </div>
  );
}

function TrackedRow({
  item,
  onRemove,
}: {
  item: {
    yt_id: string;
    kind: "channel" | "playlist" | "video";
    title: string;
    thumbnail_url: string | null;
    channel_title: string | null;
    channel_id: string | null;
  };
  onRemove: () => void;
}) {
  const to =
    item.kind === "channel"
      ? `/youtube/channel/${item.yt_id}`
      : item.kind === "playlist"
        ? `/youtube/playlist/${item.yt_id}`
        : `/youtube/video/${item.yt_id}`;

  return (
    <div className="group flex gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-primary/50">
      <Link to={to} className="shrink-0">
        <div
          className={`overflow-hidden bg-muted ${
            item.kind === "channel" ? "h-16 w-16 rounded-full" : "h-16 w-28 rounded-md"
          }`}
        >
          {item.thumbnail_url && (
            <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-600 text-white hover:bg-red-600">YT · {item.kind}</Badge>
        </div>
        <Link to={to} className="mt-1 line-clamp-2 block text-sm font-medium hover:text-primary">
          {item.title}
        </Link>
        {item.channel_title && (
          <p className="truncate text-xs text-muted-foreground">{item.channel_title}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="opacity-0 transition group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
