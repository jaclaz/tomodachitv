import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export type MediaType = "tv" | "movie";

export function posterUrl(
  path: string | null | undefined,
  size: "w92" | "w154" | "w185" | "w300" | "w500" | "w780" | "original" = "w500"
) {
  return path ? `${TMDB_IMAGE}/${size}${path}` : "";
}

export function backdropUrl(
  path: string | null | undefined,
  size: "w300" | "w780" | "w1280" | "original" = "w1280"
) {
  return path ? `${TMDB_IMAGE}/${size}${path}` : "";
}

// ============ Unified Media shape ============
export interface MediaItem {
  id: number;
  media_type: MediaType;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string | null; // first_air_date for tv, release_date for movie
}

// ============ Raw TMDB shapes ============
interface RawTv {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date: string;
}

interface RawMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string;
}

interface RawMulti extends Partial<RawTv & RawMovie> {
  id: number;
  media_type: "tv" | "movie" | "person";
}

function mapTv(r: RawTv): MediaItem {
  return {
    id: r.id,
    media_type: "tv",
    title: r.name,
    overview: r.overview ?? "",
    poster_path: r.poster_path,
    backdrop_path: r.backdrop_path,
    vote_average: r.vote_average ?? 0,
    release_date: r.first_air_date || null,
  };
}

function mapMovie(r: RawMovie): MediaItem {
  return {
    id: r.id,
    media_type: "movie",
    title: r.title,
    overview: r.overview ?? "",
    poster_path: r.poster_path,
    backdrop_path: r.backdrop_path,
    vote_average: r.vote_average ?? 0,
    release_date: r.release_date || null,
  };
}

// ============ Details ============
export interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface SpokenLanguage {
  iso_639_1: string;
  english_name: string;
  name: string;
}

export interface Creator {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface SeriesDetails extends MediaItem {
  media_type: "tv";
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  seasons: {
    season_number: number;
    name: string;
    episode_count: number;
    air_date?: string;
    poster_path?: string | null;
  }[];
  production_companies: ProductionCompany[];
  networks: ProductionCompany[];
  created_by: Creator[];
  original_language: string;
  spoken_languages: SpokenLanguage[];
  languages: string[];
  origin_country: string[];
}

export interface MovieDetails extends MediaItem {
  media_type: "movie";
  runtime: number | null;
  genres: { id: number; name: string }[];
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date?: string;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  episodes: Episode[];
}

// ============ Fetch helper ============
function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  return key;
}

