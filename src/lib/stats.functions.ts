import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdbFetch<T>(path: string): Promise<T> {
  const key = getApiKey();
  const url = `${TMDB_BASE}${path}?api_key=${key}&language=en-US`;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 1);
        await sleep(Math.min(5000, (Number.isFinite(retryAfter) ? retryAfter : 1) * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error("TMDB request failed");
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch {
        // swallow individual failures
        results[idx] = undefined as unknown as R;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export interface AdvancedStats {
  // Tastes
  genres: { name: string; count: number; minutes: number }[];
  decades: { decade: string; count: number }[];
  avgRating: number | null;
  ratedCount: number;
  // Habits
  minutesLast7: number;
  minutesLast30: number;
  minutesLast90: number;
  weekdayMinutes: { day: string; minutes: number }[];
  busiestWeekday: string | null;
  // Progress
  topSeriesByEpisodes: { tmdb_id: number; title: string; episodes: number }[];
  seriesInProgress: {
    tmdb_id: number;
    title: string;
    watched: number;
    total: number;
    percent: number;
    last_watched_at: string;
  }[];
  seasonsCompleted: number;
  tvMinutes: number;
  movieMinutes: number;
  totalMinutes: number;
  // Meta
  seriesTracked: number;
  unresolvedTitles: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TvRaw {
  id: number;
  name: string;
  first_air_date?: string;
  vote_average?: number;
  number_of_episodes?: number;
  genres?: { id: number; name: string }[];
  episode_run_time?: number[];
  seasons?: { season_number: number; episode_count: number }[];
  last_episode_to_air?: { season_number: number; episode_number: number } | null;
}
interface MovieRaw {
  id: number;
  title: string;
  release_date?: string;
  vote_average?: number;
  runtime?: number | null;
  genres?: { id: number; name: string }[];
}

interface WatchedEpisodeRow {
  tmdb_id: number;
  season_number: number;
  episode_number: number;
  runtime_minutes: number | null;
  watched_at: string | null;
}
interface WatchedMovieRow {
  tmdb_id: number;
  runtime_minutes: number | null;
  watched_at: string | null;
}

const PAGE = 1000;

export const getAdvancedStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvancedStats> => {
    // ---- Load full history (paginated: the API caps a single read at 1000 rows) ----
    const rawEps: WatchedEpisodeRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await context.supabase
        .from("watched_episodes")
        .select("tmdb_id, season_number, episode_number, runtime_minutes, watched_at")
        .eq("user_id", context.userId)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rawEps.push(...((data ?? []) as WatchedEpisodeRow[]));
      if (!data || data.length < PAGE) break;
    }

    const rawMovies: WatchedMovieRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await context.supabase
        .from("watched_movies")
        .select("tmdb_id, runtime_minutes, watched_at")
        .eq("user_id", context.userId)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rawMovies.push(...((data ?? []) as WatchedMovieRow[]));
      if (!data || data.length < PAGE) break;
    }

    // Rewatches count again toward totals, habits and most-watched shows.
    interface RewatchRow {
      media_type: string;
      tmdb_id: number;
      episodes_count: number | null;
      minutes: number | null;
      created_at: string | null;
    }
    const rewatches: RewatchRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await context.supabase
        .from("rewatches")
        .select("media_type, tmdb_id, episodes_count, minutes, created_at")
        .eq("user_id", context.userId)
        .range(from, from + PAGE - 1);
      if (error) break;
      rewatches.push(...((data ?? []) as RewatchRow[]));
      if (!data || data.length < PAGE) break;
    }


    // Dedupe episodes by (series, season, episode) and movies by tmdb_id.
    const epSeen = new Set<string>();
    const eps = rawEps.filter((e) => {
      const k = `${e.tmdb_id}-${e.season_number}-${e.episode_number}`;
      if (epSeen.has(k)) return false;
      epSeen.add(k);
      return true;
    });
    const mvSeen = new Set<number>();
    const movies = rawMovies.filter((m) => {
      if (mvSeen.has(m.tmdb_id)) return false;
      mvSeen.add(m.tmdb_id);
      return true;
    });

    const tvIds = Array.from(new Set(eps.map((e) => e.tmdb_id)));
    const movieIds = Array.from(new Set(movies.map((m) => m.tmdb_id)));

    // ---- Dropped shows are excluded from "in progress" ----
    const { data: droppedRows } = await context.supabase
      .from("watchlist")
      .select("tmdb_id")
      .eq("user_id", context.userId)
      .eq("media_type", "tv")
      .eq("status", "dropped");
    const droppedIds = new Set<number>((droppedRows ?? []).map((r) => r.tmdb_id));

    // ---- Cached metadata first, TMDB only for what's missing ----
    const cacheRows: Array<{
      media_type: string;
      tmdb_id: number;
      title: string | null;
      vote_average: number | null;
      release_date: string | null;
      genre_ids: number[];
      episode_count_aired: number | null;
    }> = [];
    const allIds = [
      ...tvIds.map((id) => ({ media_type: "tv", tmdb_id: id })),
      ...movieIds.map((id) => ({ media_type: "movie", tmdb_id: id })),
    ];
    for (const type of ["tv", "movie"] as const) {
      const ids = type === "tv" ? tvIds : movieIds;
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await context.supabase
          .from("media_cache")
          .select(
            "media_type, tmdb_id, title, vote_average, release_date, genre_ids, episode_count_aired"
          )
          .eq("media_type", type)
          .in("tmdb_id", ids.slice(i, i + 300));
        cacheRows.push(...((data ?? []) as typeof cacheRows));
      }
    }
    void allIds;
    const cacheKey = (t: string, id: number) => `${t}-${id}`;
    const cacheMap = new Map(cacheRows.map((r) => [cacheKey(r.media_type, r.tmdb_id), r]));

    const [tvDetails, movieDetails] = await Promise.all([
      mapLimit(tvIds, 4, (id) => tmdbFetch<TvRaw>(`/tv/${id}`)),
      mapLimit(movieIds, 4, (id) => tmdbFetch<MovieRaw>(`/movie/${id}`)),
    ]);

    const tvMap = new Map<number, TvRaw>();
    tvDetails.forEach((d) => d && tvMap.set(d.id, d));
    const movieMap = new Map<number, MovieRaw>();
    movieDetails.forEach((d) => d && movieMap.set(d.id, d));

    // Genre id -> name maps, used for titles resolved only from cache.
    const genreNames = new Map<string, string>();
    try {
      const [tvGenres, movieGenres] = await Promise.all([
        tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/tv/list"),
        tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/movie/list"),
      ]);
      for (const g of tvGenres.genres ?? []) genreNames.set(`tv-${g.id}`, g.name);
      for (const g of movieGenres.genres ?? []) genreNames.set(`movie-${g.id}`, g.name);
    } catch {
      // genre names stay empty; cache-only titles just won't contribute genres
    }

    const tvGenreList = (id: number): string[] => {
      const d = tvMap.get(id);
      if (d?.genres?.length) return d.genres.map((g) => g.name);
      const c = cacheMap.get(cacheKey("tv", id));
      return (c?.genre_ids ?? [])
        .map((g) => genreNames.get(`tv-${g}`))
        .filter((n): n is string => !!n);
    };
    const movieGenreList = (id: number): string[] => {
      const d = movieMap.get(id);
      if (d?.genres?.length) return d.genres.map((g) => g.name);
      const c = cacheMap.get(cacheKey("movie", id));
      return (c?.genre_ids ?? [])
        .map((g) => genreNames.get(`movie-${g}`))
        .filter((n): n is string => !!n);
    };
    const tvTitle = (id: number) =>
      tvMap.get(id)?.name ?? cacheMap.get(cacheKey("tv", id))?.title ?? null;
    const tvYear = (id: number) => {
      const s =
        tvMap.get(id)?.first_air_date ?? cacheMap.get(cacheKey("tv", id))?.release_date ?? null;
      const y = s ? parseInt(s.slice(0, 4), 10) : NaN;
      return Number.isFinite(y) ? y : null;
    };
    const movieYear = (id: number) => {
      const s =
        movieMap.get(id)?.release_date ??
        cacheMap.get(cacheKey("movie", id))?.release_date ??
        null;
      const y = s ? parseInt(s.slice(0, 4), 10) : NaN;
      return Number.isFinite(y) ? y : null;
    };
    const tvScore = (id: number) =>
      tvMap.get(id)?.vote_average ?? cacheMap.get(cacheKey("tv", id))?.vote_average ?? null;
    const movieScore = (id: number) =>
      movieMap.get(id)?.vote_average ??
      cacheMap.get(cacheKey("movie", id))?.vote_average ??
      null;

    const unresolvedTitles =
      tvIds.filter((id) => !tvMap.has(id) && !cacheMap.has(cacheKey("tv", id))).length +
      movieIds.filter((id) => !movieMap.has(id) && !cacheMap.has(cacheKey("movie", id)))
        .length;

    // Helpers to get effective runtime for an episode
    const epRuntime = (tmdb_id: number, stored: number | null) => {
      if (stored && stored > 0) return stored;
      const d = tvMap.get(tmdb_id);
      const rt = d?.episode_run_time?.[0];
      return typeof rt === "number" && rt > 0 ? rt : 0;
    };
    const mvRuntime = (tmdb_id: number, stored: number | null) => {
      if (stored && stored > 0) return stored;
      const d = movieMap.get(tmdb_id);
      return d?.runtime ?? 0;
    };

    // ---- Genres & decades ----
    const genreAgg = new Map<string, { count: number; minutes: number }>();
    const bumpGenre = (name: string, minutes: number) => {
      const cur = genreAgg.get(name) ?? { count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += minutes;
      genreAgg.set(name, cur);
    };

    const decadeAgg = new Map<string, number>();
    const bumpDecade = (year: number | null) => {
      if (!year) return;
      const dec = `${Math.floor(year / 10) * 10}s`;
      decadeAgg.set(dec, (decadeAgg.get(dec) ?? 0) + 1);
    };

    // Episodes grouped by series (specials kept here: they still count as watch time)
    const epsBySeries = new Map<number, WatchedEpisodeRow[]>();
    for (const e of eps) {
      const arr = epsBySeries.get(e.tmdb_id) ?? [];
      arr.push(e);
      epsBySeries.set(e.tmdb_id, arr);
    }
    for (const [tmdb_id, arr] of epsBySeries) {
      const totalMin = arr.reduce((s, e) => s + epRuntime(tmdb_id, e.runtime_minutes), 0);
      const gs = tvGenreList(tmdb_id);
      if (gs.length) {
        const per = totalMin / gs.length;
        for (const g of gs) bumpGenre(g, per);
      }
      bumpDecade(tvYear(tmdb_id));
    }
    // Movies
    for (const m of movies) {
      const mins = mvRuntime(m.tmdb_id, m.runtime_minutes);
      const gs = movieGenreList(m.tmdb_id);
      if (gs.length) {
        const per = mins / gs.length;
        for (const g of gs) bumpGenre(g, per);
      }
      bumpDecade(movieYear(m.tmdb_id));
    }

    const genres = Array.from(genreAgg.entries())
      .map(([name, v]) => ({ name, count: v.count, minutes: Math.round(v.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);

    const decades = Array.from(decadeAgg.entries())
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    // ---- Average TMDB score of watched titles (unresolved titles are skipped) ----
    const ratings: number[] = [];
    for (const id of movieIds) {
      const r = movieScore(id);
      if (typeof r === "number" && r > 0) ratings.push(Number(r));
    }
    for (const id of tvIds) {
      const r = tvScore(id);
      if (typeof r === "number" && r > 0) ratings.push(Number(r));
    }
    const avgRating = ratings.length
      ? +(ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2)
      : null;

    // ---- Time windows & weekday distribution ----
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    let minutesLast7 = 0;
    let minutesLast30 = 0;
    let minutesLast90 = 0;
    const weekday = new Array(7).fill(0) as number[];

    const addWatched = (watched_at: string | null, minutes: number) => {
      if (!minutes) return;
      if (!watched_at) return;
      const t = new Date(watched_at).getTime();
      if (Number.isNaN(t)) return;
      const age = now - t;
      if (age <= 7 * DAY) minutesLast7 += minutes;
      if (age <= 30 * DAY) minutesLast30 += minutes;
      if (age <= 90 * DAY) minutesLast90 += minutes;
      weekday[new Date(t).getDay()] += minutes;
    };

    for (const e of eps) addWatched(e.watched_at, epRuntime(e.tmdb_id, e.runtime_minutes));
    for (const m of movies) addWatched(m.watched_at, mvRuntime(m.tmdb_id, m.runtime_minutes));
    for (const r of rewatches) addWatched(r.created_at, r.minutes ?? 0);

    const weekdayMinutes = weekday.map((minutes, i) => ({
      day: WEEKDAYS[i],
      minutes: Math.round(minutes),
    }));
    const busiestIdx = weekday.reduce((best, v, i) => (v > weekday[best] ? i : best), 0);
    const busiestWeekday = weekday[busiestIdx] > 0 ? WEEKDAYS[busiestIdx] : null;

    // ---- Top series by episodes watched (rewatched episodes count again) ----
    const rewatchEpsBySeries = new Map<number, number>();
    for (const r of rewatches) {
      if (r.media_type !== "tv") continue;
      rewatchEpsBySeries.set(
        r.tmdb_id,
        (rewatchEpsBySeries.get(r.tmdb_id) ?? 0) + (r.episodes_count ?? 0)
      );
    }
    const seriesEpisodeCounts = new Map<number, number>();
    for (const [tmdb_id, arr] of epsBySeries.entries()) {
      seriesEpisodeCounts.set(tmdb_id, arr.length);
    }
    for (const [tmdb_id, extra] of rewatchEpsBySeries.entries()) {
      seriesEpisodeCounts.set(tmdb_id, (seriesEpisodeCounts.get(tmdb_id) ?? 0) + extra);
    }
    const topSeriesByEpisodes = Array.from(seriesEpisodeCounts.entries())
      .map(([tmdb_id, episodes]) => ({
        tmdb_id,
        title: tvTitle(tmdb_id) ?? `TV #${tmdb_id}`,
        episodes,
      }))
      .sort((a, b) => b.episodes - a.episodes)
      .slice(0, 5);

    // ---- Aired-episode helpers (specials excluded from completion) ----
    const airedTotal = (tmdb_id: number): number => {
      const d = tvMap.get(tmdb_id);
      if (d) {
        const seasons = (d.seasons ?? []).filter((s) => s.season_number > 0);
        const last = d.last_episode_to_air;
        if (last) {
          let total = 0;
          for (const s of seasons) {
            const ec = s.episode_count ?? 0;
            if (s.season_number < last.season_number) total += ec;
            else if (s.season_number === last.season_number)
              total += Math.min(last.episode_number, ec || last.episode_number);
          }
          if (total > 0) return total;
        }
        if (d.number_of_episodes && d.number_of_episodes > 0) return d.number_of_episodes;
      }
      return cacheMap.get(cacheKey("tv", tmdb_id))?.episode_count_aired ?? 0;
    };

    const regularWatchedCount = (arr: WatchedEpisodeRow[]) =>
      arr.filter((e) => e.season_number > 0).length;

    const lastWatchedAt = (arr: WatchedEpisodeRow[]) =>
      arr.reduce<string>((max, e) => (e.watched_at && e.watched_at > max ? e.watched_at : max), "");

    // ---- Series in progress (aired-only, no specials, no dropped) ----
    const seriesInProgress = Array.from(epsBySeries.entries())
      .filter(([tmdb_id]) => !droppedIds.has(tmdb_id))
      .map(([tmdb_id, arr]) => {
        const total = airedTotal(tmdb_id);
        const watched = Math.min(regularWatchedCount(arr), total || Number.MAX_SAFE_INTEGER);
        const percent = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
        return {
          tmdb_id,
          title: tvTitle(tmdb_id) ?? `TV #${tmdb_id}`,
          watched,
          total,
          percent,
          last_watched_at: lastWatchedAt(arr),
        };
      })
      .filter((s) => s.total > 0 && s.watched > 0 && s.watched < s.total)
      .sort((a, b) => (b.last_watched_at > a.last_watched_at ? 1 : -1));

    // ---- Seasons completed (aired episodes only, specials excluded) ----
    let seasonsCompleted = 0;
    for (const [tmdb_id, arr] of epsBySeries) {
      const d = tvMap.get(tmdb_id);
      if (!d?.seasons) continue;
      const last = d.last_episode_to_air;
      const bySeason = new Map<number, Set<number>>();
      for (const e of arr) {
        if (e.season_number <= 0) continue;
        const set = bySeason.get(e.season_number) ?? new Set<number>();
        set.add(e.episode_number);
        bySeason.set(e.season_number, set);
      }
      for (const s of d.seasons) {
        if (s.season_number === 0) continue;
        const ec = s.episode_count ?? 0;
        if (ec <= 0) continue;
        // Number of episodes of this season that already aired.
        let aired = ec;
        if (last) {
          if (s.season_number > last.season_number) aired = 0;
          else if (s.season_number === last.season_number)
            aired = Math.min(last.episode_number, ec);
        }
        if (aired <= 0) continue;
        // Only count a season as completed when it has fully aired.
        if (aired < ec) continue;
        const watched = bySeason.get(s.season_number)?.size ?? 0;
        if (watched >= ec) seasonsCompleted += 1;
      }
    }

    // ---- TV vs Movie minutes ----
    const tvMinutes = Math.round(
      eps.reduce((s, e) => s + epRuntime(e.tmdb_id, e.runtime_minutes), 0)
    );
    const movieMinutes = Math.round(
      movies.reduce((s, m) => s + mvRuntime(m.tmdb_id, m.runtime_minutes), 0)
    );

    return {
      genres,
      decades,
      avgRating,
      ratedCount: ratings.length,
      minutesLast7: Math.round(minutesLast7),
      minutesLast30: Math.round(minutesLast30),
      minutesLast90: Math.round(minutesLast90),
      weekdayMinutes,
      busiestWeekday,
      topSeriesByEpisodes,
      seriesInProgress,
      seasonsCompleted,
      tvMinutes,
      movieMinutes,
      totalMinutes: tvMinutes + movieMinutes,
      seriesTracked: tvIds.length,
      unresolvedTitles,
    };
  });
