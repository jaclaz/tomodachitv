import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";

// ---- Shared TMDB fetch with retry/backoff ----
async function tmdbFetch(
  path: string,
  params: Record<string, string> = {},
): Promise<any | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const q = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  const url = `${TMDB_BASE}${path}?${q}`;
  let backoff = 400;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) {
        const ra = parseInt(r.headers.get("retry-after") ?? "1", 10);
        await new Promise((res) => setTimeout(res, (Number.isFinite(ra) ? ra : 1) * 1000));
        continue;
      }
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`TMDB ${r.status}`);
      return await r.json();
    } catch {
      await new Promise((res) => setTimeout(res, backoff));
      backoff *= 2;
    }
  }
  return null;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

interface ResolvedShow {
  tmdb_id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number | null;
  runtime: number | null;
}
interface ResolvedMovie {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  runtime: number | null;
}

// ---- Resolve shows (accepts a mix of tvdb ids and tmdb ids) ----
export const resolveShowsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: { tvdb_ids?: number[]; tmdb_ids?: number[] }) => i)
  .handler(async ({ data }) => {
    const tvdb = (data.tvdb_ids ?? []).filter((x) => Number.isFinite(x) && x > 0);
    const tmdb = (data.tmdb_ids ?? []).filter((x) => Number.isFinite(x) && x > 0);

    const byTvdb: Record<string, ResolvedShow | null> = {};
    const byTmdb: Record<string, ResolvedShow | null> = {};

    await mapPool(tvdb, 6, async (id) => {
      const d = await tmdbFetch(`/find/${id}`, { external_source: "tvdb_id" });
      const tv = d?.tv_results?.[0];
      if (!tv) {
        byTvdb[id] = null;
        return;
      }
      const details = await tmdbFetch(`/tv/${tv.id}`);
      byTvdb[id] = {
        tmdb_id: tv.id,
        name: tv.name,
        poster_path: tv.poster_path ?? null,
        backdrop_path: tv.backdrop_path ?? null,
        first_air_date: tv.first_air_date ?? null,
        vote_average: tv.vote_average ?? null,
        runtime: details?.episode_run_time?.[0] ?? null,
      };
    });

    await mapPool(tmdb, 6, async (id) => {
      const d = await tmdbFetch(`/tv/${id}`);
      byTmdb[id] = d?.id
        ? {
            tmdb_id: d.id,
            name: d.name,
            poster_path: d.poster_path ?? null,
            backdrop_path: d.backdrop_path ?? null,
            first_air_date: d.first_air_date ?? null,
            vote_average: d.vote_average ?? null,
            runtime: d.episode_run_time?.[0] ?? null,
          }
        : null;
    });

    return { byTvdb, byTmdb };
  });

// ---- Resolve movies ----
interface MovieQuery {
  tmdb_id?: number | null;
  imdb_id?: string | null;
  title?: string | null;
  year?: number | null;
}

export const resolveMoviesBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: { items: MovieQuery[] }) => i)
  .handler(async ({ data }) => {
    const results = await mapPool(data.items, 6, async (m): Promise<ResolvedMovie | null> => {
      if (m.tmdb_id) {
        const d = await tmdbFetch(`/movie/${m.tmdb_id}`);
        if (d?.id) {
          return {
            tmdb_id: d.id,
            title: d.title,
            poster_path: d.poster_path ?? null,
            backdrop_path: d.backdrop_path ?? null,
            release_date: d.release_date ?? null,
            vote_average: d.vote_average ?? null,
            runtime: d.runtime ?? null,
          };
        }
      }
      if (m.imdb_id) {
        const d = await tmdbFetch(`/find/${m.imdb_id}`, { external_source: "imdb_id" });
        const mv = d?.movie_results?.[0];
        if (mv) {
          return {
            tmdb_id: mv.id,
            title: mv.title,
            poster_path: mv.poster_path ?? null,
            backdrop_path: mv.backdrop_path ?? null,
            release_date: mv.release_date ?? null,
            vote_average: mv.vote_average ?? null,
            runtime: null,
          };
        }
      }
      if (m.title) {
        const params: Record<string, string> = { query: m.title };
        if (m.year) params.year = String(m.year);
        const d = await tmdbFetch(`/search/movie`, params);
        const mv = d?.results?.[0];
        if (mv) {
          return {
            tmdb_id: mv.id,
            title: mv.title,
            poster_path: mv.poster_path ?? null,
            backdrop_path: mv.backdrop_path ?? null,
            release_date: mv.release_date ?? null,
            vote_average: mv.vote_average ?? null,
            runtime: null,
          };
        }
      }
      return null;
    });
    return { results };
  });

