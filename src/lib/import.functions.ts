import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";

// ---- Reset the user's library (all, or only TV, or only movies) ----
export const resetLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const scope = (data as { scope?: string } | undefined)?.scope ?? "all";
    if (scope !== "all" && scope !== "tv" && scope !== "movies") {
      throw new Error("Invalid scope");
    }
    return { scope: scope as "all" | "tv" | "movies" };
  })
  .handler(async ({ context, data }) => {
    const uid = context.userId;
    const sb = context.supabase as any;
    const safeRun = async (p: Promise<{ error: any }>) => {
      const { error } = await p;
      if (error && !String(error.message ?? "").includes("does not exist")) throw error;
    };

    if (data.scope === "all" || data.scope === "tv") {
      await safeRun(sb.from("watched_episodes").delete().eq("user_id", uid));
      await safeRun(sb.from("watchlist").delete().eq("user_id", uid).eq("media_type", "tv"));
      await safeRun(sb.from("favorites").delete().eq("user_id", uid).eq("media_type", "tv"));
      await safeRun(
        sb
          .from("pending_media_imports")
          .delete()
          .eq("user_id", uid)
          .in("kind", ["follow_show", "watched_episode"]),
      );
    }
    if (data.scope === "all" || data.scope === "movies") {
      await safeRun(sb.from("watched_movies").delete().eq("user_id", uid));
      await safeRun(sb.from("watchlist").delete().eq("user_id", uid).eq("media_type", "movie"));
      await safeRun(sb.from("favorites").delete().eq("user_id", uid).eq("media_type", "movie"));
      await safeRun(
        sb
          .from("pending_media_imports")
          .delete()
          .eq("user_id", uid)
          .in("kind", ["follow_movie", "watched_movie"]),
      );
    }
    return { success: true, scope: data.scope };
  });

// ---- Shared TMDB fetch with retry/backoff ----
// On HTTP 429 we wait 5s (or Retry-After) and try again, up to 6 attempts,
// instead of giving up after the first rate-limit hit.
async function tmdbFetch(
  path: string,
  params: Record<string, string> = {},
): Promise<any | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const q = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  const url = `${TMDB_BASE}${path}?${q}`;
  let backoff = 800;
  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) {
        const ra = parseInt(r.headers.get("retry-after") ?? "5", 10);
        const waitMs = (Number.isFinite(ra) && ra > 0 ? ra : 5) * 1000;
        await new Promise((res) => setTimeout(res, waitMs));
        continue;
      }
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`TMDB ${r.status}`);
      return await r.json();
    } catch {
      await new Promise((res) => setTimeout(res, backoff));
      backoff = Math.min(backoff * 2, 8000);
    }
  }
  return null;
}

