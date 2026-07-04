import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
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
      .select("id, username, display_name, avatar_url, bio")
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
      .select("id, username, display_name, avatar_url, bio")
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
      bio?: string;
      avatar_url?: string | null;
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
      .select("id, username, display_name, avatar_url, bio")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data as PublicProfile | null;
  });
