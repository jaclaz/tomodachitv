import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

export type YtKind = "channel" | "playlist" | "video";

export interface YtItem {
  id: string;
  kind: YtKind;
  title: string;
  description: string;
  thumbnail_url: string | null;
  channel_id: string | null;
  channel_title: string | null;
  published_at: string | null;
  // kind-specific extras
  subscriber_count?: number | null;
  video_count?: number | null;
  item_count?: number | null; // playlist
  duration?: string | null; // ISO 8601 for videos
  view_count?: number | null;
}

export interface YtTrackItem {
  id: string;
  user_id: string;
  yt_id: string;
  kind: YtKind;
  title: string;
  thumbnail_url: string | null;
  channel_title: string | null;
  channel_id: string | null;
  added_at?: string;
  watched_at?: string;
}

function ytKey() {
  const k = process.env.GOOGLE_API_KEY;
  if (!k) throw new Error("YouTube API key not configured");
  return k;
}

function bestThumb(thumbs: Record<string, { url: string }> | undefined) {
  if (!thumbs) return null;
  return (
    thumbs.maxres?.url ??
    thumbs.standard?.url ??
    thumbs.high?.url ??
    thumbs.medium?.url ??
    thumbs.default?.url ??
    null
  );
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YT_BASE}/${path}`);
  url.searchParams.set("key", ytKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// -------- Parse YouTube URLs --------

export interface ParsedYtUrl {
  kind: YtKind;
  id: string;
  // For channel URLs of the form /@handle we return handle instead of id.
  handle?: string;
}

export function parseYouTubeUrl(input: string): ParsedYtUrl | null {
  const s = input.trim();
  if (!s) return null;
  // Bare 11-char video id
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return { kind: "video", id: s };
  // Bare channel id (UC...)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(s)) return { kind: "channel", id: s };
  // Bare playlist id (PL, UU, LL, FL, RD...)
  if (/^(PL|UU|LL|FL|RD|OL)[a-zA-Z0-9_-]{10,}$/.test(s))
    return { kind: "playlist", id: s };

  let url: URL;
  try {
    url = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id) return { kind: "video", id };
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const list = url.searchParams.get("list");
    if (list) return { kind: "playlist", id: list };
    const v = url.searchParams.get("v");
    if (v) return { kind: "video", id: v };
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1]) return { kind: "video", id: parts[1] };
    if (parts[0] === "embed" && parts[1]) return { kind: "video", id: parts[1] };
    if (parts[0] === "channel" && parts[1]) return { kind: "channel", id: parts[1] };
    if (parts[0] === "playlist" && url.searchParams.get("list"))
      return { kind: "playlist", id: url.searchParams.get("list")! };
    if (parts[0]?.startsWith("@")) return { kind: "channel", id: "", handle: parts[0].slice(1) };
    if (parts[0] === "c" && parts[1]) return { kind: "channel", id: "", handle: parts[1] };
    if (parts[0] === "user" && parts[1]) return { kind: "channel", id: "", handle: parts[1] };
  }
  return null;
}

// -------- Fetch details --------

async function fetchChannel(idOrHandle: string, byHandle = false): Promise<YtItem | null> {
  const params: Record<string, string> = {
    part: "snippet,statistics",
  };
  if (byHandle) params.forHandle = idOrHandle;
  else params.id = idOrHandle;
  type Resp = {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails?: Record<string, { url: string }>;
        customUrl?: string;
      };
      statistics: { subscriberCount?: string; videoCount?: string };
    }>;
  };
  const data = await ytFetch<Resp>("channels", params);
  const c = data.items?.[0];
  if (!c) return null;
  return {
    id: c.id,
    kind: "channel",
    title: c.snippet.title,
    description: c.snippet.description,
    thumbnail_url: bestThumb(c.snippet.thumbnails),
    channel_id: c.id,
    channel_title: c.snippet.title,
    published_at: c.snippet.publishedAt,
    subscriber_count: c.statistics?.subscriberCount
      ? Number(c.statistics.subscriberCount)
      : null,
    video_count: c.statistics?.videoCount ? Number(c.statistics.videoCount) : null,
  };
}

async function fetchPlaylist(id: string): Promise<YtItem | null> {
  type Resp = {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails?: Record<string, { url: string }>;
        channelId: string;
        channelTitle: string;
      };
      contentDetails: { itemCount: number };
    }>;
  };
  const data = await ytFetch<Resp>("playlists", {
    part: "snippet,contentDetails",
    id,
  });
  const p = data.items?.[0];
  if (!p) return null;
  return {
    id: p.id,
    kind: "playlist",
    title: p.snippet.title,
    description: p.snippet.description,
    thumbnail_url: bestThumb(p.snippet.thumbnails),
    channel_id: p.snippet.channelId,
    channel_title: p.snippet.channelTitle,
    published_at: p.snippet.publishedAt,
    item_count: p.contentDetails?.itemCount ?? null,
  };
}

async function fetchVideo(id: string): Promise<YtItem | null> {
  type Resp = {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails?: Record<string, { url: string }>;
        channelId: string;
        channelTitle: string;
      };
      contentDetails: { duration: string };
      statistics: { viewCount?: string };
    }>;
  };
  const data = await ytFetch<Resp>("videos", {
    part: "snippet,contentDetails,statistics",
    id,
  });
  const v = data.items?.[0];
  if (!v) return null;
  return {
    id: v.id,
    kind: "video",
    title: v.snippet.title,
    description: v.snippet.description,
    thumbnail_url: bestThumb(v.snippet.thumbnails),
    channel_id: v.snippet.channelId,
    channel_title: v.snippet.channelTitle,
    published_at: v.snippet.publishedAt,
    duration: v.contentDetails?.duration ?? null,
    view_count: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
  };
}

// -------- Public server functions --------

export const searchYouTube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { query: string; type?: "video" | "channel" | "playlist" | "all" }) => input,
  )
  .handler(async ({ data }): Promise<YtItem[]> => {
    const q = data.query.trim();
    if (!q) return [];

    // If it's a URL / bare id, resolve it to a single item.
    const parsed = parseYouTubeUrl(q);
    if (parsed) {
      let item: YtItem | null = null;
      if (parsed.kind === "channel") {
        item = parsed.handle
          ? await fetchChannel(parsed.handle, true)
          : await fetchChannel(parsed.id);
      } else if (parsed.kind === "playlist") item = await fetchPlaylist(parsed.id);
      else item = await fetchVideo(parsed.id);
      return item ? [item] : [];
    }

    const type = data.type && data.type !== "all" ? data.type : "video,channel,playlist";
    type SearchResp = {
      items?: Array<{
        id: { kind: string; videoId?: string; channelId?: string; playlistId?: string };
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails?: Record<string, { url: string }>;
          channelId?: string;
          channelTitle?: string;
        };
      }>;
    };
    const res = await ytFetch<SearchResp>("search", {
      part: "snippet",
      q,
      type,
      maxResults: "20",
      safeSearch: "none",
    });
    return (res.items ?? [])
      .map((it): YtItem | null => {
        const kind = it.id.kind.replace("youtube#", "") as YtKind;
        const id = it.id.videoId ?? it.id.channelId ?? it.id.playlistId;
        if (!id) return null;
        return {
          id,
          kind,
          title: it.snippet.title,
          description: it.snippet.description,
          thumbnail_url: bestThumb(it.snippet.thumbnails),
          channel_id: it.snippet.channelId ?? null,
          channel_title: it.snippet.channelTitle ?? null,
          published_at: it.snippet.publishedAt,
        };
      })
      .filter((x): x is YtItem => x !== null);
  });

export const getYouTubeChannel = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(({ data }) => fetchChannel(data.id));

export const getYouTubePlaylist = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(({ data }) => fetchPlaylist(data.id));

export const getYouTubeVideo = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(({ data }) => fetchVideo(data.id));

export const getPlaylistItems = createServerFn({ method: "GET" })
  .validator((input: { playlistId: string; pageToken?: string }) => input)
  .handler(async ({ data }) => {
    type Resp = {
      nextPageToken?: string;
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails?: Record<string, { url: string }>;
          resourceId: { kind: string; videoId?: string };
          videoOwnerChannelId?: string;
          videoOwnerChannelTitle?: string;
          position: number;
        };
      }>;
    };
    const res = await ytFetch<Resp>("playlistItems", {
      part: "snippet",
      playlistId: data.playlistId,
      maxResults: "50",
      ...(data.pageToken ? { pageToken: data.pageToken } : {}),
    });
    return {
      nextPageToken: res.nextPageToken ?? null,
      items: (res.items ?? [])
        .filter((it) => it.snippet.resourceId?.videoId)
        .map((it) => ({
          videoId: it.snippet.resourceId.videoId!,
          title: it.snippet.title,
          description: it.snippet.description,
          published_at: it.snippet.publishedAt,
          thumbnail_url: bestThumb(it.snippet.thumbnails),
          channel_id: it.snippet.videoOwnerChannelId ?? null,
          channel_title: it.snippet.videoOwnerChannelTitle ?? null,
          position: it.snippet.position,
        })),
    };
  });

export const getChannelPlaylists = createServerFn({ method: "GET" })
  .validator((input: { channelId: string; pageToken?: string }) => input)
  .handler(async ({ data }) => {
    type Resp = {
      nextPageToken?: string;
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails?: Record<string, { url: string }>;
          channelId: string;
          channelTitle: string;
        };
        contentDetails: { itemCount: number };
      }>;
    };
    const res = await ytFetch<Resp>("playlists", {
      part: "snippet,contentDetails",
      channelId: data.channelId,
      maxResults: "50",
      ...(data.pageToken ? { pageToken: data.pageToken } : {}),
    });
    return {
      nextPageToken: res.nextPageToken ?? null,
      items: (res.items ?? []).map((p) => ({
        id: p.id,
        title: p.snippet.title,
        thumbnail_url: bestThumb(p.snippet.thumbnails),
        channel_id: p.snippet.channelId,
        channel_title: p.snippet.channelTitle,
        item_count: p.contentDetails?.itemCount ?? null,
        published_at: p.snippet.publishedAt,
      })),
    };
  });

// -------- Watchlist / Watched --------

export const getYtWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<YtTrackItem[]> => {
    const { data, error } = await context.supabase
      .from("youtube_watchlist")
      .select("*")
      .eq("user_id", context.userId)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as YtTrackItem[];
  });

export const getYtWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<YtTrackItem[]> => {
    const { data, error } = await context.supabase
      .from("youtube_watched")
      .select("*")
      .eq("user_id", context.userId)
      .order("watched_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as YtTrackItem[];
  });

interface UpsertPayload {
  yt_id: string;
  kind: YtKind;
  title: string;
  thumbnail_url?: string | null;
  channel_title?: string | null;
  channel_id?: string | null;
}

export const addToYtWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: UpsertPayload) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("youtube_watchlist").upsert(
      { user_id: context.userId, ...data },
      { onConflict: "user_id, kind, yt_id" },
    );
    if (error) throw error;
    return { success: true };
  });

export const removeFromYtWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { yt_id: string; kind: YtKind }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("youtube_watchlist")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("yt_id", data.yt_id);
    if (error) throw error;
    return { success: true };
  });

export const markYtWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: UpsertPayload) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("youtube_watched").upsert(
      { user_id: context.userId, ...data },
      { onConflict: "user_id, kind, yt_id" },
    );
    if (error) throw error;
    // Also remove from watchlist to avoid duplicates.
    await context.supabase
      .from("youtube_watchlist")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("yt_id", data.yt_id);
    return { success: true };
  });

export const removeYtWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { yt_id: string; kind: YtKind }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("youtube_watched")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("yt_id", data.yt_id);
    if (error) throw error;
    return { success: true };
  });

// Format ISO 8601 duration PT#H#M#S -> "1h 2m", client-safe (also used server-side).
export function formatDuration(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return "";
  const h = Number(m[1] ?? 0);
  const mi = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  if (h > 0) return `${h}h ${mi}m`;
  if (mi > 0) return `${mi}m ${s}s`;
  return `${s}s`;
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
