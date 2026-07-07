import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  return key;
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const key = getApiKey();
  const url = `${TMDB_BASE}${path}?api_key=${key}&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json() as Promise<T>;
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
  }[];
  seasonsCompleted: number;
  tvMinutes: number;
  movieMinutes: number;
  totalMinutes: number;
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
}
interface MovieRaw {
  id: number;
  title: string;
  release_date?: string;
  vote_average?: number;
  runtime?: number | null;
  genres?: { id: number; name: string }[];
}

export const getAdvancedStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvancedStats> => {
    const [epRes, mvRes] = await Promise.all([
      context.supabase
        .from("watched_episodes")
        .select("tmdb_id, season_number, episode_number, runtime_minutes, watched_at")
        .eq("user_id", context.userId),
      context.supabase
        .from("watched_movies")
        .select("tmdb_id, runtime_minutes, watched_at")
        .eq("user_id", context.userId),
    ]);
    if (epRes.error) throw epRes.error;
    if (mvRes.error) throw mvRes.error;
    const eps = epRes.data ?? [];
    const movies = mvRes.data ?? [];

    const tvIds = Array.from(new Set(eps.map((e) => e.tmdb_id)));
    const movieIds = Array.from(new Set(movies.map((m) => m.tmdb_id)));

    const [tvDetails, movieDetails] = await Promise.all([
      mapLimit(tvIds, 6, (id) => tmdbFetch<TvRaw>(`/tv/${id}`)),
      mapLimit(movieIds, 6, (id) => tmdbFetch<MovieRaw>(`/movie/${id}`)),
    ]);

    const tvMap = new Map<number, TvRaw>();
    tvDetails.forEach((d) => d && tvMap.set(d.id, d));
    const movieMap = new Map<number, MovieRaw>();
    movieDetails.forEach((d) => d && movieMap.set(d.id, d));

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

    // Episodes: attribute per-episode by series genre; decade by series first_air_date (count once per series)
    const epsBySeries = new Map<number, typeof eps>();
    for (const e of eps) {
      const arr = epsBySeries.get(e.tmdb_id) ?? [];
      arr.push(e);
      epsBySeries.set(e.tmdb_id, arr);
    }
    for (const [tmdb_id, arr] of epsBySeries) {
      const d = tvMap.get(tmdb_id);
      const totalMin = arr.reduce((s, e) => s + epRuntime(tmdb_id, e.runtime_minutes), 0);
      if (d?.genres?.length) {
        const per = totalMin / d.genres.length;
        for (const g of d.genres) bumpGenre(g.name, per);
      }
      const year = d?.first_air_date ? parseInt(d.first_air_date.slice(0, 4), 10) : null;
      bumpDecade(year);
    }
    // Movies
    for (const m of movies) {
      const d = movieMap.get(m.tmdb_id);
      const mins = mvRuntime(m.tmdb_id, m.runtime_minutes);
      if (d?.genres?.length) {
        const per = mins / d.genres.length;
        for (const g of d.genres) bumpGenre(g.name, per);
      }
      const year = d?.release_date ? parseInt(d.release_date.slice(0, 4), 10) : null;
      bumpDecade(year);
    }

    const genres = Array.from(genreAgg.entries())
      .map(([name, v]) => ({ name, count: v.count, minutes: Math.round(v.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);

    const decades = Array.from(decadeAgg.entries())
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    // ---- Average rating (movies fully watched + series with at least one ep) ----
    const ratings: number[] = [];
    for (const id of movieIds) {
      const r = movieMap.get(id)?.vote_average;
      if (typeof r === "number" && r > 0) ratings.push(r);
    }
    for (const id of tvIds) {
      const r = tvMap.get(id)?.vote_average;
      if (typeof r === "number" && r > 0) ratings.push(r);
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

    const addWatched = (
      watched_at: string | null,
      minutes: number,
    ) => {
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

    const weekdayMinutes = weekday.map((minutes, i) => ({
      day: WEEKDAYS[i],
      minutes: Math.round(minutes),
    }));
    const busiestIdx = weekday.reduce(
      (best, v, i) => (v > weekday[best] ? i : best),
      0
    );
    const busiestWeekday =
      weekday[busiestIdx] > 0 ? WEEKDAYS[busiestIdx] : null;

    // ---- Top series by episodes watched ----
    const topSeriesByEpisodes = Array.from(epsBySeries.entries())
      .map(([tmdb_id, arr]) => ({
        tmdb_id,
        title: tvMap.get(tmdb_id)?.name ?? `TV #${tmdb_id}`,
        episodes: arr.length,
      }))
      .sort((a, b) => b.episodes - a.episodes)
      .slice(0, 5);

    // ---- Series in progress with completion % ----
    const seriesInProgress = Array.from(epsBySeries.entries())
      .map(([tmdb_id, arr]) => {
        const d = tvMap.get(tmdb_id);
        const total = d?.number_of_episodes ?? 0;
        const watched = arr.length;
        const percent = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
        return {
          tmdb_id,
          title: d?.name ?? `TV #${tmdb_id}`,
          watched,
          total,
          percent,
        };
      })
      .filter((s) => s.total > 0 && s.percent < 100)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);

    // ---- Seasons completed ----
    let seasonsCompleted = 0;
    for (const [tmdb_id, arr] of epsBySeries) {
      const d = tvMap.get(tmdb_id);
      if (!d?.seasons) continue;
      const bySeason = new Map<number, Set<number>>();
      for (const e of arr) {
        const set = bySeason.get(e.season_number) ?? new Set<number>();
        set.add(e.episode_number);
        bySeason.set(e.season_number, set);
      }
      for (const s of d.seasons) {
        if (s.season_number === 0) continue;
        if (s.episode_count <= 0) continue;
        const watched = bySeason.get(s.season_number)?.size ?? 0;
        if (watched >= s.episode_count) seasonsCompleted += 1;
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
    };
  });