// Concurrency-limited async map. Kept intentionally low (default 2) to avoid
// saturating TMDB's per-IP rate limit from a single server worker.
async function mapPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        results[idx] = await fn(items[idx]);
      } catch {
        results[idx] = null as R;
      }
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

    await mapPool(tvdb, 2, async (id) => {
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

    await mapPool(tmdb, 2, async (id) => {
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
    const results = await mapPool(data.items, 2, async (m): Promise<ResolvedMovie | null> => {
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
    const dedup = new Map<string, any>();
    for (const r of data.rows) {
      const key = `${r.tmdb_id}:${r.season_number}:${r.episode_number}`;
      const row = {
        user_id: context.userId,
        tmdb_id: r.tmdb_id,
        season_number: r.season_number,
        episode_number: r.episode_number,
        runtime_minutes: r.runtime_minutes,
        watched_at: r.watched_at ?? new Date().toISOString(),
      };
      const prev = dedup.get(key);
      if (!prev || row.watched_at > prev.watched_at) dedup.set(key, row);
    }
    const rows = Array.from(dedup.values());
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
    const dedup = new Map<number, any>();
    for (const r of data.rows) {
      const row = {
        user_id: context.userId,
        tmdb_id: r.tmdb_id,
        title: r.title,
        runtime_minutes: r.runtime_minutes,
        watched_at: r.watched_at ?? new Date().toISOString(),
      };
      const prev = dedup.get(r.tmdb_id);
      if (!prev || row.watched_at > prev.watched_at) dedup.set(r.tmdb_id, row);
    }
    const rows = Array.from(dedup.values());
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
        status?: "planned" | "watching" | "completed" | "dropped";
      }[];
    }) => i,
  )
  .handler(async ({ context, data }) => {
    if (!data.rows.length) return { inserted: 0 };
    const dedup = new Map<string, any>();
    for (const r of data.rows) {
      dedup.set(`${r.media_type}:${r.tmdb_id}`, { user_id: context.userId, ...r });
    }
    const rows = Array.from(dedup.values());
    const { error } = await context.supabase
      .from("watchlist")
      .upsert(rows, { onConflict: "user_id, media_type, tmdb_id" });
    if (error) throw error;
    return { inserted: rows.length };

  });

// Reconcile the library (`watchlist` table) with what has actually been watched:
// - Movie in watched_movies                       → library row with status "completed"
// - TV show with watched >= AIRED episodes so far → status "completed"
// - TV show with 1..aired-1 episodes watched      → status "watching"
// - Rows already marked "dropped" are never touched.
// Missing library rows are created (with TMDB metadata) so imported items show up
// in Watched / Library instead of only existing as raw watch records.
export const cleanupWatchedFromWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const PAGE = 1000;

    // Movies fully watched
    const watchedMovies = new Map<number, string | null>();
    {
      let from = 0;
      while (true) {
        const { data, error } = await context.supabase
          .from("watched_movies")
          .select("tmdb_id, title")
          .eq("user_id", context.userId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data ?? [];
        for (const r of chunk) watchedMovies.set(r.tmdb_id, r.title ?? null);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
    }

    // Count watched episodes per show
    const watchedPerShow = new Map<number, number>();
    {
      let from = 0;
      while (true) {
        const { data, error } = await context.supabase
          .from("watched_episodes")
          .select("tmdb_id, season_number")
          .eq("user_id", context.userId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data ?? [];
        for (const r of chunk) {
          if ((r.season_number ?? 0) <= 0) continue;
          watchedPerShow.set(r.tmdb_id, (watchedPerShow.get(r.tmdb_id) ?? 0) + 1);
        }
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
    }

    // Existing library rows
    const existing = new Map<string, { status: string | null }>();
    {
      let from = 0;
      while (true) {
        const { data, error } = await context.supabase
          .from("watchlist")
          .select("tmdb_id, media_type, status")
          .eq("user_id", context.userId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data ?? [];
        for (const r of chunk)
          existing.set(`${r.media_type}:${r.tmdb_id}`, { status: r.status ?? null });
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const toInsert: {
      user_id: string;
      tmdb_id: number;
      media_type: string;
      series_name: string;
      poster_path: string | null;
      backdrop_path: string | null;
      first_air_date: string | null;
      vote_average: number | null;
      status: string;
    }[] = [];
    const setCompleted: { tv: number[]; movie: number[] } = { tv: [], movie: [] };
    const setWatching: number[] = [];

    // ---- Movies ----
    const movieIds = [...watchedMovies.keys()];
    await mapPool(movieIds, 4, async (id) => {
      const cur = existing.get(`movie:${id}`);
      if (cur) {
        if (cur.status === "dropped" || cur.status === "completed") return;
        setCompleted.movie.push(id);
        return;
      }
      let d: any = null;
      try {
        d = await tmdbFetch(`/movie/${id}`);
      } catch {
        d = null;
      }
      toInsert.push({
        user_id: context.userId,
        tmdb_id: id,
        media_type: "movie",
        series_name: d?.title ?? watchedMovies.get(id) ?? "Movie",
        poster_path: d?.poster_path ?? null,
        backdrop_path: d?.backdrop_path ?? null,
        first_air_date: d?.release_date ?? null,
        vote_average: d?.vote_average ?? null,
        status: "completed",
      });
    });

    // ---- TV shows ----
    let inProgress = 0;
    const showIds = [...watchedPerShow.keys()];
    await mapPool(showIds, 2, async (id) => {
      const watched = watchedPerShow.get(id) ?? 0;
      if (watched === 0) return;
      const cur = existing.get(`tv:${id}`);
      if (cur?.status === "dropped") return;

      let details: any = null;
      try {
        details = await tmdbFetch(`/tv/${id}`);
      } catch {
        details = null;
      }
      let aired = 0;
      const seasons: { season_number: number; episode_count: number; air_date: string | null }[] =
        details?.seasons ?? [];
      for (const s of seasons) {
        if (s.season_number <= 0) continue;
        if (s.air_date && s.air_date > today) continue;
        try {
          const season = await tmdbFetch(`/tv/${id}/season/${s.season_number}`);
          const eps: { air_date: string | null }[] = season.episodes ?? [];
          for (const e of eps) {
            if (e.air_date && e.air_date <= today) aired++;
          }
        } catch {
          aired += s.episode_count ?? 0;
        }
      }

      const desired = aired > 0 && watched >= aired ? "completed" : "watching";
      if (desired === "watching") inProgress++;

      if (!cur) {
        toInsert.push({
          user_id: context.userId,
          tmdb_id: id,
          media_type: "tv",
          series_name: details?.name ?? "Unknown series",
          poster_path: details?.poster_path ?? null,
          backdrop_path: details?.backdrop_path ?? null,
          first_air_date: details?.first_air_date ?? null,
          vote_average: details?.vote_average ?? null,
          status: desired,
        });
        return;
      }
      if (cur.status === desired) return;
      if (desired === "completed") setCompleted.tv.push(id);
      else setWatching.push(id);
    });

    const CHUNK = 200;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { error } = await context.supabase
        .from("watchlist")
        .upsert(toInsert.slice(i, i + CHUNK), { onConflict: "user_id, media_type, tmdb_id" });
      if (error) throw error;
    }
    const applyStatus = async (media_type: "tv" | "movie", ids: number[], status: string) => {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await context.supabase
          .from("watchlist")
          .update({ status })
          .eq("user_id", context.userId)
          .eq("media_type", media_type)
          .in("tmdb_id", ids.slice(i, i + CHUNK));
        if (error) throw error;
      }
    };
    await applyStatus("movie", setCompleted.movie, "completed");
    await applyStatus("tv", setCompleted.tv, "completed");
    await applyStatus("tv", setWatching, "watching");

    return {
      completedMovies: setCompleted.movie.length,
      completedShows: setCompleted.tv.length,
      created: toInsert.length,
      inProgress,
    };
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
    const dedup = new Map<string, any>();
    for (const r of data.rows) {
      if (!r || !r.kind || !r.source || !r.source_id) continue;
      const season = r.season_number ?? -1;
      const episode = r.episode_number ?? -1;
      const key = `${r.kind}:${r.source}:${r.source_id}:${season}:${episode}`;
      dedup.set(key, {
        user_id: context.userId,
        kind: r.kind,
        source: r.source,
        source_id: r.source_id,
        title: r.title ?? null,
        year: r.year ?? null,
        season_number: season,
        episode_number: episode,
        runtime_minutes: r.runtime_minutes ?? null,
        watched_at: r.watched_at ?? null,
      });
    }
    const rows = Array.from(dedup.values());
    if (!rows.length) return { inserted: 0 };
    const { error } = await (context.supabase as any)
      .from("pending_media_imports")
      .upsert(rows, {
        onConflict: "user_id, kind, source, source_id, season_number, episode_number",
      });
    if (error) throw error;
    return { inserted: rows.length };
  });

// Items that failed this many times are considered unmatchable (dead-letter):
// they stay visible to the user but no longer block the queue.
const MAX_IMPORT_ATTEMPTS = 6;

export const getPendingImportsCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .lt("attempts", MAX_IMPORT_ATTEMPTS);
    const { count: failed } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("attempts", MAX_IMPORT_ATTEMPTS);
    return { count: count ?? 0, failed: failed ?? 0 };
  });

export const retryPendingImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pending, error } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("*")
      .eq("user_id", context.userId)
      .lt("attempts", MAX_IMPORT_ATTEMPTS)
      // Fair queue: least-tried first, so a handful of unmatchable rows can
      // never block the head of the queue forever.
      .order("attempts", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    if (!pending?.length) return { resolved: 0, skipped: 0, remaining: 0 };

    const dedupedPending = new Map<string, any>();
    const duplicateIds: string[] = [];
    for (const p of pending) {
      if (!p?.id || !p.kind || !p.source || !p.source_id) {
        if (p?.id) duplicateIds.push(p.id);
        continue;
      }
      const key = `${p.kind}:${p.source}:${p.source_id}:${p.season_number ?? -1}:${p.episode_number ?? -1}`;
      if (dedupedPending.has(key)) duplicateIds.push(p.id);
      else dedupedPending.set(key, p);
    }

    for (let i = 0; i < duplicateIds.length; i += 100) {
      const ids = duplicateIds.slice(i, i + 100);
      try {
        await (context.supabase as any).from("pending_media_imports").delete().in("id", ids);
      } catch {
        // A duplicate purge failure must not stop the active resolution batch.
      }
    }

    // One TMDB lookup per distinct source id, reused by every episode of the
    // same show in this batch (hundreds of episodes = one request).
    const showCache = new Map<string, ResolvedShow | null>();
    const resolveShow = async (source: string, sourceId: string): Promise<ResolvedShow | null> => {
      const key = `${source}:${sourceId}`;
      if (showCache.has(key)) return showCache.get(key) ?? null;
      let show: ResolvedShow | null = null;
      if (source === "tvdb") {
        const d = await tmdbFetch(`/find/${sourceId}`, { external_source: "tvdb_id" });
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
      } else if (source === "tmdb") {
        const d = await tmdbFetch(`/tv/${sourceId}`);
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
      showCache.set(key, show);
      return show;
    };

    let resolved = 0;
    let skipped = duplicateIds.length;
    for (const p of dedupedPending.values()) {

      let ok = false;
      let lastError: string | null = null;
      try {
        if (p.kind === "follow_show" || p.kind === "watched_episode") {
          const show = await resolveShow(p.source, String(p.source_id));
          if (!show) lastError = `No TMDB match for ${p.source} id ${p.source_id}`;

          if (show) {
            const { error: watchlistError } = await context.supabase.from("watchlist").upsert(
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
            if (watchlistError) throw watchlistError;
            if (p.kind === "watched_episode" && p.season_number != null && p.episode_number != null) {
              const { error: watchedEpisodeError } = await context.supabase.from("watched_episodes").upsert(
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
              if (watchedEpisodeError) throw watchedEpisodeError;
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
            let d = await tmdbFetch(`/search/movie`, params);
            let mv = d?.results?.[0];
            if (!mv && p.year) {
              // Release-year mismatches are common in exports: retry untargeted.
              d = await tmdbFetch(`/search/movie`, { query: p.title });
              mv = d?.results?.[0];
            }
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
          if (!movie) lastError = `No TMDB match for ${p.source} "${p.title ?? p.source_id}"`;
          if (movie) {

            if (p.kind === "watched_movie") {
              const { error: watchedMovieError } = await context.supabase.from("watched_movies").upsert(
                {
                  user_id: context.userId,
                  tmdb_id: movie.tmdb_id,
                  title: movie.title,
                  runtime_minutes: movie.runtime ?? p.runtime_minutes ?? null,
                  watched_at: p.watched_at ?? new Date().toISOString(),
                },
                { onConflict: "user_id, tmdb_id" },
              );
              if (watchedMovieError) throw watchedMovieError;
              // Keep the library in sync: a watched movie belongs in Watched.
              const { error: seenLibError } = await context.supabase.from("watchlist").upsert(
                {
                  user_id: context.userId,
                  tmdb_id: movie.tmdb_id,
                  media_type: "movie",
                  series_name: movie.title,
                  poster_path: movie.poster_path,
                  backdrop_path: movie.backdrop_path,
                  first_air_date: movie.release_date,
                  vote_average: movie.vote_average,
                  status: "completed",
                },
                { onConflict: "user_id, media_type, tmdb_id" },
              );
              if (seenLibError) throw seenLibError;
            } else {
              const { error: movieWatchlistError } = await context.supabase.from("watchlist").upsert(
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
              if (movieWatchlistError) throw movieWatchlistError;
            }
            ok = true;
          }
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Unexpected pending import error";
        ok = false;
      }
      try {
        if (ok) {
          await (context.supabase as any).from("pending_media_imports").delete().eq("id", p.id);
          resolved++;
        } else {
          await (context.supabase as any)
            .from("pending_media_imports")
            .update({
              attempts: (p.attempts ?? 0) + 1,
              last_error: lastError,
              updated_at: new Date().toISOString(),
            })
            .eq("id", p.id);
        }
      } catch {
        skipped++;
      }
    }

    // A show id TMDB simply doesn't know will never resolve: retire every one
    // of its episodes at once instead of retrying them hundreds of times.
    for (const [key, show] of showCache) {
      if (show) continue;
      const [source, sourceId] = key.split(":");
      try {
        await (context.supabase as any)
          .from("pending_media_imports")
          .update({
            attempts: MAX_IMPORT_ATTEMPTS,
            last_error: `No TMDB match for ${source} id ${sourceId}`,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", context.userId)
          .eq("source", source)
          .eq("source_id", sourceId)
          .lt("attempts", MAX_IMPORT_ATTEMPTS);
      } catch {
        // Best effort: the fair queue keeps things moving regardless.
      }
    }

    const { count } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .lt("attempts", MAX_IMPORT_ATTEMPTS);

    return { resolved, skipped, remaining: count ?? 0 };

  });

// ---- Dead-letter management (items TMDB could not match) ----
export const listFailedImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("pending_media_imports")
      .select("kind, source, source_id, title, year, last_error")
      .eq("user_id", context.userId)
      .gte("attempts", MAX_IMPORT_ATTEMPTS)
      .limit(2000);
    if (error) throw error;
    const rows = data ?? [];
    // Episode rows carry no title; the sibling "follow" row of the same
    // source id does, so reuse it to label the group.
    const titleBySource = new Map<string, string>();
    for (const r of rows) {
      if (r.title) titleBySource.set(`${r.source}:${r.source_id}`, r.title);
    }
    const grouped = new Map<
      string,
      { kind: string; source: string; source_id: string; title: string | null; year: number | null; last_error: string | null; items: number }
    >();
    for (const r of rows) {
      const key = `${r.kind}:${r.source}:${r.source_id}`;
      const existing = grouped.get(key);
      if (existing) existing.items++;
      else
        grouped.set(key, {
          ...r,
          title: r.title ?? titleBySource.get(`${r.source}:${r.source_id}`) ?? null,
          items: 1,
        });
    }
    return Array.from(grouped.values()).sort((a, b) => b.items - a.items);
  });


export const requeueFailedImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as any)
      .from("pending_media_imports")
      .update({ attempts: 0, last_error: null, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .gte("attempts", MAX_IMPORT_ATTEMPTS);
    if (error) throw error;
    return { ok: true };
  });

export const discardFailedImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as any)
      .from("pending_media_imports")
      .delete()
      .eq("user_id", context.userId)
      .gte("attempts", MAX_IMPORT_ATTEMPTS);
    if (error) throw error;
    return { ok: true };
  });

// Discard a single unmatched group (all rows sharing kind/source/source_id).
export const discardFailedGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind: string; source: string; source_id: string }) => i)
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as any)
      .from("pending_media_imports")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("source", data.source)
      .eq("source_id", data.source_id);
    if (error) throw error;
    return { ok: true };
  });

