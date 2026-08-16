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
  production_companies: ProductionCompany[];
  original_language: string;
  spoken_languages: SpokenLanguage[];
  origin_country: string[];
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

export interface PersonSearchItem {
  id: number;
  media_type: "person";
  title: string; // person's name (kept as `title` for UI convenience)
  profile_path: string | null;
  known_for_department: string | null;
  known_for_titles: string[];
}

export type SearchResultItem = MediaItem | PersonSearchItem;

interface RawPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string | null;
  known_for?: Array<{ title?: string; name?: string }>;
}

export const searchMulti = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<{ results: SearchResultItem[] }> => {
    if (!data.query.trim()) return { results: [] };
    const res = await tmdbFetch("/search/multi", {
      query: data.query,
      include_adult: "false",
    });
    const results: SearchResultItem[] = [];
    for (const raw of res.results as (RawMulti | (RawPerson & { media_type: "person" }))[]) {
      if (raw.media_type === "tv") {
        results.push(mapTv(raw as RawTv));
      } else if (raw.media_type === "movie") {
        results.push(mapMovie(raw as RawMovie));
      } else if (raw.media_type === "person") {
        const p = raw as RawPerson;
        results.push({
          id: p.id,
          media_type: "person",
          title: p.name,
          profile_path: p.profile_path,
          known_for_department: p.known_for_department ?? null,
          known_for_titles: (p.known_for ?? [])
            .map((k) => k.title ?? k.name ?? "")
            .filter(Boolean)
            .slice(0, 3),
        });
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
      production_companies: raw.production_companies ?? [],
      original_language: raw.original_language ?? "",
      spoken_languages: raw.spoken_languages ?? [],
      origin_country:
        raw.origin_country ??
        (raw.production_countries ?? []).map((c: { iso_3166_1: string }) => c.iso_3166_1),
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
  providerId?: number | null;
  watchRegion?: string | null;
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
    if (data.providerId) {
      params.with_watch_providers = String(data.providerId);
      params.watch_region = (data.watchRegion || "US").toUpperCase();
      params.with_watch_monetization_types = "flatrate";
    }
    const res = await tmdbFetch(`/discover/${data.type}`, params);
    const results = (res.results ?? []).map((r: RawTv & RawMovie) =>
      data.type === "tv" ? mapTv(r) : mapMovie(r)
    );
    return { results };
  });

// ============ Provider list (for filters) ============
export const getProviderList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { type: MediaType; watchRegion?: string | null }) => input)
  .handler(async ({ data }): Promise<{ providers: WatchProvider[] }> => {
    const region = (data.watchRegion || "US").toUpperCase();
    const res = await tmdbFetch(`/watch/providers/${data.type}`, { watch_region: region });
    const list = ((res.results ?? []) as (WatchProvider & { display_priorities?: Record<string, number>; display_priority?: number })[])
      .slice()
      .sort((a, b) => {
        const ap = a.display_priorities?.[region] ?? a.display_priority ?? 999;
        const bp = b.display_priorities?.[region] ?? b.display_priority ?? 999;
        return ap - bp;
      })
      .map((p) => ({ provider_id: p.provider_id, provider_name: p.provider_name, logo_path: p.logo_path }));
    return { providers: list };
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

// ============ Profile images ============
export function profileUrl(
  path: string | null | undefined,
  size: "w45" | "w185" | "h632" | "original" = "w185"
) {
  return path ? `${TMDB_IMAGE}/${size}${path}` : "";
}

// ============ Credits (cast/crew) ============
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export const getCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: number; type: MediaType }) => input)
  .handler(async ({ data }): Promise<{ cast: CastMember[]; crew: CrewMember[] }> => {
    const res = await tmdbFetch(`/${data.type}/${data.id}/credits`);
    return { cast: res.cast ?? [], crew: res.crew ?? [] };
  });

// ============ Translations (used to show available dubs) ============
export interface Translation {
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  english_name: string;
}

export const getTranslations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: number; type: MediaType }) => input)
  .handler(async ({ data }): Promise<{ translations: Translation[] }> => {
    const res = await tmdbFetch(`/${data.type}/${data.id}/translations`);
    return { translations: res.translations ?? [] };
  });

