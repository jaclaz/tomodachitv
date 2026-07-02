import { createServerFn } from "@tanstack/react-start";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export function posterUrl(path: string | null, size: "w92" | "w154" | "w185" | "w300" | "w500" | "w780" | "original" = "w500") {
  return path ? `${TMDB_IMAGE}/${size}${path}` : "";
}

export function backdropUrl(path: string | null, size: "w300" | "w780" | "w1280" | "original" = "w1280") {
  return path ? `${TMDB_IMAGE}/${size}${path}` : "";
}

export interface SeriesResult {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date: string;
}

export interface TrendingResponse {
  results: SeriesResult[];
}

export interface SeriesDetails extends SeriesResult {
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

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  return key;
}

async function tmdbFetch(path: string, params?: Record<string, string>) {
  const key = getApiKey();
  const query = new URLSearchParams({
    api_key: key,
    language: "it-IT",
    ...params,
  });
  const res = await fetch(`${TMDB_BASE}${path}?${query.toString()}`);
  if (!res.ok) throw new Error(`TMDB error: ${res.status} ${res.statusText}`);
  return res.json();
}

export const getTrendingSeries = createServerFn({ method: "POST" }).handler(
  async (): Promise<TrendingResponse> => {
    return tmdbFetch("/trending/tv/week");
  }
);

export const searchSeries = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<TrendingResponse> => {
    return tmdbFetch("/search/tv", {
      query: data.query,
      include_adult: "false",
    });
  });

export const getSeriesDetails = createServerFn({ method: "POST" })
  .validator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<SeriesDetails> => {
    return tmdbFetch(`/tv/${data.id}`);
  });

export const getSeasonDetails = createServerFn({ method: "POST" })
  .validator((input: { id: number; season: number }) => input)
  .handler(async ({ data }): Promise<SeasonDetails> => {
    return tmdbFetch(`/tv/${data.id}/season/${data.season}`);
  });
