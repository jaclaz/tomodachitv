import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

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

// ---- library sync helpers ----
const TMDB_BASE = "https://api.themoviedb.org/3";

async function fetchTmdbSummary(
  media_type: "tv" | "movie",
  tmdb_id: number
): Promise<{
  title: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  episode_count_aired: number | null;
  series_status: string | null;
} | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const url = new URL(`${TMDB_BASE}/${media_type}/${tmdb_id}`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("language", "en-US");
    const r = await fetch(url.toString());
    if (!r.ok) return null;
    const d = await r.json();
    return {
      title: media_type === "tv" ? d.name ?? null : d.title ?? null,
      poster_path: d.poster_path ?? null,
      backdrop_path: d.backdrop_path ?? null,
      release_date:
        (media_type === "tv" ? d.first_air_date : d.release_date) || null,
      vote_average: d.vote_average ?? null,
      episode_count_aired:
        media_type === "tv" ? d.number_of_episodes ?? null : null,
      series_status: media_type === "tv" ? d.status ?? null : null,
    };
  } catch {
    return null;
  }
}

async function syncTvLibrary(
  supabase: SupabaseClient,
  userId: string,
  tmdb_id: number
) {
  // Fetch cached metadata
  const { data: cache } = await supabase
    .from("media_cache")
    .select("*")
    .eq("media_type", "tv")
    .eq("tmdb_id", tmdb_id)
    .maybeSingle();

  const { count } = await supabase
    .from("watched_episodes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tmdb_id", tmdb_id);
  const watchedCount = count ?? 0;

  const { data: existing } = await supabase
    .from("watchlist")
    .select("id, status, series_name, poster_path, backdrop_path, first_air_date, vote_average")
    .eq("user_id", userId)
    .eq("media_type", "tv")
    .eq("tmdb_id", tmdb_id)
    .maybeSingle();

  // Never overwrite 'dropped' unless the user explicitly resumes
  if (existing?.status === "dropped") return;

  // If we're about to insert a new row and don't have decent metadata,
  // or we can't tell if the show is finished, fetch live from TMDB so we
  // don't store "Unknown series" and can compute completion correctly.
  let tmdb: Awaited<ReturnType<typeof fetchTmdbSummary>> = null;
  const needTmdb =
    (!existing && (!cache || !cache.title)) ||
    !cache ||
    cache.episode_count_aired == null;
  if (needTmdb) tmdb = await fetchTmdbSummary("tv", tmdb_id);

  const totalAired =
    cache?.episode_count_aired ?? tmdb?.episode_count_aired ?? null;
  let desired: string;
  if (watchedCount === 0) desired = "watching";
  else if (totalAired && totalAired > 0 && watchedCount >= totalAired)
    desired = "completed";
  else desired = "watching";

  if (!existing) {
    await supabase.from("watchlist").insert({
      user_id: userId,
      tmdb_id,
      media_type: "tv",
      series_name: cache?.title ?? tmdb?.title ?? "Unknown series",
      poster_path: cache?.poster_path ?? tmdb?.poster_path ?? null,
      backdrop_path: cache?.backdrop_path ?? tmdb?.backdrop_path ?? null,
      first_air_date: cache?.release_date ?? tmdb?.release_date ?? null,
      vote_average: cache?.vote_average ?? tmdb?.vote_average ?? null,
      status: desired,
    });
  } else if (existing.status !== desired) {
    await supabase
      .from("watchlist")
      .update({ status: desired })
      .eq("id", existing.id);
  }
}

async function syncMovieLibrary(
  supabase: SupabaseClient,
  userId: string,
  tmdb_id: number,
  fallbackTitle?: string | null,
  present: boolean = true
) {
  const { data: cache } = await supabase
    .from("media_cache")
    .select("*")
    .eq("media_type", "movie")
    .eq("tmdb_id", tmdb_id)
    .maybeSingle();

  const status = present ? "completed" : "watching";

  const { data: existing } = await supabase
    .from("watchlist")
    .select("id, status")
    .eq("user_id", userId)
    .eq("media_type", "movie")
    .eq("tmdb_id", tmdb_id)
    .maybeSingle();

  let tmdb: Awaited<ReturnType<typeof fetchTmdbSummary>> = null;
  if (!existing && (!cache || !cache.title))
    tmdb = await fetchTmdbSummary("movie", tmdb_id);

  if (!existing) {
    await supabase.from("watchlist").insert({
      user_id: userId,
      tmdb_id,
      media_type: "movie",
      series_name:
        cache?.title ?? tmdb?.title ?? fallbackTitle ?? "Movie",
      poster_path: cache?.poster_path ?? tmdb?.poster_path ?? null,
      backdrop_path: cache?.backdrop_path ?? tmdb?.backdrop_path ?? null,
      first_air_date: cache?.release_date ?? tmdb?.release_date ?? null,
      vote_average: cache?.vote_average ?? tmdb?.vote_average ?? null,
      status,
    });
  } else if (existing.status !== status) {
    await supabase
      .from("watchlist")
      .update({ status })
      .eq("id", existing.id);
  }
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

    try {
      await syncTvLibrary(context.supabase, context.userId, data.tmdb_id);
    } catch {
      // best-effort
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
    try {
      await syncTvLibrary(context.supabase, context.userId, data.tmdb_id);
    } catch {
      // best-effort
    }
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
      await syncTvLibrary(context.supabase, context.userId, data.tmdb_id);
    } catch {
      // best-effort
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
    try {
      await syncMovieLibrary(
        context.supabase,
        context.userId,
        data.tmdb_id,
        data.title,
        true
      );
    } catch {
      // best-effort
    }
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
    try {
      await syncMovieLibrary(
        context.supabase,
        context.userId,
        data.tmdb_id,
        null,
        false
      );
    } catch {
      // best-effort
    }
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
