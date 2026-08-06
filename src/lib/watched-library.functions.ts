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
      .select(
        "tmdb_id, media_type, series_name, poster_path, backdrop_path, first_air_date, vote_average, status, added_at",
      )
      .eq("user_id", context.userId)
      .in("status", ["completed", "dropped"]);
    if (libErr) throw libErr;

    const tvIds = (libRows ?? []).filter((r) => r.media_type === "tv").map((r) => r.tmdb_id);
    const movieIds = (libRows ?? []).filter((r) => r.media_type === "movie").map((r) => r.tmdb_id);

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
    for (const m of movies ?? [])
      movieMap.set(m.tmdb_id, { title: m.title, watched_at: m.watched_at });

    // Load media_cache
    const [cachedShowsRes, cachedMoviesRes] = await Promise.all([
      tvIds.length
        ? context.supabase
            .from("media_cache")
            .select("*")
            .eq("media_type", "tv")
            .in("tmdb_id", tvIds)
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
    for (const r of (cachedShowsRes.data ?? []) as any[]) cacheMap.set(`tv:${r.tmdb_id}`, r);
    for (const r of (cachedMoviesRes.data ?? []) as any[]) cacheMap.set(`movie:${r.tmdb_id}`, r);

    const needsRefetch = (r: { media_type: string; tmdb_id: number }) => {
      const cached = cacheMap.get(`${r.media_type}:${r.tmdb_id}`);
      if (!cached) return true;
      if (
        r.media_type === "tv" &&
        (cached.episode_count_aired == null || cached.series_status == null)
      )
        return true;
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
            let releasedCount: number | null = null;
            if (k.media_type === "tv") {
              const today = new Date().toISOString().slice(0, 10);
              const last = d.last_episode_to_air as
                | { season_number: number; episode_number: number; air_date?: string | null }
                | null;
              const seasons = (d.seasons ?? []).filter(
                (s: { season_number: number }) => s.season_number > 0,
              );
              if (last && (!last.air_date || last.air_date <= today)) {
                let total = 0;
                for (const s of seasons) {
                  const ec = s.episode_count ?? 0;
                  if (s.season_number < last.season_number) total += ec;
                  else if (s.season_number === last.season_number)
                    total += Math.min(last.episode_number, ec || last.episode_number);
                }
                releasedCount = total;
              } else {
                releasedCount = d.number_of_episodes ?? null;
              }
            }
            return {
              media_type: k.media_type,
              tmdb_id: k.tmdb_id,
              title: k.media_type === "tv" ? d.name : d.title,
              poster_path: d.poster_path ?? null,
              backdrop_path: d.backdrop_path ?? null,
              vote_average: d.vote_average ?? null,
              release_date: (k.media_type === "tv" ? d.first_air_date : d.release_date) || null,
              genre_ids: (d.genres ?? []).map((g: any) => g.id),
              episode_count_aired: releasedCount,
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
          await supabaseAdmin
            .from("media_cache")
            .upsert(results, { onConflict: "media_type, tmdb_id" });
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
  }
}

export const getWatchedLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    ({ context }): Promise<WatchedLibraryItem[]> =>
      buildWatchedLibrary(context.supabase, context.userId),
  );

export const getUserWatchedLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(
    ({ context, data }): Promise<WatchedLibraryItem[]> =>
      buildWatchedLibrary(context.supabase, data.user_id),
  );

// ---------- Recently watched TV shows (profile) ----------

export interface RecentlyWatchedShow {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  episodes_watched: number;
  last_watched_at: string;
}

async function buildRecentlyWatchedShows(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  limit = 20,
): Promise<RecentlyWatchedShow[]> {
  // Paginated fetch: Supabase caps rows at 1000 per request.
  const PAGE = 1000;
  const agg = new Map<number, { count: number; last: string }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("watched_episodes")
      .select("tmdb_id, watched_at")
      .eq("user_id", userId)
      .order("watched_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) {
      const cur = agg.get(r.tmdb_id);
      if (!cur) agg.set(r.tmdb_id, { count: 1, last: r.watched_at });
      else {
        cur.count += 1;
        if (r.watched_at > cur.last) cur.last = r.watched_at;
      }
    }
    if (rows.length < PAGE) break;
  }
  if (agg.size === 0) return [];

  const ordered = [...agg.entries()]
    .sort((a, b) => b[1].last.localeCompare(a[1].last))
    .slice(0, limit);
  const ids = ordered.map(([id]) => id);

  const [cacheRes, libRes] = await Promise.all([
    supabase
      .from("media_cache")
      .select("tmdb_id, title, poster_path")
      .eq("media_type", "tv")
      .in("tmdb_id", ids),
    supabase
      .from("watchlist")
      .select("tmdb_id, series_name, poster_path")
      .eq("user_id", userId)
      .eq("media_type", "tv")
      .in("tmdb_id", ids),
  ]);
  const cacheMap = new Map<number, { title: string | null; poster_path: string | null }>();
  for (const r of (cacheRes.data ?? []) as any[])
    cacheMap.set(r.tmdb_id, { title: r.title, poster_path: r.poster_path });
  const libMap = new Map<number, { title: string | null; poster_path: string | null }>();
  for (const r of (libRes.data ?? []) as any[])
    libMap.set(r.tmdb_id, { title: r.series_name, poster_path: r.poster_path });

  return ordered.map(([tmdb_id, v]) => {
    const c = cacheMap.get(tmdb_id);
    const l = libMap.get(tmdb_id);
    return {
      tmdb_id,
      title: c?.title ?? l?.title ?? "Unknown series",
      poster_path: c?.poster_path ?? l?.poster_path ?? null,
      episodes_watched: v.count,
      last_watched_at: v.last,
    };
  });
}

export const getRecentlyWatchedShows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    ({ context }): Promise<RecentlyWatchedShow[]> =>
      buildRecentlyWatchedShows(context.supabase, context.userId),
  );

export const getUserRecentlyWatchedShows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(
    ({ context, data }): Promise<RecentlyWatchedShow[]> =>
      buildRecentlyWatchedShows(context.supabase, data.user_id),
  );
