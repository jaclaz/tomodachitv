import type { MediaItem } from "./tmdb";

/**
 * Hybrid recommendation engine (content-based + simplified collaborative).
 *
 * Score = Genre*0.45 + Keyword/People*0.25 + CommunityRating*0.15 + CoWatch*0.15
 * Each component is normalised to 0..1. A diversity pass limits franchises and
 * sub-genres in the top slots, and each pick carries a human-readable reason.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";
type Kind = "tv" | "movie";

interface RawAny {
  id: number;
  name?: string;
  title?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average?: number;
  vote_count?: number;
  first_air_date?: string;
  release_date?: string;
  genre_ids?: number[];
}

interface Details extends RawAny {
  genres?: { id: number; name: string }[];
  belongs_to_collection?: { id: number } | null;
  created_by?: { id: number }[];
  keywords?: { keywords?: { id: number }[]; results?: { id: number }[] };
  credits?: { cast?: { id: number }[]; crew?: { id: number; job?: string }[] };
}

export const W_GENRE = 0.45;
export const W_KEYWORD = 0.25;
export const W_COMMUNITY = 0.15;
export const W_COWATCH = 0.15;

export function recommendationScore(c: {
  genre: number;
  keyword: number;
  community: number;
  cowatch: number;
}) {
  return c.genre * W_GENRE + c.keyword * W_KEYWORD + c.community * W_COMMUNITY + c.cowatch * W_COWATCH;
}

function mapItem(r: RawAny, kind: Kind, reason?: string): MediaItem {
  return {
    id: r.id,
    media_type: kind,
    title: (kind === "tv" ? r.name : r.title) ?? "",
    overview: r.overview ?? "",
    poster_path: r.poster_path,
    backdrop_path: r.backdrop_path,
    vote_average: r.vote_average ?? 0,
    release_date: (kind === "tv" ? r.first_air_date : r.release_date) || null,
    reason,
  };
}

async function fetchTmdb(path: string, params?: Record<string, string>) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  const query = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  const res = await fetch(`${TMDB_BASE}${path}?${query.toString()}`);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

const details = (kind: Kind, id: number): Promise<Details | null> =>
  fetchTmdb(`/${kind}/${id}`, { append_to_response: "keywords,credits" }).catch(() => null);

function keywordIds(d: Details): number[] {
  return (d.keywords?.keywords ?? d.keywords?.results ?? []).map((k) => k.id);
}
function peopleIds(d: Details): number[] {
  const cast = (d.credits?.cast ?? []).slice(0, 5).map((p) => p.id);
  const dirs = (d.credits?.crew ?? [])
    .filter((p) => p.job === "Director" || p.job === "Screenplay" || p.job === "Writer")
    .slice(0, 3)
    .map((p) => p.id);
  const creators = (d.created_by ?? []).map((p) => p.id);
  return [...cast, ...dirs, ...creators];
}

function rng(seed: number) {
  let s = Math.abs(seed) + 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function collectAll(supabase: any, table: string, userId: string, cols: string) {
  const PAGE = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(cols)
      .eq("user_id", userId)
      .range(from, from + PAGE - 1);
    if (error) break;
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

export async function buildRecommendations(
  supabase: any,
  userId: string,
  seed: number,
): Promise<{ tv: MediaItem[]; movie: MediaItem[] }> {
  const [ratings, favorites, episodes, movies, watchlist, dropped, dismissed] = await Promise.all([
    collectAll(supabase, "user_ratings", userId, "media_type, tmdb_id, rating, title"),
    collectAll(supabase, "favorites", userId, "media_type, tmdb_id, title"),
    collectAll(supabase, "watched_episodes", userId, "tmdb_id, watched_at"),
    collectAll(supabase, "watched_movies", userId, "tmdb_id, title, watched_at"),
    collectAll(supabase, "watchlist", userId, "tmdb_id, media_type, status, series_name, added_at"),
    collectAll(supabase, "dropped_shows", userId, "tmdb_id"),
    collectAll(supabase, "recommendation_dismissals", userId, "tmdb_id, media_type"),
  ]);

  // ---- exclusions: anything already in library, completed, dropped or dismissed ----
  const exclude: Record<Kind, Set<number>> = { tv: new Set(), movie: new Set() };
  for (const e of episodes) exclude.tv.add(e.tmdb_id);
  for (const d of dropped) exclude.tv.add(d.tmdb_id);
  for (const m of movies) exclude.movie.add(m.tmdb_id);
  for (const w of watchlist) exclude[w.media_type === "movie" ? "movie" : "tv"].add(w.tmdb_id);
  for (const d of dismissed) exclude[d.media_type === "movie" ? "movie" : "tv"].add(d.tmdb_id);

  // ---- taste signal per library title ----
  const now = Date.now();
  const recency = (d?: string | null) => {
    if (!d) return 0.6;
    const days = (now - new Date(d).getTime()) / 86400000;
    return days < 30 ? 1.5 : days < 120 ? 1.1 : days < 365 ? 0.8 : 0.5;
  };
  const weight: Record<Kind, Map<number, number>> = { tv: new Map(), movie: new Map() };
  const titles: Record<Kind, Map<number, string>> = { tv: new Map(), movie: new Map() };
  const bump = (k: Kind, id: number, w: number, title?: string | null) => {
    weight[k].set(id, (weight[k].get(id) ?? 0) + w);
    if (title && !titles[k].has(id)) titles[k].set(id, title);
  };
  const lastEp = new Map<number, string>();
  for (const e of episodes) {
    const p = lastEp.get(e.tmdb_id);
    if (!p || (e.watched_at ?? "") > p) lastEp.set(e.tmdb_id, e.watched_at);
  }
  for (const [id, at] of lastEp) bump("tv", id, recency(at));
  for (const m of movies) bump("movie", m.tmdb_id, recency(m.watched_at), m.title);
  for (const w of watchlist) {
    const k: Kind = w.media_type === "movie" ? "movie" : "tv";
    if (w.status === "dropped") bump(k, w.tmdb_id, -2, w.series_name);
    else if (w.status === "watching") bump(k, w.tmdb_id, 1.5, w.series_name);
    else if (w.status === "completed") bump(k, w.tmdb_id, 1, w.series_name);
    else titles[k].set(w.tmdb_id, w.series_name);
  }
  for (const d of dropped) bump("tv", d.tmdb_id, -2);
  for (const f of favorites) bump(f.media_type === "movie" ? "movie" : "tv", f.tmdb_id, 3, f.title);
  for (const r of ratings) {
    const k: Kind = r.media_type === "movie" ? "movie" : "tv";
    const v = Number(r.rating) || 0; // 0.5..5 (≈ x2 on a 10 scale)
    if (v >= 3.5) bump(k, r.tmdb_id, 2 + (v - 3.5) * 2, r.title);
    else if (v <= 2) bump(k, r.tmdb_id, -3, r.title);
  }

  // ---- genre vector via media_cache ----
  const genreW: Record<Kind, Map<number, number>> = { tv: new Map(), movie: new Map() };
  await Promise.all(
    (["tv", "movie"] as Kind[]).map(async (kind) => {
      const ids = [...weight[kind].keys()];
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await supabase
          .from("media_cache")
          .select("tmdb_id, genre_ids, title")
          .eq("media_type", kind)
          .in("tmdb_id", ids.slice(i, i + 300));
        for (const row of data ?? []) {
          const w = weight[kind].get(row.tmdb_id) ?? 0;
          if (row.title && !titles[kind].has(row.tmdb_id)) titles[kind].set(row.tmdb_id, row.title);
          for (const g of (row.genre_ids ?? []) as number[])
            genreW[kind].set(g, (genreW[kind].get(g) ?? 0) + w);
        }
      }
    }),
  );

  async function forKind(kind: Kind): Promise<MediaItem[]> {
    const rand = rng(seed + (kind === "tv" ? 0 : 97));
    const gw = genreW[kind];
    const maxG = Math.max(1, ...[...gw.values()].filter((v) => v > 0));

    // seeds: strongest positive titles, with a little seeded rotation
    const positives = [...weight[kind].entries()]
      .filter(([, w]) => w > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18);
    const seeds = positives
      .map(([id, w]) => ({ id, s: w * (0.6 + rand()) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.id);

    const topGenres = [...gw.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);

    const [seedDetails, seedRecs, genreRes, cowatchRes] = await Promise.all([
      Promise.all(seeds.map((id) => details(kind, id))),
      Promise.all(seeds.map((id) => fetchTmdb(`/${kind}/${id}/recommendations`).catch(() => null))),
      topGenres.length
        ? fetchTmdb(`/discover/${kind}`, {
            with_genres: topGenres.slice(0, 2).join("|"),
            sort_by: "vote_average.desc",
            "vote_count.gte": "300",
            page: String((seed % 3) + 1),
          }).catch(() => null)
        : Promise.resolve(null),
      supabase.rpc("get_cowatch_scores", { _media_type: kind }),
    ]);

    // keyword + people preference vectors from seeds
    const kwW = new Map<number, number>();
    const pplW = new Map<number, number>();
    seedDetails.forEach((d, i) => {
      if (!d) return;
      const w = weight[kind].get(seeds[i]) ?? 1;
      if (!titles[kind].has(seeds[i])) titles[kind].set(seeds[i], (d.title ?? d.name) || "");
      for (const k of keywordIds(d)) kwW.set(k, (kwW.get(k) ?? 0) + w);
      for (const p of peopleIds(d)) pplW.set(p, (pplW.get(p) ?? 0) + w);
    });

    // candidate pool
    const cands = new Map<number, { raw: RawAny | null; via?: number; hits: number }>();
    const usable = (id: number) => !exclude[kind].has(id) && !seeds.includes(id);
    seedRecs.forEach((res, i) => {
      for (const raw of ((res?.results ?? []) as RawAny[]).slice(0, 15)) {
        if (!raw.poster_path || !usable(raw.id)) continue;
        const c = cands.get(raw.id);
        if (c) c.hits++;
        else cands.set(raw.id, { raw, via: seeds[i], hits: 1 });
      }
    });
    for (const raw of (genreRes?.results ?? []) as RawAny[]) {
      if (raw.poster_path && usable(raw.id) && !cands.has(raw.id)) cands.set(raw.id, { raw, hits: 0 });
    }
    const cowatch = new Map<number, number>();
    for (const r of (cowatchRes?.data ?? []) as { tmdb_id: number; peers: number }[]) {
      cowatch.set(r.tmdb_id, Number(r.peers));
      if (usable(r.tmdb_id) && !cands.has(r.tmdb_id)) cands.set(r.tmdb_id, { raw: null, hits: 0 });
    }
    const maxPeers = Math.max(1, ...cowatch.values());

    const genreScore = (gs: number[]) => {
      if (!gs.length) return 0;
      let s = 0;
      for (const g of gs) s += (gw.get(g) ?? 0) / maxG;
      return Math.max(0, Math.min(1, s / Math.min(gs.length, 3)));
    };

    // first pass (cheap) → shortlist for detail enrichment
    const pre = [...cands.entries()]
      .map(([id, c]) => {
        const g = c.raw ? genreScore(c.raw.genre_ids ?? []) : 0.5;
        const comm = c.raw ? (c.raw.vote_average ?? 0) / 10 : 0.6;
        const co = (cowatch.get(id) ?? 0) / maxPeers;
        const kwGuess = Math.min(1, c.hits / 3);
        return { id, c, s: recommendationScore({ genre: g, keyword: kwGuess, community: comm, cowatch: co }) };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 32);

    const maxKw = Math.max(1, ...kwW.values());
    const maxPpl = Math.max(1, ...pplW.values());
    const enriched = await Promise.all(
      pre.map(async ({ id, c }) => {
        const d = await details(kind, id);
        if (!d || !d.poster_path) return null;
        const gs = (d.genres ?? []).map((g) => g.id);
        const kws = keywordIds(d);
        const ppl = peopleIds(d);
        let kwSum = 0;
        for (const k of kws) kwSum += (kwW.get(k) ?? 0) / maxKw;
        let pSum = 0;
        for (const p of ppl) pSum += (pplW.get(p) ?? 0) / maxPpl;
        const keyword = Math.min(1, kwSum / 4 + pSum / 3 + c.hits * 0.1);
        const genre = genreScore(gs);
        const community = Math.min(1, ((d.vote_average ?? 0) / 10) * Math.min(1, (d.vote_count ?? 0) / 200));
        const peers = cowatch.get(id) ?? 0;
        const co = peers / maxPeers;
        const score =
          recommendationScore({ genre, keyword, community, cowatch: co }) * (0.92 + rand() * 0.16);

        let reason: string;
        const viaTitle = c.via != null ? titles[kind].get(c.via) : undefined;
        if (peers >= 2 && co >= 0.5) reason = "Popular with people who share your taste";
        else if (viaTitle) reason = `Because you watched ${viaTitle}`;
        else {
          const best = (d.genres ?? []).sort((a, b) => (gw.get(b.id) ?? 0) - (gw.get(a.id) ?? 0))[0];
          reason = best ? `Because you like ${best.name}` : "Highly rated pick";
        }
        return {
          item: mapItem({ ...d, genre_ids: gs }, kind, reason),
          score,
          collection: d.belongs_to_collection?.id ?? null,
          primaryGenre: gs[0] ?? -1,
        };
      }),
    );

    // diversity: 1 per franchise, max 3 per primary genre in top 10, max 2 per "via" seed in top 10
    const sorted = enriched.filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.score - a.score);
    const out: MediaItem[] = [];
    const seenCol = new Set<number>();
    const genreCount = new Map<number, number>();
    const reasonCount = new Map<string, number>();
    const deferred: MediaItem[] = [];
    for (const x of sorted) {
      if (x.collection && seenCol.has(x.collection)) continue;
      const gc = genreCount.get(x.primaryGenre) ?? 0;
      const rc = reasonCount.get(x.item.reason ?? "") ?? 0;
      if (out.length < 10 && (gc >= 3 || rc >= 2)) {
        deferred.push(x.item);
        continue;
      }
      if (x.collection) seenCol.add(x.collection);
      genreCount.set(x.primaryGenre, gc + 1);
      reasonCount.set(x.item.reason ?? "", rc + 1);
      out.push(x.item);
    }
    return [...out, ...deferred].slice(0, 20);
  }

  const [tv, movie] = await Promise.all([forKind("tv"), forKind("movie")]);
  return { tv, movie };
}