// Search TMDB so the user can manually pick the right title for a dead-letter item.
export const searchTmdbForImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { query: string; mediaType: "tv" | "movie" }) => i)
  .handler(async ({ data }) => {
    const query = (data.query ?? "").trim();
    if (!query) return [];
    const d = await tmdbFetch(`/search/${data.mediaType}`, { query });
    return (d?.results ?? []).slice(0, 8).map((r: any) => ({
      id: r.id as number,
      title: (r.name ?? r.title ?? "Untitled") as string,
      year: ((r.first_air_date ?? r.release_date ?? "") as string).slice(0, 4) || null,
      poster_path: (r.poster_path ?? null) as string | null,
      overview: (r.overview ?? "") as string,
    }));
  });

// Manually link an unmatched group to a TMDB id and import all of its rows.
export const resolveFailedManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind: string; source: string; source_id: string; tmdbId: number }) => i)
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("pending_media_imports")
      .select("*")
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("source", data.source)
      .eq("source_id", data.source_id)
      .limit(2000);
    if (error) throw error;
    if (!rows?.length) return { imported: 0 };

    const isTv = data.kind === "follow_show" || data.kind === "watched_episode";
    let imported = 0;

    if (isTv) {
      const d = await tmdbFetch(`/tv/${data.tmdbId}`);
      if (!d?.id) throw new Error("TMDB series not found");
      const runtime = d.episode_run_time?.[0] ?? null;
      const { error: wlError } = await context.supabase.from("watchlist").upsert(
        {
          user_id: context.userId,
          tmdb_id: d.id,
          media_type: "tv",
          series_name: d.name,
          poster_path: d.poster_path ?? null,
          backdrop_path: d.backdrop_path ?? null,
          first_air_date: d.first_air_date ?? null,
          vote_average: d.vote_average ?? null,
        },
        { onConflict: "user_id, media_type, tmdb_id" },
      );
      if (wlError) throw wlError;

      const episodes = rows
        .filter((r: any) => r.kind === "watched_episode" && r.season_number >= 0 && r.episode_number >= 0)
        .map((r: any) => ({
          user_id: context.userId,
          tmdb_id: d.id,
          season_number: r.season_number,
          episode_number: r.episode_number,
          runtime_minutes: r.runtime_minutes ?? runtime,
          watched_at: r.watched_at ?? new Date().toISOString(),
        }));
      for (let i = 0; i < episodes.length; i += 200) {
        const { error: epError } = await context.supabase
          .from("watched_episodes")
          .upsert(episodes.slice(i, i + 200), {
            onConflict: "user_id, tmdb_id, season_number, episode_number",
          });
        if (epError) throw epError;
      }
      imported = episodes.length || 1;
    } else {
      const d = await tmdbFetch(`/movie/${data.tmdbId}`);
      if (!d?.id) throw new Error("TMDB movie not found");
      if (data.kind === "watched_movie") {
        const { error: mvError } = await context.supabase.from("watched_movies").upsert(
          {
            user_id: context.userId,
            tmdb_id: d.id,
            title: d.title,
            runtime_minutes: d.runtime ?? null,
            watched_at: rows[0]?.watched_at ?? new Date().toISOString(),
          },
          { onConflict: "user_id, tmdb_id" },
        );
        if (mvError) throw mvError;
        const { error: mvLibError } = await context.supabase.from("watchlist").upsert(
          {
            user_id: context.userId,
            tmdb_id: d.id,
            media_type: "movie",
            series_name: d.title,
            poster_path: d.poster_path ?? null,
            backdrop_path: d.backdrop_path ?? null,
            first_air_date: d.release_date ?? null,
            vote_average: d.vote_average ?? null,
            status: "completed",
          },
          { onConflict: "user_id, media_type, tmdb_id" },
        );
        if (mvLibError) throw mvLibError;
      } else {
        const { error: mwError } = await context.supabase.from("watchlist").upsert(
          {
            user_id: context.userId,
            tmdb_id: d.id,
            media_type: "movie",
            series_name: d.title,
            poster_path: d.poster_path ?? null,
            backdrop_path: d.backdrop_path ?? null,
            first_air_date: d.release_date ?? null,
            vote_average: d.vote_average ?? null,
          },
          { onConflict: "user_id, media_type, tmdb_id" },
        );
        if (mwError) throw mwError;
      }
      imported = 1;
    }

    await sb
      .from("pending_media_imports")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("source", data.source)
      .eq("source_id", data.source_id);

    return { imported };
  });