// ============ Person ============
export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
}

export interface PersonCreditItem extends MediaItem {
  character?: string;
  job?: string;
  department?: string;
}

export const getPersonDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<PersonDetails> => {
    const raw = await tmdbFetch(`/person/${data.id}`);
    return {
      id: raw.id,
      name: raw.name,
      biography: raw.biography ?? "",
      birthday: raw.birthday ?? null,
      deathday: raw.deathday ?? null,
      place_of_birth: raw.place_of_birth ?? null,
      profile_path: raw.profile_path ?? null,
      known_for_department: raw.known_for_department ?? "",
    };
  });

export const getPersonCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<{ cast: PersonCreditItem[]; crew: PersonCreditItem[] }> => {
    const res = await tmdbFetch(`/person/${data.id}/combined_credits`);
    const mapItem = (r: RawMulti & { character?: string; job?: string; department?: string }): PersonCreditItem | null => {
      if (r.media_type === "tv") {
        return { ...mapTv(r as RawTv), character: r.character, job: r.job, department: r.department };
      }
      if (r.media_type === "movie") {
        return { ...mapMovie(r as RawMovie), character: r.character, job: r.job, department: r.department };
      }
      return null;
    };
    const cast = ((res.cast ?? []) as (RawMulti & { character?: string })[])
      .map(mapItem)
      .filter((x): x is PersonCreditItem => x !== null);
    const crew = ((res.crew ?? []) as (RawMulti & { job?: string; department?: string })[])
      .map(mapItem)
      .filter((x): x is PersonCreditItem => x !== null);
    return { cast, crew };
  });

