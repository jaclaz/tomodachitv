import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";

interface EpisodeRow {
  tvdb_show_id?: number | null;
  tmdb_show_id?: number | null;
  season_number: number;
  episode_number: number;
  watched_at?: string | null;
}
interface MovieRow {
  tmdb_id?: number | null;
  imdb_id?: string | null;
  title?: string | null;
  year?: number | null;
  runtime_minutes?: number | null;
  watched_at?: string | null;
}
interface FollowShowRow {
  tvdb_show_id?: number | null;
  tmdb_show_id?: number | null;
}
interface FollowMovieRow {
  tmdb_id?: number | null;
  imdb_id?: string | null;
  title?: string | null;
  year?: number | null;
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

export const importTvTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (i: {
      episodes: EpisodeRow[];
      watched_movies: MovieRow[];
      follow_shows: FollowShowRow[];
      follow_movies: FollowMovieRow[];
    }) => i
  )
  .handler(async ({ context, data }) => {
    const MAX_EPISODES = 5000;
    const MAX_MOVIES = 2000;
    const MAX_SHOWS = 1000;
    const MAX_FOLLOW_MOVIES = 2000;
    if (
      data.episodes.length > MAX_EPISODES ||
      data.watched_movies.length > MAX_MOVIES ||
      data.follow_shows.length > MAX_SHOWS ||
      data.follow_movies.length > MAX_FOLLOW_MOVIES
    ) {
      throw new Error(
        "Import payload too large. Please split your archive into smaller chunks."
      );
    }

    const key = process.env.TMDB_API_KEY;
    if (!key) throw new Error("TMDB_API_KEY not configured");

    const fetchJson = async (
      path: string,
      params?: Record<string, string>
    ): Promise<any | null> => {
      const q = new URLSearchParams({
        api_key: key,
        language: "en-US",
        ...params,
      });
      try {
        const r = await fetch(`${TMDB_BASE}${path}?${q}`);
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };

    const resolveShow = async (tvdb: number): Promise<ResolvedShow | null> => {
      const d = await fetchJson(`/find/${tvdb}`, { external_source: "tvdb_id" });
      const tv = d?.tv_results?.[0];
      if (!tv) return null;
      const details = await fetchJson(`/tv/${tv.id}`);
      const avgRun = details?.episode_run_time?.[0] ?? null;
      return {
        tmdb_id: tv.id as number,
        name: tv.name as string,
        poster_path: tv.poster_path ?? null,
        backdrop_path: tv.backdrop_path ?? null,
        first_air_date: tv.first_air_date ?? null,
        vote_average: tv.vote_average ?? null,
        runtime: avgRun,
      };
    };

    const resolveMovie = async (m: MovieRow): Promise<ResolvedMovie | null> => {
      if (m.tmdb_id) {
        const d = await fetchJson(`/movie/${m.tmdb_id}`);
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
        return null;
      }
      if (m.imdb_id) {
        const d = await fetchJson(`/find/${m.imdb_id}`, {
          external_source: "imdb_id",
        });
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
        const d = await fetchJson(`/search/movie`, params);
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
    };

    const mapPool = async <T, R>(
      items: T[],
      limit: number,
      fn: (x: T) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = new Array(items.length);
      let i = 0;
      const workers = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
          while (true) {
            const idx = i++;
            if (idx >= items.length) return;
            results[idx] = await fn(items[idx]);
          }
        }
      );
      await Promise.all(workers);
      return results;
    };

    // Resolve shows via TVDB (external → tmdb) and TMDB (direct)
    const tvdbIds = Array.from(
      new Set([
        ...data.episodes.map((e) => e.tvdb_show_id),
        ...data.follow_shows.map((f) => f.tvdb_show_id),
      ])
    ).filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0);

    const tmdbShowIds = Array.from(
      new Set([
        ...data.episodes.map((e) => e.tmdb_show_id),
        ...data.follow_shows.map((f) => f.tmdb_show_id),
      ])
    ).filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0);

    const resolveShowByTmdb = async (id: number): Promise<ResolvedShow | null> => {
      const d = await fetchJson(`/tv/${id}`);
      if (!d?.id) return null;
      return {
        tmdb_id: d.id,
        name: d.name,
        poster_path: d.poster_path ?? null,
        backdrop_path: d.backdrop_path ?? null,
        first_air_date: d.first_air_date ?? null,
        vote_average: d.vote_average ?? null,
        runtime: d.episode_run_time?.[0] ?? null,
      };
    };

    const showByTvdb = new Map<number, ResolvedShow | null>();
    const showByTmdb = new Map<number, ResolvedShow | null>();
    await mapPool(tvdbIds, 8, async (id) => {
      showByTvdb.set(id, await resolveShow(id));
    });
    await mapPool(tmdbShowIds, 8, async (id) => {
      showByTmdb.set(id, await resolveShowByTmdb(id));
    });

    const showFor = (e: { tvdb_show_id?: number | null; tmdb_show_id?: number | null }) => {
      if (e.tmdb_show_id) return showByTmdb.get(e.tmdb_show_id) ?? null;
      if (e.tvdb_show_id) return showByTvdb.get(e.tvdb_show_id) ?? null;
      return null;
    };

    // Episodes upsert
    const epRows = data.episodes
      .map((e) => {
        const s = showFor(e);
        if (!s) return null;
        return {
          user_id: context.userId,
          tmdb_id: s.tmdb_id,
          season_number: e.season_number,
          episode_number: e.episode_number,
          episode_name: null,
          runtime_minutes: s.runtime,
          watched_at: e.watched_at || new Date().toISOString(),
        };
      })
      .filter(Boolean) as any[];

    let importedEpisodes = 0;
    for (let i = 0; i < epRows.length; i += 500) {
      const chunk = epRows.slice(i, i + 500);
      const { error } = await context.supabase
        .from("watched_episodes")
        .upsert(chunk, {
          onConflict: "user_id, tmdb_id, season_number, episode_number",
        });
      if (!error) importedEpisodes += chunk.length;
    }

    // Watched movies
    const movieResolved = await mapPool(data.watched_movies, 8, resolveMovie);
    const mvRows = movieResolved
      .map((r, i) =>
        r
          ? {
              user_id: context.userId,
              tmdb_id: r.tmdb_id,
              title: r.title,
              runtime_minutes: r.runtime ?? data.watched_movies[i].runtime_minutes ?? null,
              watched_at:
                data.watched_movies[i].watched_at ||
                new Date().toISOString(),
            }
          : null
      )
      .filter(Boolean) as any[];

    let importedMovies = 0;
    for (let i = 0; i < mvRows.length; i += 500) {
      const chunk = mvRows.slice(i, i + 500);
      const { error } = await context.supabase
        .from("watched_movies")
        .upsert(chunk, { onConflict: "user_id, tmdb_id" });
      if (!error) importedMovies += chunk.length;
    }

    // Watchlist: shows
    const wlShowRows = data.follow_shows
      .map((f) => {
        const s = showFor(f);
        if (!s) return null;
        return {
          user_id: context.userId,
          tmdb_id: s.tmdb_id,
          media_type: "tv" as const,
          series_name: s.name,
          poster_path: s.poster_path,
          backdrop_path: s.backdrop_path,
          first_air_date: s.first_air_date,
          vote_average: s.vote_average,
        };
      })
      .filter(Boolean) as any[];

    // Watchlist: movies
    const wlMovieResolved = await mapPool(data.follow_movies, 8, resolveMovie);
    const wlMovieRows = wlMovieResolved
      .map((r) =>
        r
          ? {
              user_id: context.userId,
              tmdb_id: r.tmdb_id,
              media_type: "movie" as const,
              series_name: r.title,
              poster_path: r.poster_path,
              backdrop_path: r.backdrop_path,
              first_air_date: r.release_date,
              vote_average: r.vote_average,
            }
          : null
      )
      .filter(Boolean) as any[];

    const allWl = [...wlShowRows, ...wlMovieRows];
    let importedWatchlist = 0;
    for (let i = 0; i < allWl.length; i += 500) {
      const chunk = allWl.slice(i, i + 500);
      const { error } = await context.supabase
        .from("watchlist")
        .upsert(chunk, { onConflict: "user_id, media_type, tmdb_id" });
      if (!error) importedWatchlist += chunk.length;
    }

    return {
      importedEpisodes,
      importedMovies,
      importedWatchlist,
      unresolvedShows:
        tvdbIds.filter((id) => !showByTvdb.get(id)).length +
        tmdbShowIds.filter((id) => !showByTmdb.get(id)).length,
      unresolvedMovies:
        movieResolved.filter((r) => !r).length +
        wlMovieResolved.filter((r) => !r).length,
    };
  });

export const exportLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [ep, mv, wl] = await Promise.all([
      context.supabase
        .from("watched_episodes")
        .select("tmdb_id, season_number, episode_number, watched_at")
        .eq("user_id", context.userId),
      context.supabase
        .from("watched_movies")
        .select("tmdb_id, title, runtime_minutes, watched_at")
        .eq("user_id", context.userId),
      context.supabase
        .from("watchlist")
        .select("tmdb_id, media_type, series_name, poster_path, backdrop_path, first_air_date, vote_average, added_at")
        .eq("user_id", context.userId),
    ]);
    return {
      episodes: ep.data ?? [],
      movies: mv.data ?? [],
      watchlist: wl.data ?? [],
    };
  });
