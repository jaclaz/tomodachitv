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
  watched_at: string;
  episodes_watched: number | null;
  series_status: string | null;
  dropped: boolean;
}

async function buildWatchedLibrary(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<WatchedLibraryItem[]> {
  const context = { supabase, userId };
  {
    const { data: libRows, error: libErr } = await context.supabase
      .from("watchlist")
      .select("tmdb_id, media_type, series_name, poster_path, backdrop_path, first_air_date, vote_average, status, added_at")
      .eq("user_id", context.userId)
      .in("status", ["completed", "dropped"]);
    if (libErr) throw libErr;

    const tvIds = (libRows ?? [])
      .filter((r) => r.media_type === "tv")
      .map((r) => r.tmdb_id);
    const movieIds = (libRows ?? [])
      .filter((r) => r.media_type === "movie")
      .map((r) => r.tmdb_id);

    // Episodes for tv rows (for counts + last watched)
    const { data: eps, error: e1 } = await context.supabase
      .from("watched_episodes")
      .select("tmdb_id, watched_at")
      .eq("user_id", context.userId);
    if (e1) throw e1;
    const showAgg = new Map<number, { count: number; last: string }>();
    for (const r of eps ?? []) {
      const cur = showAgg.get(r.tmdb_id);
      if (!cur) showAgg.set(r.tmdb_id, { count: 1, last: r.watched_at });
      else {
        cur.count += 1;
        if (r.watched_at > cur.last) cur.last = r.watched_at;
      }
    }

    const { data: movies, error: e2 } = await context.supabase
      .from("watched_movies")
      .select("tmdb_id, title, watched_at")
      .eq("user_id", context.userId);
    if (e2) throw e2;
    const movieMap = new Map<number, { title: string | null; watched_at: string }>();
    for (const m of movies ?? []) movieMap.set(m.tmdb_id, { title: m.title, watched_at: m.watched_at });

    // Load media_cache
    const [cachedShowsRes, cachedMoviesRes] = await Promise.all([
      tvIds.length
        ? context.supabase.from("media_cache").select("*").eq("media_type", "tv").in("tmdb_id", tvIds)
        : Promise.resolve({ data: [], error: null } as any),
      movieIds.length
        ? context.supabase.from("media_cache").select("*").eq("media_type", "movie").in("tmdb_id", movieIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    const cacheMap = new Map<string, any>();
    for (const r of (cachedShowsRes.data ?? []) as any[]) cacheMap.set(`tv:${r.tmdb_id}`, r);
    for (const r of (cachedMoviesRes.data ?? []) as any[]) cacheMap.set(`movie:${r.tmdb_id}`, r);

    const needsRefetch = (r: { media_type: string; tmdb_id: number }) => {
      const cached = cacheMap.get(`${r.media_type}:${r.tmdb_id}`);
      if (!cached) return true;
      if (r.media_type === "tv" && (cached.episode_count_aired == null || cached.series_status == null)) return true;
      return false;
    };
    const missing = (libRows ?? []).filter(needsRefetch).map((r) => ({
      media_type: r.media_type as "tv" | "movie",
      tmdb_id: r.tmdb_id,
    }));

    if (missing.length) {
      const key = process.env.TMDB_API_KEY;
      if (key) {
        const fetchOne = async (k: { media_type: "tv" | "movie"; tmdb_id: number }) => {
          try {
            const url = new URL(`${TMDB_BASE}/${k.media_type}/${k.tmdb_id}`);
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
              release_date: (k.media_type === "tv" ? d.first_air_date : d.release_date) || null,
              genre_ids: (d.genres ?? []).map((g: any) => g.id),
              episode_count_aired: k.media_type === "tv" ? (d.number_of_episodes ?? null) : null,
              series_status: k.media_type === "tv" ? (d.status ?? null) : null,
            };
          } catch {
            return null;
          }
        };
        const results: any[] = [];
        let idx = 0;
        const workers = Array.from({ length: Math.min(10, missing.length) }, async () => {
          while (true) {
            const i = idx++;
            if (i >= missing.length) return;
            const r = await fetchOne(missing[i]);
            if (r) results.push(r);
          }
        });
        await Promise.all(workers);

        if (results.length) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("media_cache").upsert(results, { onConflict: "media_type, tmdb_id" });
          for (const r of results) cacheMap.set(`${r.media_type}:${r.tmdb_id}`, r);
        }
      }
    }

    const items: WatchedLibraryItem[] = [];
    for (const lib of libRows ?? []) {
      const c = cacheMap.get(`${lib.media_type}:${lib.tmdb_id}`);
      if (lib.media_type === "tv") {
        const agg = showAgg.get(lib.tmdb_id);
        items.push({
          media_type: "tv",
          tmdb_id: lib.tmdb_id,
          title: c?.title ?? lib.series_name ?? "Unknown series",
          poster_path: c?.poster_path ?? lib.poster_path ?? null,
          backdrop_path: c?.backdrop_path ?? lib.backdrop_path ?? null,
          vote_average: c?.vote_average ?? lib.vote_average ?? null,
          release_date: c?.release_date ?? lib.first_air_date ?? null,
          genre_ids: c?.genre_ids ?? [],
          watched_at: agg?.last ?? lib.added_at,
          episodes_watched: agg?.count ?? 0,
          series_status: c?.series_status ?? null,
          dropped: lib.status === "dropped",
        });
      } else {
        const wm = movieMap.get(lib.tmdb_id);
        items.push({
          media_type: "movie",
          tmdb_id: lib.tmdb_id,
          title: c?.title ?? wm?.title ?? lib.series_name ?? "Movie",
          poster_path: c?.poster_path ?? lib.poster_path ?? null,
          backdrop_path: c?.backdrop_path ?? lib.backdrop_path ?? null,
          vote_average: c?.vote_average ?? lib.vote_average ?? null,
          release_date: c?.release_date ?? lib.first_air_date ?? null,
          genre_ids: c?.genre_ids ?? [],
          watched_at: wm?.watched_at ?? lib.added_at,
          episodes_watched: null,
          series_status: null,
          dropped: lib.status === "dropped",
        });
      }
    }
    return items;
  });
