import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MediaType } from "@/lib/tmdb";

const TMDB_BASE = "https://api.themoviedb.org/3";

export type WatchlistStatus =
  | "watching"
  | "caught_up"
  | "completed"
  | "dropped";

export interface WatchlistItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  series_name: string; // reused as title for both tv and movie
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null; // reused as release_date for movies
  vote_average: number | null;
  added_at: string;
  status: WatchlistStatus | null; // manual override
  // Derived / enriched fields (not persisted on watchlist row)
  derived_status: WatchlistStatus;
  series_status: string | null;
  episode_count_aired: number | null;
  episodes_watched: number | null;
  next_air_date: string | null;
}

interface WatchlistRow {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  series_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number | null;
  added_at: string;
  status: WatchlistStatus | null;
}

interface CacheRow {
  media_type: string;
  tmdb_id: number;
  title: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number | null;
  release_date: string | null;
  genre_ids: number[] | null;
  series_status: string | null;
  episode_count_aired: number | null;
  next_air_date: string | null;
}

async function fetchTvMeta(tmdb_id: number, key: string) {
  try {
    const url = new URL(`${TMDB_BASE}/tv/${tmdb_id}`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("language", "en-US");
    const r = await fetch(url.toString());
    if (!r.ok) return null;
    const d = await r.json();
    return {
      media_type: "tv" as const,
      tmdb_id,
      title: d.name ?? null,
      poster_path: d.poster_path ?? null,
      backdrop_path: d.backdrop_path ?? null,
      vote_average: d.vote_average ?? null,
      release_date: d.first_air_date || null,
      genre_ids: (d.genres ?? []).map((g: { id: number }) => g.id),
      series_status: (d.status as string) ?? null,
      episode_count_aired: (d.number_of_episodes as number) ?? null,
      next_air_date: d.next_episode_to_air?.air_date ?? null,
    };
  } catch {
    return null;
  }
}

function computeDerivedStatus(
  row: WatchlistRow,
  cache: CacheRow | undefined,
  epsWatched: number,
): WatchlistStatus {
  if (row.status) return row.status;
  if (row.media_type === "movie") return "watching";
  const total = cache?.episode_count_aired ?? 0;
  const seriesStatus = (cache?.series_status ?? "").toLowerCase();
  const ended = seriesStatus === "ended" || seriesStatus === "canceled";
  if (total > 0 && epsWatched >= total) {
    return ended ? "completed" : "caught_up";
  }
  return "watching";
}

export const getWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchlistItem[]> => {
    const { data: rows, error } = await context.supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", context.userId)
      .order("added_at", { ascending: false });
    if (error) throw error;
    const list = (rows ?? []) as WatchlistRow[];
    // Exclude dropped from watchlist reads (they live in Watched > Dropped)
    const active = list.filter((r) => r.status !== "dropped");
    if (active.length === 0) return [];

    const tvIds = Array.from(
      new Set(active.filter((r) => r.media_type === "tv").map((r) => r.tmdb_id)),
    );

    // Cache lookup
    const cacheMap = new Map<number, CacheRow>();
    if (tvIds.length) {
      const { data: cached } = await context.supabase
        .from("media_cache")
        .select("*")
        .eq("media_type", "tv")
        .in("tmdb_id", tvIds);
      for (const r of (cached ?? []) as CacheRow[]) cacheMap.set(r.tmdb_id, r);

      // Fetch missing from TMDB
      const missing = tvIds.filter((id) => !cacheMap.has(id));
      if (missing.length) {
        const key = process.env.TMDB_API_KEY;
        if (key) {
          const fetched: CacheRow[] = [];
          let idx = 0;
          const workers = Array.from(
            { length: Math.min(8, missing.length) },
            async () => {
              while (true) {
                const i = idx++;
                if (i >= missing.length) return;
                const r = await fetchTvMeta(missing[i], key);
                if (r) fetched.push(r as unknown as CacheRow);
              }
            },
          );
          await Promise.all(workers);
          if (fetched.length) {
            const { supabaseAdmin } = await import(
              "@/integrations/supabase/client.server"
            );
            await supabaseAdmin
              .from("media_cache")
              .upsert(
                fetched.map((f) => ({ ...f, genre_ids: f.genre_ids ?? [] })),
                { onConflict: "media_type, tmdb_id" },
              );
            for (const r of fetched) cacheMap.set(r.tmdb_id, r);
          }
        }
      }
    }

    // Watched episodes counts
    const epsCount = new Map<number, number>();
    if (tvIds.length) {
      const { data: eps } = await context.supabase
        .from("watched_episodes")
        .select("tmdb_id")
        .eq("user_id", context.userId)
        .in("tmdb_id", tvIds);
      for (const r of (eps ?? []) as { tmdb_id: number }[]) {
        epsCount.set(r.tmdb_id, (epsCount.get(r.tmdb_id) ?? 0) + 1);
      }
    }

    return active.map((row) => {
      const cache = row.media_type === "tv" ? cacheMap.get(row.tmdb_id) : undefined;
      const epsWatched = row.media_type === "tv"
        ? (epsCount.get(row.tmdb_id) ?? 0)
        : 0;
      return {
        ...row,
        derived_status: computeDerivedStatus(row, cache, epsWatched),
        series_status: cache?.series_status ?? null,
        episode_count_aired: cache?.episode_count_aired ?? null,
        episodes_watched: row.media_type === "tv" ? epsWatched : null,
        next_air_date: cache?.next_air_date ?? null,
      };
    });
  });

export const addToWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      media_type: MediaType;
      series_name: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      first_air_date?: string | null;
      vote_average?: number | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase
      .from("watchlist")
      .upsert(
        {
          user_id: context.userId,
          ...data,
        },
        { onConflict: "user_id, media_type, tmdb_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return result as WatchlistRow;
  });

export const removeFromWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tmdb_id: number; media_type: MediaType }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .delete()
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });

export const setWatchlistStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      media_type: MediaType;
      status: WatchlistStatus | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .update({ status: data.status })
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });

export interface DroppedShow {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  vote_average: number | null;
  first_air_date: string | null;
  added_at: string;
}

export const getDroppedShows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DroppedShow[]> => {
    const { data, error } = await context.supabase
      .from("watchlist")
      .select(
        "tmdb_id, series_name, poster_path, vote_average, first_air_date, added_at",
      )
      .eq("user_id", context.userId)
      .eq("media_type", "tv")
      .eq("status", "dropped")
      .order("added_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      tmdb_id: r.tmdb_id,
      title: r.series_name,
      poster_path: r.poster_path,
      vote_average: r.vote_average,
      first_air_date: r.first_air_date,
      added_at: r.added_at,
    }));
  });