async function tmdbFetch(path: string, params?: Record<string, string>) {
  const key = getApiKey();
  const query = new URLSearchParams({
    api_key: key,
    language: "en-US",
    ...params,
  });
  const res = await fetch(`${TMDB_BASE}${path}?${query.toString()}`);
  if (!res.ok) throw new Error(`TMDB error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ============ Server functions ============
export const getTrendingSeries = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async (): Promise<{ results: MediaItem[] }> => {
    const data = await tmdbFetch("/trending/tv/week");
    return { results: (data.results as RawTv[]).map(mapTv) };
  }
);

export const getTrendingMovies = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async (): Promise<{ results: MediaItem[] }> => {
    const data = await tmdbFetch("/trending/movie/week");
    return { results: (data.results as RawMovie[]).map(mapMovie) };
  }
);

export const getTrendingAll = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async (): Promise<{ results: MediaItem[] }> => {
    const data = await tmdbFetch("/trending/all/week");
    const results: MediaItem[] = [];
    for (const raw of data.results as RawMulti[]) {
      if (raw.media_type === "tv") {
        results.push(mapTv(raw as RawTv));
      } else if (raw.media_type === "movie") {
        results.push(mapMovie(raw as RawMovie));
      }
    }
    return { results };
  }
);

export const searchMulti = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<{ results: MediaItem[] }> => {
    if (!data.query.trim()) return { results: [] };
    const res = await tmdbFetch("/search/multi", {
      query: data.query,
      include_adult: "false",
    });
    const results: MediaItem[] = [];
    for (const raw of res.results as RawMulti[]) {
      if (raw.media_type === "tv") {
        results.push(mapTv(raw as RawTv));
      } else if (raw.media_type === "movie") {
        results.push(mapMovie(raw as RawMovie));
      }
    }
    return { results };
  });

export const getSeriesDetails = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<SeriesDetails> => {
    const raw = await tmdbFetch(`/tv/${data.id}`);
    let episodeRunTime: number[] = raw.episode_run_time ?? [];

    // Fallback: if TMDB doesn't provide episode_run_time, compute it from
    // the first available season's episode runtimes.
    if (episodeRunTime.length === 0) {
      const seasons = (raw.seasons ?? []) as { season_number: number; episode_count: number }[];
      const target = seasons.find((s) => s.season_number > 0 && s.episode_count > 0)
        ?? seasons.find((s) => s.episode_count > 0);
      if (target) {
        try {
          const season = await tmdbFetch(`/tv/${data.id}/season/${target.season_number}`);
          const runtimes = ((season.episodes ?? []) as { runtime: number | null }[])
            .map((e) => e.runtime)
            .filter((r): r is number => typeof r === "number" && r > 0);
          if (runtimes.length > 0) episodeRunTime = runtimes;
        } catch {
          // ignore fallback errors
        }
      }
    }

    return {
      ...mapTv(raw as RawTv),
      media_type: "tv",
      number_of_seasons: raw.number_of_seasons,
      number_of_episodes: raw.number_of_episodes,
      episode_run_time: episodeRunTime,
      genres: raw.genres ?? [],
      seasons: raw.seasons ?? [],
      production_companies: raw.production_companies ?? [],
      networks: raw.networks ?? [],
      created_by: raw.created_by ?? [],
      original_language: raw.original_language ?? "",
      spoken_languages: raw.spoken_languages ?? [],
      languages: raw.languages ?? [],
      origin_country: raw.origin_country ?? [],
    };
  });


export const getMovieDetails = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<MovieDetails> => {
    const raw = await tmdbFetch(`/movie/${data.id}`);
    return {
      ...mapMovie(raw as RawMovie),
      media_type: "movie",
      runtime: raw.runtime ?? null,
      genres: raw.genres ?? [],
    };
  });

export const getSeasonDetails = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { id: number; season: number }) => input)
  .handler(async ({ data }): Promise<SeasonDetails> => {
    return tmdbFetch(`/tv/${data.id}/season/${data.season}`);
  });

// ============ Genres ============
export interface Genre { id: number; name: string }

export const getGenres = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { type: MediaType }) => input)
  .handler(async ({ data }): Promise<{ genres: Genre[] }> => {
    const res = await tmdbFetch(`/genre/${data.type}/list`);
    return { genres: res.genres ?? [] };
  });

// ============ Discover with filters ============
export type SortBy =
  | "popularity.desc"
  | "vote_average.desc"
  | "primary_release_date.desc"
  | "first_air_date.desc"
  | "title.asc"
  | "name.asc";

export interface DiscoverParams {
  type: MediaType;
  genreId?: number | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  minRating?: number | null;
  sortBy?: SortBy;
  page?: number;
}

export const discoverContent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: DiscoverParams) => input)
  .handler(async ({ data }): Promise<{ results: MediaItem[] }> => {
    const params: Record<string, string> = {
      sort_by: data.sortBy ?? "popularity.desc",
      include_adult: "false",
      page: String(data.page ?? 1),
      "vote_count.gte": "50",
    };
    if (data.genreId) params.with_genres = String(data.genreId);
    if (data.minRating != null) params["vote_average.gte"] = String(data.minRating);
    if (data.type === "movie") {
      if (data.yearFrom) params["primary_release_date.gte"] = `${data.yearFrom}-01-01`;
      if (data.yearTo) params["primary_release_date.lte"] = `${data.yearTo}-12-31`;
    } else {
      if (data.yearFrom) params["first_air_date.gte"] = `${data.yearFrom}-01-01`;
      if (data.yearTo) params["first_air_date.lte"] = `${data.yearTo}-12-31`;
    }
    const res = await tmdbFetch(`/discover/${data.type}`, params);
    const results = (res.results ?? []).map((r: RawTv & RawMovie) =>
      data.type === "tv" ? mapTv(r) : mapMovie(r)
    );
    return { results };
  });

// ============ Watch providers ============
export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

export interface CountryProviders {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  ads?: WatchProvider[];
  free?: WatchProvider[];
}

export function providerLogoUrl(path: string | null | undefined) {
  return path ? `${TMDB_IMAGE}/w92${path}` : "";
}

export const getWatchProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: number; type: MediaType; country: string }) => input)
  .handler(
    async ({ data }): Promise<{ country: string; providers: CountryProviders | null; available: string[] }> => {
      const res = await tmdbFetch(`/${data.type}/${data.id}/watch/providers`);
      const results = (res.results ?? {}) as Record<string, CountryProviders>;
      const country = data.country.toUpperCase();
      return {
        country,
        providers: results[country] ?? null,
        available: Object.keys(results).sort(),
      };
    }
  );


