import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
}

export interface ProfileWithStats extends PublicProfile {
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_self: boolean;
}

export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { query: string }) => input)
  .handler(async ({ context, data }): Promise<PublicProfile[]> => {
    const q = data.query.trim().replace(/[,()%]/g, "");
    if (q.length < 2) return [];
    const { data: rows, error } = await context.supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, bio")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq("id", context.userId)
      .not("username", "is", null)
      .limit(20);
    if (error) throw error;
    return (rows ?? []) as PublicProfile[];
  });


export const getProfileByUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { username: string }) => input)
  .handler(async ({ context, data }): Promise<ProfileWithStats | null> => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, bio")
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return null;
    const [{ count: followers }, { count: following }, { data: rel }] =
      await Promise.all([
        context.supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", profile.id),
        context.supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", profile.id),
        context.supabase
          .from("follows")
          .select("id")
          .eq("follower_id", context.userId)
          .eq("following_id", profile.id)
          .maybeSingle(),
      ]);
    return {
      ...(profile as PublicProfile),
      followers_count: followers ?? 0,
      following_count: following ?? 0,
      is_following: !!rel,
      is_self: profile.id === context.userId,
    };
  });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(async ({ context, data }) => {
    if (data.user_id === context.userId) throw new Error("Can't follow yourself");
    const { error } = await context.supabase.from("follows").insert({
      follower_id: context.userId,
      following_id: data.user_id,
    });
    if (error && !error.message.includes("duplicate")) throw error;
    return { success: true };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("follows")
      .delete()
      .eq("follower_id", context.userId)
      .eq("following_id", data.user_id);
    if (error) throw error;
    return { success: true };
  });

export const getUserWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", data.user_id)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const getUserWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(async ({ context, data }) => {
    // RLS enforces: only owner or follower can read. Empty = not permitted.
    const [{ data: episodes }, { data: movies }] = await Promise.all([
      context.supabase
        .from("watched_episodes")
        .select("*")
        .eq("user_id", data.user_id)
        .order("watched_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("watched_movies")
        .select("*")
        .eq("user_id", data.user_id)
        .order("watched_at", { ascending: false })
        .limit(100),
    ]);
    return { episodes: episodes ?? [], movies: movies ?? [] };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      username?: string;
      display_name?: string;
      bio?: string | null;
      avatar_url?: string | null;
      banner_url?: string | null;
    }) => input
  )
  .handler(async ({ context, data }) => {
    if (data.username) {
      const clean = data.username.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (clean.length < 3) throw new Error("Username must be at least 3 characters");
      data.username = clean;
    }
    if (data.avatar_url) {
      const base = process.env.SUPABASE_URL;
      if (!base || !data.avatar_url.startsWith(`${base}/storage/v1/`)) {
        throw new Error("Invalid avatar URL");
      }
    }
    if (data.banner_url) {
      const base = process.env.SUPABASE_URL;
      if (!base || !data.banner_url.startsWith(`${base}/storage/v1/`)) {
        throw new Error("Invalid banner URL");
      }
    }
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw error;
    return { success: true };
  });

export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublicProfile | null> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, bio")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data as PublicProfile | null;
  });

// ---------- Following activity feed ----------

export interface FollowingActivityItem {
  id: string;
  kind: "movie" | "episode";
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  watched_at: string;
  // episode-only
  season_number?: number;
  episode_number?: number;
  episode_name?: string | null;
}

export const getFollowingActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FollowingActivityItem[]> => {
    const { data: follows } = await context.supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", context.userId);
    const ids = (follows ?? []).map((f) => f.following_id);
    if (ids.length === 0) return [];

    const [{ data: movies }, { data: episodes }] = await Promise.all([
      context.supabase
        .from("watched_movies")
        .select("id, user_id, tmdb_id, title, watched_at")
        .in("user_id", ids)
        .order("watched_at", { ascending: false })
        .limit(40),
      context.supabase
        .from("watched_episodes")
        .select("id, user_id, tmdb_id, season_number, episode_number, episode_name, watched_at")
        .in("user_id", ids)
        .order("watched_at", { ascending: false })
        .limit(40),
    ]);

    const allUserIds = [
      ...new Set([...(movies ?? []).map((m) => m.user_id), ...(episodes ?? []).map((e) => e.user_id)]),
    ];
    const allTmdbIds = [
      ...new Set([...(movies ?? []).map((m) => m.tmdb_id), ...(episodes ?? []).map((e) => e.tmdb_id)]),
    ];

    const [{ data: profiles }, { data: cache }] = await Promise.all([
      allUserIds.length
        ? context.supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", allUserIds)
        : Promise.resolve({ data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null }[] }),
      allTmdbIds.length
        ? context.supabase
            .from("media_cache")
            .select("media_type, tmdb_id, title, poster_path")
            .in("tmdb_id", allTmdbIds)
        : Promise.resolve({ data: [] as { media_type: string; tmdb_id: number; title: string | null; poster_path: string | null }[] }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const cacheMap = new Map((cache ?? []).map((c) => [`${c.media_type}:${c.tmdb_id}`, c]));

    const items: FollowingActivityItem[] = [];
    for (const m of movies ?? []) {
      const p = profileMap.get(m.user_id);
      if (!p) continue;
      const c = cacheMap.get(`movie:${m.tmdb_id}`);
      items.push({
        id: `m:${m.id}`,
        kind: "movie",
        user: p,
        tmdb_id: m.tmdb_id,
        title: m.title ?? c?.title ?? `#${m.tmdb_id}`,
        poster_path: c?.poster_path ?? null,
        watched_at: m.watched_at,
      });
    }
    for (const e of episodes ?? []) {
      const p = profileMap.get(e.user_id);
      if (!p) continue;
      const c = cacheMap.get(`tv:${e.tmdb_id}`);
      items.push({
        id: `e:${e.id}`,
        kind: "episode",
        user: p,
        tmdb_id: e.tmdb_id,
        title: c?.title ?? `#${e.tmdb_id}`,
        poster_path: c?.poster_path ?? null,
        watched_at: e.watched_at,
        season_number: e.season_number,
        episode_number: e.episode_number,
        episode_name: e.episode_name,
      });
    }
    items.sort((a, b) => (a.watched_at < b.watched_at ? 1 : -1));
    return items.slice(0, 50);
  });
