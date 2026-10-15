import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MediaItem, MediaType } from "./tmdb";

const TMDB_BASE = "https://api.themoviedb.org/3";
/** Minimum number of locally-trending titles before we stop topping up from TMDB. */
export const LOCAL_TREND_MIN = 10;

function regionName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

async function tmdb(path: string, params: Record<string, string>) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  const q = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  const res = await fetch(`${TMDB_BASE}${path}?${q}`);
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  return res.json();
}

/** Saves the caller's country so their interactions count towards that country's trends. */
export const syncMyCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { country: string }) => input)
  .handler(async ({ data, context }) => {
    const cc = data.country.toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return { ok: false };
    await context.supabase.from("profiles").update({ country_code: cc } as never).eq("id", context.userId);
    return { ok: true };
  });

export interface CountryTrending {
  results: MediaItem[];
  country: string;
  localCount: number;
  fallback: boolean;
}

export const getCountryTrending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { type: MediaType; country: string }) => input)
  .handler(async ({ data, context }): Promise<CountryTrending> => {
    const country = (/^[A-Za-z]{2}$/.test(data.country) ? data.country : "US").toUpperCase();
    const name = regionName(country);

    // 1) Community trend for this country: time-decayed velocity over the last 7 days.
    const { data: scores } = await context.supabase.rpc("get_trending_scores", {
      _country: country,
      _media_type: data.type,
      _limit: 40,
    });
    const rows = ((scores ?? []) as { tmdb_id: number; score: number; users: number }[]).filter(
      (r) => r.score >= 1,
    );
    const local: MediaItem[] = [];
    if (rows.length) {
      const { data: cache } = await context.supabase
        .from("media_cache")
        .select("tmdb_id, title, poster_path, backdrop_path, vote_average, release_date")
        .eq("media_type", data.type)
        .in("tmdb_id", rows.map((r) => r.tmdb_id));
      const byId = new Map((cache ?? []).map((c) => [c.tmdb_id, c]));
      for (const r of rows) {
        const c = byId.get(r.tmdb_id);
        if (!c?.poster_path) continue;
        local.push({
          id: r.tmdb_id,
          media_type: data.type,
          title: c.title ?? "",
          overview: "",
          poster_path: c.poster_path,
          backdrop_path: c.backdrop_path,
          vote_average: Number(c.vote_average ?? 0),
          release_date: c.release_date,
          reason: `Popular in ${name} this week`,
        });
      }
    }

    // 2) Controlled fallback: regional TMDB popularity (watch_region / region aware).
    let fallback = false;
    const results = [...local];
    if (local.length < LOCAL_TREND_MIN) {
      fallback = true;
      const params: Record<string, string> = {
        sort_by: "popularity.desc",
        include_adult: "false",
        "vote_count.gte": "20",
        watch_region: country,
        with_watch_monetization_types: "flatrate|free|ads|rent|buy",
      };
      if (data.type === "movie") params.region = country;
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2).toISOString().slice(0, 10);
      params[data.type === "movie" ? "primary_release_date.gte" : "air_date.gte"] = since;
      try {
        const res = await tmdb(`/discover/${data.type}`, params);
        const seen = new Set(results.map((r) => r.id));
        for (const r of (res.results ?? []) as any[]) {
          if (seen.has(r.id) || !r.poster_path) continue;
          results.push({
            id: r.id,
            media_type: data.type,
            title: (data.type === "tv" ? r.name : r.title) ?? "",
            overview: r.overview ?? "",
            poster_path: r.poster_path,
            backdrop_path: r.backdrop_path,
            vote_average: r.vote_average ?? 0,
            release_date: (data.type === "tv" ? r.first_air_date : r.release_date) || null,
            reason: `Trending in ${name}`,
          });
        }
      } catch (e) {
        console.error("regional trending fallback failed", e);
      }
    }
    return { results: results.slice(0, 20), country, localCount: local.length, fallback };
  });
