import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Rewatch {
  id: string;
  media_type: string;
  tmdb_id: number;
  season_number: number | null;
  title: string | null;
  poster_path: string | null;
  episodes_count: number;
  minutes: number;
  created_at: string;
}

export const getRewatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { media_type: "tv" | "movie"; tmdb_id: number }) => input)
  .handler(async ({ context, data }): Promise<Rewatch[]> => {
    const { data: rows, error } = await context.supabase
      .from("rewatches")
      .select("id, media_type, tmdb_id, season_number, title, poster_path, episodes_count, minutes, created_at")
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/**
 * Logs one full rewatch of a title. The episodes/minutes counted are derived
 * from what the user has already marked as watched for that title, so a
 * rewatch adds the same amount to the totals as the original watch did.
 */
export const addRewatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      media_type: "tv" | "movie";
      tmdb_id: number;
      season_number?: number | null;
      title?: string | null;
      poster_path?: string | null;
      runtime_minutes?: number | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    let episodes = 0;
    let minutes = 0;

    if (data.media_type === "tv") {
      const pageSize = 1000;
      const seen = new Set<string>();
      for (let from = 0; ; from += pageSize) {
        let query = context.supabase
          .from("watched_episodes")
          .select("season_number, episode_number, runtime_minutes")
          .eq("user_id", context.userId)
          .eq("tmdb_id", data.tmdb_id);
        if (data.season_number != null) {
          query = query.eq("season_number", data.season_number);
        }
        const { data: rows, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        for (const r of rows ?? []) {
          const key = `${r.season_number}-${r.episode_number}`;
          if (seen.has(key)) continue;
          seen.add(key);
          episodes += 1;
          minutes += r.runtime_minutes ?? 0;
        }
        if (!rows || rows.length < pageSize) break;
      }
      if (episodes === 0) {
        throw new Error(
          data.season_number != null
            ? "Mark at least one episode of this season as watched before logging a rewatch."
            : "Mark at least one episode as watched before logging a rewatch.",
        );
      }
    } else {
      const { data: row, error } = await context.supabase
        .from("watched_movies")
        .select("runtime_minutes")
        .eq("user_id", context.userId)
        .eq("tmdb_id", data.tmdb_id)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        throw new Error("Mark the movie as watched before logging a rewatch.");
      }
      minutes = row.runtime_minutes ?? data.runtime_minutes ?? 0;
    }

    const { error: insertError } = await context.supabase.from("rewatches").insert({
      user_id: context.userId,
      media_type: data.media_type,
      tmdb_id: data.tmdb_id,
      season_number: data.media_type === "tv" ? data.season_number ?? null : null,
      title: data.title ?? null,
      poster_path: data.poster_path ?? null,
      episodes_count: episodes,
      minutes,
    });
    if (insertError) throw insertError;

    return { success: true, episodes, minutes };
  });

export const removeLastRewatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      media_type: "tv" | "movie";
      tmdb_id: number;
      season_number?: number | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    let sel = context.supabase
      .from("rewatches")
      .select("id")
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    sel =
      data.season_number == null
        ? sel.is("season_number", null)
        : sel.eq("season_number", data.season_number);
    const { data: rows, error } = await sel
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const last = rows?.[0];
    if (!last) return { success: true };
    const { error: delError } = await context.supabase
      .from("rewatches")
      .delete()
      .eq("id", last.id)
      .eq("user_id", context.userId);
    if (delError) throw delError;
    return { success: true };
  });

export interface RewatchTotals {
  count: number;
  episodes: number;
  movies: number;
  minutes: number;
}

export const getRewatchTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RewatchTotals> => {
    const { data, error } = await context.supabase
      .from("rewatches")
      .select("media_type, episodes_count, minutes")
      .eq("user_id", context.userId);
    if (error) throw error;
    const rows = data ?? [];
    return {
      count: rows.length,
      episodes: rows.reduce((t, r) => t + (r.episodes_count ?? 0), 0),
      movies: rows.filter((r) => r.media_type === "movie").length,
      minutes: rows.reduce((t, r) => t + (r.minutes ?? 0), 0),
    };
  });

export interface RewatchedTitle {
  media_type: string;
  tmdb_id: number;
  title: string | null;
  poster_path: string | null;
  times: number;
  minutes: number;
  episodes: number;
  seasonTimes: number;
  fullTimes: number;
}

export interface RewatchStats {
  totalRewatches: number;
  totalMinutes: number;
  distinctTitles: number;
  seasonRewatches: number;
  topTitles: RewatchedTitle[];
  mostRewatched: RewatchedTitle | null;
}

/** Aggregated view of what the user rewatches the most. */
export const getRewatchStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RewatchStats> => {
    const { data, error } = await context.supabase
      .from("rewatches")
      .select(
        "media_type, tmdb_id, season_number, title, poster_path, episodes_count, minutes",
      )
      .eq("user_id", context.userId);
    if (error) throw error;
    const rows = data ?? [];

    const map = new Map<string, RewatchedTitle>();
    for (const r of rows) {
      const key = `${r.media_type}-${r.tmdb_id}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          media_type: r.media_type,
          tmdb_id: r.tmdb_id,
          title: r.title ?? null,
          poster_path: r.poster_path ?? null,
          times: 0,
          minutes: 0,
          episodes: 0,
          seasonTimes: 0,
          fullTimes: 0,
        };
        map.set(key, entry);
      }
      entry.times += 1;
      entry.minutes += r.minutes ?? 0;
      entry.episodes += r.episodes_count ?? 0;
      if (r.season_number == null) entry.fullTimes += 1;
      else entry.seasonTimes += 1;
      if (!entry.title && r.title) entry.title = r.title;
      if (!entry.poster_path && r.poster_path) entry.poster_path = r.poster_path;
    }

    const topTitles = [...map.values()].sort(
      (a, b) => b.times - a.times || b.minutes - a.minutes,
    );

    return {
      totalRewatches: rows.length,
      totalMinutes: rows.reduce((t, r) => t + (r.minutes ?? 0), 0),
      distinctTitles: map.size,
      seasonRewatches: rows.filter((r) => r.season_number != null).length,
      topTitles: topTitles.slice(0, 8),
      mostRewatched: topTitles[0] ?? null,
    };
  });