// ---- Bulk inserts ----
export const bulkInsertEpisodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (i: {
      rows: {
        tmdb_id: number;
        season_number: number;
        episode_number: number;
        runtime_minutes: number | null;
        watched_at: string | null;
      }[];
    }) => i,
  )
  .handler(async ({ context, data }) => {
    if (!data.rows.length) return { inserted: 0 };
    const rows = data.rows.map((r) => ({
      user_id: context.userId,
      tmdb_id: r.tmdb_id,
      season_number: r.season_number,
      episode_number: r.episode_number,
      runtime_minutes: r.runtime_minutes,
      watched_at: r.watched_at ?? new Date().toISOString(),
    }));
    const { error } = await context.supabase
      .from("watched_episodes")
      .upsert(rows, { onConflict: "user_id, tmdb_id, season_number, episode_number" });
    if (error) throw error;
    return { inserted: rows.length };
  });

export const bulkInsertWatchedMovies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (i: {
      rows: {
        tmdb_id: number;
        title: string | null;
        runtime_minutes: number | null;
        watched_at: string | null;
      }[];
    }) => i,
  )
  .handler(async ({ context, data }) => {
    if (!data.rows.length) return { inserted: 0 };
    const rows = data.rows.map((r) => ({
      user_id: context.userId,
      tmdb_id: r.tmdb_id,
      title: r.title,
      runtime_minutes: r.runtime_minutes,
      watched_at: r.watched_at ?? new Date().toISOString(),
    }));
    const { error } = await context.supabase
      .from("watched_movies")
      .upsert(rows, { onConflict: "user_id, tmdb_id" });
    if (error) throw error;
    return { inserted: rows.length };
  });

export const bulkInsertWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (i: {
      rows: {
        tmdb_id: number;
        media_type: "tv" | "movie";
        series_name: string;
        poster_path: string | null;
        backdrop_path: string | null;
        first_air_date: string | null;
        vote_average: number | null;
      }[];
    }) => i,
  )
  .handler(async ({ context, data }) => {
    if (!data.rows.length) return { inserted: 0 };
    const rows = data.rows.map((r) => ({ user_id: context.userId, ...r }));
    const { error } = await context.supabase
      .from("watchlist")
      .upsert(rows, { onConflict: "user_id, media_type, tmdb_id" });
    if (error) throw error;
    return { inserted: rows.length };
  });

// ---- Pending imports (unresolved) ----
export const savePendingImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (i: {
      rows: {
        kind: "watched_episode" | "watched_movie" | "follow_show" | "follow_movie";
        source: "tvdb" | "tmdb" | "imdb" | "name";
        source_id: string;
        title?: string | null;
        year?: number | null;
        season_number?: number | null;
        episode_number?: number | null;
        runtime_minutes?: number | null;
        watched_at?: string | null;
      }[];
    }) => i,
  )
  .handler(async ({ context, data }) => {
    if (!data.rows.length) return { inserted: 0 };
    const rows = data.rows.map((r) => ({
      user_id: context.userId,
      kind: r.kind,
      source: r.source,
      source_id: r.source_id,
      title: r.title ?? null,
      year: r.year ?? null,
      season_number: r.season_number ?? null,
      episode_number: r.episode_number ?? null,
      runtime_minutes: r.runtime_minutes ?? null,
      watched_at: r.watched_at ?? null,
    }));
    const { error } = await (context.supabase as any)
      .from("pending_media_imports")
      .upsert(rows, {
        onConflict: "user_id, kind, source, source_id, season_number, episode_number",
      });
    if (error) throw error;
    return { inserted: rows.length };
  });

export const getPendingImportsCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    return { count: count ?? 0 };
  });

