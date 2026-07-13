import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WatchedEpisode {
  id: string;
  user_id: string;
  tmdb_id: number;
  season_number: number;
  episode_number: number;
  episode_name: string | null;
  runtime_minutes: number | null;
  watched_at: string;
}

export interface WatchedMovie {
  id: string;
  user_id: string;
  tmdb_id: number;
  title: string | null;
  runtime_minutes: number | null;
  watched_at: string;
}

// ============ Episodes (TV) ============
export const getWatchedEpisodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tmdb_id: number }) => input)
  .handler(async ({ context, data }): Promise<WatchedEpisode[]> => {
    const { data: rows, error } = await context.supabase
      .from("watched_episodes")
      .select("*")
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id)
      .order("season_number", { ascending: true })
      .order("episode_number", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const markEpisodeWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      season_number: number;
      episode_number: number;
      episode_name?: string;
      runtime_minutes?: number | null;
    }) => input
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("watched_episodes").upsert(
      {
        user_id: context.userId,
        ...data,
      },
      { onConflict: "user_id, tmdb_id, season_number, episode_number" }
    );
    if (error) throw error;

    // If the user has now watched every aired episode, drop the show
    // from their watchlist so it stops showing up as "still to watch".
    try {
      const { data: cache } = await context.supabase
        .from("media_cache")
        .select("episode_count_aired")
        .eq("media_type", "tv")
        .eq("tmdb_id", data.tmdb_id)
        .maybeSingle();
      const totalAired = cache?.episode_count_aired ?? null;
      if (totalAired && totalAired > 0) {
        const { count } = await context.supabase
          .from("watched_episodes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", context.userId)
          .eq("tmdb_id", data.tmdb_id);
        if ((count ?? 0) >= totalAired) {
          await context.supabase
            .from("watchlist")
            .delete()
            .eq("user_id", context.userId)
            .eq("media_type", "tv")
            .eq("tmdb_id", data.tmdb_id);
        }
      }
    } catch {
      // best-effort cleanup only
    }
    return { success: true };
  });

export const unmarkEpisodeWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      season_number: number;
      episode_number: number;
    }) => input
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("watched_episodes")
      .delete()
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id)
      .eq("season_number", data.season_number)
      .eq("episode_number", data.episode_number);
    if (error) throw error;
    return { success: true };
  });

export const markEpisodesBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      episodes: {
        season_number: number;
        episode_number: number;
        episode_name?: string;
        runtime_minutes?: number | null;
      }[];
    }) => input
  )
  .handler(async ({ context, data }) => {
    if (!data.episodes.length) return { success: true, count: 0 };
    const rows = data.episodes.map((e) => ({
      user_id: context.userId,
      tmdb_id: data.tmdb_id,
      ...e,
    }));
    const { error } = await context.supabase
      .from("watched_episodes")
      .upsert(rows, {
        onConflict: "user_id, tmdb_id, season_number, episode_number",
      });
    if (error) throw error;

    try {
      const { data: cache } = await context.supabase
        .from("media_cache")
        .select("episode_count_aired")
        .eq("media_type", "tv")
        .eq("tmdb_id", data.tmdb_id)
        .maybeSingle();
      const totalAired = cache?.episode_count_aired ?? null;
      if (totalAired && totalAired > 0) {
        const { count } = await context.supabase
          .from("watched_episodes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", context.userId)
          .eq("tmdb_id", data.tmdb_id);
        if ((count ?? 0) >= totalAired) {
          await context.supabase
            .from("watchlist")
            .delete()
            .eq("user_id", context.userId)
            .eq("media_type", "tv")
            .eq("tmdb_id", data.tmdb_id);
        }
      }
    } catch {
      // best-effort cleanup
    }
    return { success: true, count: rows.length };
  });

// ============ Movies ============
export const getWatchedMovies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchedMovie[]> => {
    const { data, error } = await context.supabase
      .from("watched_movies")
      .select("*")
      .eq("user_id", context.userId)
      .order("watched_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const markMovieWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      title?: string;
      runtime_minutes?: number | null;
    }) => input
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("watched_movies").upsert(
      {
        user_id: context.userId,
        ...data,
      },
      { onConflict: "user_id, tmdb_id" }
    );
    if (error) throw error;
    return { success: true };
  });

export const unmarkMovieWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("watched_movies")
      .delete()
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });

// ============ Combined stats ============
export const getAllWatchedStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [episodesRes, moviesRes] = await Promise.all([
      context.supabase
        .from("watched_episodes")
        .select("runtime_minutes", { count: "exact" })
        .eq("user_id", context.userId),
      context.supabase
        .from("watched_movies")
        .select("runtime_minutes", { count: "exact" })
        .eq("user_id", context.userId),
    ]);
    if (episodesRes.error) throw episodesRes.error;
    if (moviesRes.error) throw moviesRes.error;

    const totalEpisodes = episodesRes.count ?? 0;
    const totalMovies = moviesRes.count ?? 0;
    const epMinutes = (episodesRes.data ?? []).reduce(
      (total, row) => total + (row.runtime_minutes ?? 0),
      0,
    );
    const movieMinutes = (moviesRes.data ?? []).reduce(
      (total, row) => total + (row.runtime_minutes ?? 0),
      0,
    );
    return {
      totalEpisodes,
      totalMovies,
      totalMinutes: epMinutes + movieMinutes,
      episodeMinutes: epMinutes,
      movieMinutes,
    };
  });
