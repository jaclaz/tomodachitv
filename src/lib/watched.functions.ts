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

function computeReleasedEpisodes(details: {
  seasons?: Array<{ season_number: number; episode_count?: number; air_date?: string | null }>;
  last_episode_to_air?: { season_number: number; episode_number: number; air_date?: string | null } | null;
  number_of_episodes?: number | null;
}): number | null {
  const today = new Date().toISOString().slice(0, 10);
  const last = details.last_episode_to_air;
  const seasons = (details.seasons ?? []).filter((s) => s.season_number > 0);
  if (last && (!last.air_date || last.air_date <= today)) {
    let total = 0;
    for (const s of seasons) {
      const ec = s.episode_count ?? 0;
      if (s.season_number < last.season_number) total += ec;
      else if (s.season_number === last.season_number)
        total += Math.min(last.episode_number, ec || last.episode_number);
    }
    return total;
  }
  if (seasons.length) {
    let total = 0;
    for (const s of seasons) {
      if (s.air_date && s.air_date <= today) total += s.episode_count ?? 0;
    }
    if (total > 0) return total;
  }
  return details.number_of_episodes ?? null;
}

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
        media_type === "tv" ? computeReleasedEpisodes(d) : null,
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

  // Always refetch live TMDB when we might need to mark completed, since cached
  // `episode_count_aired` may be stale (older imports stored total episodes,
  // including unaired ones). Also fetch when inserting a new row without title.
  let tmdb: Awaited<ReturnType<typeof fetchTmdbSummary>> = null;
  const needTmdb =
    watchedCount > 0 ||
    (!existing && (!cache || !cache.title)) ||
    !cache ||
    cache.episode_count_aired == null;
  if (needTmdb) tmdb = await fetchTmdbSummary("tv", tmdb_id);

  // Prefer freshly fetched released count over cache (cache may be outdated).
  const totalReleased =
    tmdb?.episode_count_aired ?? cache?.episode_count_aired ?? null;

  // Persist the freshly computed value back into media_cache so future reads
  // reflect the strict "released only" count.
  if (tmdb) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("media_cache").upsert(
        {
          media_type: "tv",
          tmdb_id,
          title: tmdb.title,
          poster_path: tmdb.poster_path,
          backdrop_path: tmdb.backdrop_path,
          release_date: tmdb.release_date,
          vote_average: tmdb.vote_average,
          episode_count_aired: tmdb.episode_count_aired,
          series_status: tmdb.series_status,
        },
        { onConflict: "media_type, tmdb_id" },
      );
    } catch {
      // best-effort
    }
  }

  let desired: string;
  if (watchedCount === 0) desired = "watching";
  else if (totalReleased && totalReleased > 0 && watchedCount >= totalReleased)
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

export const getWatchedShowIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number[]> => {
    const { data, error } = await context.supabase
      .from("watched_episodes")
      .select("tmdb_id")
      .eq("user_id", context.userId);
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r) => r.tmdb_id)));
  });

export interface WatchedShowProgress {
  tmdb_id: number;
  watched_count: number;
  total_released_episodes: number | null;
  is_currently_watching: boolean;
  is_completed: boolean;
}

export const getWatchedShowProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchedShowProgress[]> => {
    const { data: episodes, error } = await context.supabase
      .from("watched_episodes")
      .select("tmdb_id, season_number, episode_number")
      .eq("user_id", context.userId);
    if (error) throw error;

    const byShow = new Map<number, Set<string>>();
    for (const ep of episodes ?? []) {
      let watched = byShow.get(ep.tmdb_id);
      if (!watched) {
        watched = new Set<string>();
        byShow.set(ep.tmdb_id, watched);
      }
      watched.add(`${ep.season_number}-${ep.episode_number}`);
    }

    const ids = Array.from(byShow.keys());
    if (ids.length === 0) return [];

    const { data: cacheRows, error: cacheError } = await context.supabase
      .from("media_cache")
      .select("tmdb_id, episode_count_aired")
      .eq("media_type", "tv")
      .in("tmdb_id", ids);
    if (cacheError) throw cacheError;

    const totals = new Map<number, number | null>(
      (cacheRows ?? []).map((row) => [row.tmdb_id, row.episode_count_aired ?? null]),
    );

    return ids.map((tmdb_id) => {
      const watchedCount = byShow.get(tmdb_id)?.size ?? 0;
      const totalReleased = totals.get(tmdb_id) ?? null;
      const hasKnownTotal = totalReleased != null && totalReleased > 0;
      const isCompleted = hasKnownTotal && watchedCount >= totalReleased;
      return {
        tmdb_id,
        watched_count: watchedCount,
        total_released_episodes: totalReleased,
        is_currently_watching:
          watchedCount >= 1 && (!hasKnownTotal || watchedCount < totalReleased),
        is_completed: isCompleted,
      } satisfies WatchedShowProgress;
    });
  });

