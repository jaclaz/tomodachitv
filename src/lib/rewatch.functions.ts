import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Rewatch {
  id: string;
  media_type: string;
  tmdb_id: number;
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
      .select("id, media_type, tmdb_id, title, poster_path, episodes_count, minutes, created_at")
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
        const { data: rows, error } = await context.supabase
          .from("watched_episodes")
          .select("season_number, episode_number, runtime_minutes")
          .eq("user_id", context.userId)
          .eq("tmdb_id", data.tmdb_id)
          .range(from, from + pageSize - 1);
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
        throw new Error("Mark at least one episode as watched before logging a rewatch.");
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
  .validator((input: { media_type: "tv" | "movie"; tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("rewatches")
      .select("id")
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id)
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