// ============ Home highlights (randomized carousel) ============
export interface HighlightSlide {
  item: MediaItem;
  label: string;
  reason?: string;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export const getHomeHighlights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ slides: HighlightSlide[] }> => {
    const [
      trendingTv,
      trendingMovie,
      recentEpisodes,
      recentMovies,
      watchlistRows,
      allWatchedMovies,
      allWatchedEpisodes,
      dismissals,
    ] = await Promise.all([
        tmdbFetch("/trending/tv/week"),
        tmdbFetch("/trending/movie/week"),
        context.supabase
          .from("watched_episodes")
          .select("tmdb_id, watched_at")
          .eq("user_id", context.userId)
          .order("watched_at", { ascending: false })
          .limit(50),
        context.supabase
          .from("watched_movies")
          .select("tmdb_id, title, watched_at")
          .eq("user_id", context.userId)
          .order("watched_at", { ascending: false })
          .limit(20),
        context.supabase
          .from("watchlist")
          .select("tmdb_id, media_type")
          .eq("user_id", context.userId),
        context.supabase
          .from("watched_movies")
          .select("tmdb_id")
          .eq("user_id", context.userId),
        context.supabase
          .from("watched_episodes")
          .select("tmdb_id")
          .eq("user_id", context.userId),
        context.supabase
          .from("recommendation_dismissals")
          .select("tmdb_id, media_type")
          .eq("user_id", context.userId),
      ]);

    // Everything already in the user's library (or dismissed) must never be suggested.
    const excluded = new Set<string>();
    for (const r of (watchlistRows.data ?? []) as { tmdb_id: number; media_type: string }[])
      excluded.add(`${r.media_type}-${r.tmdb_id}`);
    for (const r of (dismissals.data ?? []) as { tmdb_id: number; media_type: string }[])
      excluded.add(`${r.media_type}-${r.tmdb_id}`);
    for (const r of (allWatchedMovies.data ?? []) as { tmdb_id: number }[])
      excluded.add(`movie-${r.tmdb_id}`);
    for (const r of (allWatchedEpisodes.data ?? []) as { tmdb_id: number }[])
      excluded.add(`tv-${r.tmdb_id}`);
    const isNew = (item: MediaItem) =>
      !excluded.has(`${item.media_type}-${item.id}`);

    const tvTop = ((trendingTv.results as RawTv[]) ?? [])
      .filter((r) => r.backdrop_path)
      .slice(0, 10)
      .map(mapTv);
    const movieTop = ((trendingMovie.results as RawMovie[]) ?? [])
      .filter((r) => r.backdrop_path)
      .slice(0, 10)
      .map(mapMovie);

    const slides: HighlightSlide[] = [];


    const [tvPick] = pickRandom(tvTop, 1);
    if (tvPick)
      slides.push({ item: tvPick, label: "Trending TV this week" });

    const [moviePick] = pickRandom(movieTop, 1);
    if (moviePick)
      slides.push({ item: moviePick, label: "Trending Movie this week" });

    // Series recommendation
    const seriesIds = [
      ...new Set(((recentEpisodes.data ?? []) as { tmdb_id: number }[]).map((e) => e.tmdb_id)),
    ].slice(0, 10);
    const [seedTvId] = pickRandom(seriesIds, 1);
    if (seedTvId) {
      try {
        const recs = await tmdbFetch(`/tv/${seedTvId}/recommendations`);
        const list = ((recs.results as RawTv[]) ?? []).filter((r) => r.backdrop_path);
        const [pick] = pickRandom(list, 1);
        if (pick) {
          const { data: seed } = await context.supabase
            .from("media_cache")
            .select("title")
            .eq("media_type", "tv")
            .eq("tmdb_id", seedTvId)
            .maybeSingle();
          slides.push({
            item: mapTv(pick),
            label: "Recommended series",
            reason: seed?.title ? `Because you watched ${seed.title}` : undefined,
          });
        }
      } catch {
        /* ignore */
      }
    }

    // Movie recommendation
    const movieHistory = ((recentMovies.data ?? []) as {
      tmdb_id: number;
      title: string | null;
    }[]).slice(0, 10);
    const [seedMovie] = pickRandom(movieHistory, 1);
    if (seedMovie) {
      try {
        const recs = await tmdbFetch(`/movie/${seedMovie.tmdb_id}/recommendations`);
        const list = ((recs.results as RawMovie[]) ?? []).filter((r) => r.backdrop_path);
        const [pick] = pickRandom(list, 1);
        if (pick) {
          slides.push({
            item: mapMovie(pick),
            label: "Recommended movie",
            reason: seedMovie.title ? `Because you watched ${seedMovie.title}` : undefined,
          });
        }
      } catch {
        /* ignore */
      }
    }

    // Fallback: if we have fewer than 3 slides, add more random trending picks
    if (slides.length < 3) {
      const extras = pickRandom([...tvTop, ...movieTop], 3 - slides.length);
      for (const item of extras) {
        slides.push({
          item,
          label: item.media_type === "tv" ? "Trending TV" : "Trending Movie",
        });
      }
    }

    return { slides };
  });

// ============ Personalized recommendations ============


export const getUserRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { seed: number }) => input)
  .handler(
    async ({ data, context }): Promise<{ tv: MediaItem[]; movie: MediaItem[] }> => {
      const { buildRecommendations } = await import("./recommendations.server");
      return buildRecommendations(
        context.supabase,
        context.userId,
        data.seed ?? 0,
      );
    }
  );






// ============ Related titles (recommendations + similar) ============
export interface RelatedTitle {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  media_type: MediaType;
}

export const getRelatedTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: number; type: MediaType }) => input)
  .handler(async ({ data }): Promise<RelatedTitle[]> => {
    const map = new Map<number, RelatedTitle>();
    const push = (results: any[] | undefined) => {
      for (const r of results ?? []) {
        if (!r?.id || !r.poster_path) continue;
        if (map.has(r.id)) continue;
        map.set(r.id, {
          tmdb_id: r.id,
          title: r.title ?? r.name ?? "Untitled",
          poster_path: r.poster_path ?? null,
          media_type: data.type,
        });
      }
    };

    const recs = await tmdbFetch(`/${data.type}/${data.id}/recommendations`).catch(() => null);
    push(recs?.results);
    if (map.size < 6) {
      const similar = await tmdbFetch(`/${data.type}/${data.id}/similar`).catch(() => null);
      push(similar?.results);
    }
    return Array.from(map.values()).slice(0, 20);
  });
