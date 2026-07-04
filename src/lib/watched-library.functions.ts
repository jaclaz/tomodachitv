import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";

export interface WatchedLibraryItem {
  media_type: "tv" | "movie";
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number | null;
  release_date: string | null;
  genre_ids: number[];
  watched_at: string; // most recent watched_at
  episodes_watched: number | null; // only for tv
}

export const getWatchedLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchedLibraryItem[]> => {
    // Aggregate watched TV shows
    const { data: eps, error: e1 } = await context.supabase
      .from("watched_episodes")
      .select("tmdb_id, watched_at")
      .eq("user_id", context.userId);
    if (e1) throw e1;

    const showAgg = new Map<
      number,
      { count: number; last: string }
    >();
    for (const r of eps ?? []) {
      const cur = showAgg.get(r.tmdb_id);
      if (!cur) {
        showAgg.set(r.tmdb_id, { count: 1, last: r.watched_at });
      } else {
        cur.count += 1;
        if (r.watched_at > cur.last) cur.last = r.watched_at;
      }
    }

    // Watched movies (distinct rows already)
    const { data: movies, error: e2 } = await context.supabase
      .from("watched_movies")
      .select("tmdb_id, title, watched_at")
      .eq("user_id", context.userId);
    if (e2) throw e2;

    const wantedKeys: Array<{ media_type: "tv" | "movie"; tmdb_id: number }> = [
      ...Array.from(showAgg.keys()).map(
        (id) => ({ media_type: "tv" as const, tmdb_id: id })
      ),
      ...(movies ?? []).map((m) => ({
        media_type: "movie" as const,
        tmdb_id: m.tmdb_id,
      })),
    ];

    if (wantedKeys.length === 0) return [];

    // Load cache for these ids
    const showIds = wantedKeys
      .filter((k) => k.media_type === "tv")
      .map((k) => k.tmdb_id);
    const movieIds = wantedKeys
      .filter((k) => k.media_type === "movie")
      .map((k) => k.tmdb_id);

    const [cachedShowsRes, cachedMoviesRes] = await Promise.all([
      showIds.length
        ? context.supabase
            .from("media_cache")
            .select("*")
            .eq("media_type", "tv")
            .in("tmdb_id", showIds)
        : Promise.resolve({ data: [], error: null } as any),
      movieIds.length
        ? context.supabase
            .from("media_cache")
            .select("*")
            .eq("media_type", "movie")
            .in("tmdb_id", movieIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const cacheMap = new Map<string, any>();
    for (const r of (cachedShowsRes.data ?? []) as any[])
      cacheMap.set(`tv:${r.tmdb_id}`, r);
    for (const r of (cachedMoviesRes.data ?? []) as any[])
      cacheMap.set(`movie:${r.tmdb_id}`, r);

    // Fetch missing from TMDB and upsert
    const missing = wantedKeys.filter(
      (k) => !cacheMap.has(`${k.media_type}:${k.tmdb_id}`)
    );

    if (missing.length) {
      const key = process.env.TMDB_API_KEY;
      if (!key) throw new Error("TMDB_API_KEY not configured");

      const fetchOne = async (
        k: { media_type: "tv" | "movie"; tmdb_id: number }
      ) => {
        try {
          const url = new URL(
            `${TMDB_BASE}/${k.media_type}/${k.tmdb_id}`
          );
          url.searchParams.set("api_key", key);
          url.searchParams.set("language", "en-US");
          const r = await fetch(url.toString());
          if (!r.ok) return null;
          const d = await r.json();
          return {
            media_type: k.media_type,
            tmdb_id: k.tmdb_id,
            title: k.media_type === "tv" ? d.name : d.title,
            poster_path: d.poster_path ?? null,
            backdrop_path: d.backdrop_path ?? null,
            vote_average: d.vote_average ?? null,
            release_date:
              (k.media_type === "tv" ? d.first_air_date : d.release_date) ||
              null,
            genre_ids: (d.genres ?? []).map((g: any) => g.id),
          };
        } catch {
          return null;
        }
      };

      // Concurrency-limited fetches
      const results: any[] = [];
      let idx = 0;
      const workers = Array.from(
        { length: Math.min(10, missing.length) },
        async () => {
          while (true) {
            const i = idx++;
            if (i >= missing.length) return;
            const r = await fetchOne(missing[i]);
            if (r) results.push(r);
          }
        }
      );
      await Promise.all(workers);

      if (results.length) {
        // Insert via admin so writes bypass the read-only user policy
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        await supabaseAdmin
          .from("media_cache")
          .upsert(results, { onConflict: "media_type, tmdb_id" });
        for (const r of results) cacheMap.set(`${r.media_type}:${r.tmdb_id}`, r);
      }
    }

    const items: WatchedLibraryItem[] = [];
    for (const [tmdb_id, agg] of showAgg) {
      const c = cacheMap.get(`tv:${tmdb_id}`);
      items.push({
        media_type: "tv",
        tmdb_id,
        title: c?.title ?? "Unknown series",
        poster_path: c?.poster_path ?? null,
        backdrop_path: c?.backdrop_path ?? null,
        vote_average: c?.vote_average ?? null,
        release_date: c?.release_date ?? null,
        genre_ids: c?.genre_ids ?? [],
        watched_at: agg.last,
        episodes_watched: agg.count,
      });
    }
    for (const m of movies ?? []) {
      const c = cacheMap.get(`movie:${m.tmdb_id}`);
      items.push({
        media_type: "movie",
        tmdb_id: m.tmdb_id,
        title: c?.title ?? m.title ?? "Unknown movie",
        poster_path: c?.poster_path ?? null,
        backdrop_path: c?.backdrop_path ?? null,
        vote_average: c?.vote_average ?? null,
        release_date: c?.release_date ?? null,
        genre_ids: c?.genre_ids ?? [],
        watched_at: m.watched_at,
        episodes_watched: null,
      });
    }
    return items;
  });