// ---- Export (paginated to bypass 1000-row cap) ----
export const exportLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const PAGE = 1000;
    const fetchAll = async <T>(
      run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
    ): Promise<T[]> => {
      let from = 0;
      const out: T[] = [];
      while (true) {
        const { data, error } = await run(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data ?? [];
        out.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return out;
    };

    const [episodes, movies, watchlist] = await Promise.all([
      fetchAll<{
        tmdb_id: number;
        season_number: number;
        episode_number: number;
        watched_at: string;
      }>((f, t) =>
        context.supabase
          .from("watched_episodes")
          .select("tmdb_id, season_number, episode_number, watched_at")
          .eq("user_id", context.userId)
          .range(f, t),
      ),
      fetchAll<{
        tmdb_id: number;
        title: string | null;
        runtime_minutes: number | null;
        watched_at: string;
      }>((f, t) =>
        context.supabase
          .from("watched_movies")
          .select("tmdb_id, title, runtime_minutes, watched_at")
          .eq("user_id", context.userId)
          .range(f, t),
      ),
      fetchAll<{
        tmdb_id: number;
        media_type: string;
        series_name: string;
        poster_path: string | null;
        backdrop_path: string | null;
        first_air_date: string | null;
        vote_average: number | null;
        added_at: string;
      }>((f, t) =>
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

// ---- Full list of everything currently in the user's library ----
export interface ImportedLibraryEntry {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  status: string;
}

export const listImportedLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const PAGE = 1000;
    const fetchAll = async <T>(
      run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
    ): Promise<T[]> => {
      let from = 0;
      const out: T[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await run(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data ?? [];
        out.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return out;
    };

    const [watchlist, movies, episodes] = await Promise.all([
      fetchAll<{
        tmdb_id: number;
        media_type: string;
        series_name: string;
        poster_path: string | null;
        status: string | null;
      }>((f, t) =>
        context.supabase
          .from("watchlist")
          .select("tmdb_id, media_type, series_name, poster_path, status")
          .eq("user_id", context.userId)
          .range(f, t),
      ),
      fetchAll<{ tmdb_id: number; title: string | null }>((f, t) =>
        context.supabase
          .from("watched_movies")
          .select("tmdb_id, title")
          .eq("user_id", context.userId)
          .range(f, t),
      ),
      fetchAll<{ tmdb_id: number }>((f, t) =>
        context.supabase
          .from("watched_episodes")
          .select("tmdb_id")
          .eq("user_id", context.userId)
          .range(f, t),
      ),
    ]);

    const startedShows = new Set(episodes.map((e) => e.tmdb_id));
    const toWatchTv: ImportedLibraryEntry[] = [];
    const watchingTv: ImportedLibraryEntry[] = [];
    const completedTv: ImportedLibraryEntry[] = [];
    const droppedTv: ImportedLibraryEntry[] = [];
    const toWatchMovies: ImportedLibraryEntry[] = [];

    for (const w of watchlist) {
      const entry: ImportedLibraryEntry = {
        tmdb_id: w.tmdb_id,
        media_type: w.media_type === "movie" ? "movie" : "tv",
        title: w.series_name,
        poster_path: w.poster_path,
        status: w.status ?? "watching",
      };
      if (entry.media_type === "movie") {
        toWatchMovies.push(entry);
        continue;
      }
      if (entry.status === "dropped") droppedTv.push(entry);
      else if (entry.status === "completed") completedTv.push(entry);
      else if (startedShows.has(entry.tmdb_id)) watchingTv.push(entry);
      else toWatchTv.push(entry);
    }

    const watchedMovies: ImportedLibraryEntry[] = movies.map((m) => ({
      tmdb_id: m.tmdb_id,
      media_type: "movie" as const,
      title: m.title ?? `Movie #${m.tmdb_id}`,
      poster_path: null,
      status: "watched",
    }));

    const byTitle = (a: ImportedLibraryEntry, b: ImportedLibraryEntry) =>
      a.title.localeCompare(b.title);

    return {
      toWatchTv: toWatchTv.sort(byTitle),
      watchingTv: watchingTv.sort(byTitle),
      completedTv: completedTv.sort(byTitle),
      droppedTv: droppedTv.sort(byTitle),
      toWatchMovies: toWatchMovies
        .filter((m) => !movies.some((w) => w.tmdb_id === m.tmdb_id))
        .sort(byTitle),
      watchedMovies: watchedMovies.sort(byTitle),
    };
  });