export const retryPendingImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pending, error } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("*")
      .eq("user_id", context.userId)
      .limit(500);
    if (error) throw error;
    if (!pending?.length) return { resolved: 0, remaining: 0 };

    let resolved = 0;
    for (const p of pending) {
      let ok = false;
      try {
        if (p.kind === "follow_show" || p.kind === "watched_episode") {
          let show: ResolvedShow | null = null;
          if (p.source === "tvdb") {
            const d = await tmdbFetch(`/find/${p.source_id}`, { external_source: "tvdb_id" });
            const tv = d?.tv_results?.[0];
            if (tv) {
              const details = await tmdbFetch(`/tv/${tv.id}`);
              show = {
                tmdb_id: tv.id,
                name: tv.name,
                poster_path: tv.poster_path ?? null,
                backdrop_path: tv.backdrop_path ?? null,
                first_air_date: tv.first_air_date ?? null,
                vote_average: tv.vote_average ?? null,
                runtime: details?.episode_run_time?.[0] ?? null,
              };
            }
          } else if (p.source === "tmdb") {
            const d = await tmdbFetch(`/tv/${p.source_id}`);
            if (d?.id)
              show = {
                tmdb_id: d.id,
                name: d.name,
                poster_path: d.poster_path ?? null,
                backdrop_path: d.backdrop_path ?? null,
                first_air_date: d.first_air_date ?? null,
                vote_average: d.vote_average ?? null,
                runtime: d.episode_run_time?.[0] ?? null,
              };
          }
          if (show) {
            await context.supabase.from("watchlist").upsert(
              {
                user_id: context.userId,
                tmdb_id: show.tmdb_id,
                media_type: "tv",
                series_name: show.name,
                poster_path: show.poster_path,
                backdrop_path: show.backdrop_path,
                first_air_date: show.first_air_date,
                vote_average: show.vote_average,
              },
              { onConflict: "user_id, media_type, tmdb_id" },
            );
            if (p.kind === "watched_episode" && p.season_number != null && p.episode_number != null) {
              await context.supabase.from("watched_episodes").upsert(
                {
                  user_id: context.userId,
                  tmdb_id: show.tmdb_id,
                  season_number: p.season_number,
                  episode_number: p.episode_number,
                  runtime_minutes: show.runtime,
                  watched_at: p.watched_at ?? new Date().toISOString(),
                },
                { onConflict: "user_id, tmdb_id, season_number, episode_number" },
              );
            }
            ok = true;
          }
        } else if (p.kind === "watched_movie" || p.kind === "follow_movie") {
          let movie: ResolvedMovie | null = null;
          if (p.source === "tmdb") {
            const d = await tmdbFetch(`/movie/${p.source_id}`);
            if (d?.id)
              movie = {
                tmdb_id: d.id,
                title: d.title,
                poster_path: d.poster_path ?? null,
                backdrop_path: d.backdrop_path ?? null,
                release_date: d.release_date ?? null,
                vote_average: d.vote_average ?? null,
                runtime: d.runtime ?? null,
              };
          } else if (p.source === "imdb") {
            const d = await tmdbFetch(`/find/${p.source_id}`, { external_source: "imdb_id" });
            const mv = d?.movie_results?.[0];
            if (mv)
              movie = {
                tmdb_id: mv.id,
                title: mv.title,
                poster_path: mv.poster_path ?? null,
                backdrop_path: mv.backdrop_path ?? null,
                release_date: mv.release_date ?? null,
                vote_average: mv.vote_average ?? null,
                runtime: null,
              };
          } else if (p.source === "name" && p.title) {
            const params: Record<string, string> = { query: p.title };
            if (p.year) params.year = String(p.year);
            const d = await tmdbFetch(`/search/movie`, params);
            const mv = d?.results?.[0];
            if (mv)
              movie = {
                tmdb_id: mv.id,
                title: mv.title,
                poster_path: mv.poster_path ?? null,
                backdrop_path: mv.backdrop_path ?? null,
                release_date: mv.release_date ?? null,
                vote_average: mv.vote_average ?? null,
                runtime: null,
              };
          }
          if (movie) {
            if (p.kind === "watched_movie") {
              await context.supabase.from("watched_movies").upsert(
                {
                  user_id: context.userId,
                  tmdb_id: movie.tmdb_id,
                  title: movie.title,
                  runtime_minutes: movie.runtime ?? p.runtime_minutes ?? null,
                  watched_at: p.watched_at ?? new Date().toISOString(),
                },
                { onConflict: "user_id, tmdb_id" },
              );
            } else {
              await context.supabase.from("watchlist").upsert(
                {
                  user_id: context.userId,
                  tmdb_id: movie.tmdb_id,
                  media_type: "movie",
                  series_name: movie.title,
                  poster_path: movie.poster_path,
                  backdrop_path: movie.backdrop_path,
                  first_air_date: movie.release_date,
                  vote_average: movie.vote_average,
                },
                { onConflict: "user_id, media_type, tmdb_id" },
              );
            }
            ok = true;
          }
        }
      } catch {
        ok = false;
      }
      if (ok) {
        await (context.supabase as any).from("pending_media_imports").delete().eq("id", p.id);
        resolved++;
      } else {
        await (context.supabase as any)
          .from("pending_media_imports")
          .update({ attempts: (p.attempts ?? 0) + 1 })
          .eq("id", p.id);
      }
    }

    const { count } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    return { resolved, remaining: count ?? 0 };
  });

// ---- Export (unchanged, paginated to bypass 1000-row cap) ----
async function fetchAllPaged<T>(
  fetcher: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const page = 1000;
  let from = 0;
  const out: T[] = [];
  while (true) {
    const { data, error } = await fetcher(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return out;
}

export const exportLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [episodes, movies, watchlist] = await Promise.all([
      fetchAllPaged((f, t) =>
        context.supabase
          .from("watched_episodes")
          .select("tmdb_id, season_number, episode_number, watched_at")
          .eq("user_id", context.userId)
          .range(f, t),
      ),
      fetchAllPaged((f, t) =>
        context.supabase
          .from("watched_movies")
          .select("tmdb_id, title, runtime_minutes, watched_at")
          .eq("user_id", context.userId)
          .range(f, t),
      ),
      fetchAllPaged((f, t) =>
        context.supabase
          .from("watchlist")
          .select(
            "tmdb_id, media_type, series_name, poster_path, backdrop_path, first_air_date, vote_average, added_at",
          )
          .eq("user_id", context.userId)
          .range(f, t),
      ),
    ]);
    return { episodes, movies, watchlist };
  });
