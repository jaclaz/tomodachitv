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
    const [{ data: eps, error: e1 }, { data: movies, error: e2 }] =
      await Promise.all([
        context.supabase
          .from("watched_episodes")
          .select("runtime_minutes")
          .eq("user_id", context.userId),
        context.supabase
          .from("watched_movies")
          .select("runtime_minutes")
          .eq("user_id", context.userId),
      ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const totalEpisodes = eps?.length ?? 0;
    const totalMovies = movies?.length ?? 0;
    const epMinutes = (eps ?? []).reduce(
      (s, e) => s + (e.runtime_minutes || 0),
      0
    );
    const movieMinutes = (movies ?? []).reduce(
      (s, m) => s + (m.runtime_minutes || 0),
      0
    );
    return {
      totalEpisodes,
      totalMovies,
      totalMinutes: epMinutes + movieMinutes,
      episodeMinutes: epMinutes,
      movieMinutes,
    };
  });
