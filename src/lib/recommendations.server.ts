import type { MediaItem } from "./tmdb";

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
  popularity?: number;
  first_air_date?: string;
  release_date?: string;
  genre_ids?: number[];
}

function mapItem(r: RawAny, kind: Kind): MediaItem {
  return {
    id: r.id,
    media_type: kind,
    title: (kind === "tv" ? r.name : r.title) ?? "",
    overview: r.overview ?? "",
    poster_path: r.poster_path,
    backdrop_path: r.backdrop_path,
    vote_average: r.vote_average ?? 0,
    release_date: (kind === "tv" ? r.first_air_date : r.release_date) || null,
  };
}

async function fetchTmdb(path: string, params?: Record<string, string>) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  const query = new URLSearchParams({
    api_key: key,
    language: "en-US",
    ...params,
  });
  const res = await fetch(`${TMDB_BASE}${path}?${query.toString()}`);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let rng = Math.abs(seed) + 1;
  for (let i = copy.length - 1; i > 0; i--) {
    rng = (rng * 9301 + 49297) % 233280;
    const j = Math.floor((rng / 233280) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function collectAll(
  supabase: any,
  table: string,
  userId: string,
  cols: string,
): Promise<any[]> {
  const PAGE = 1000;
  const out: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(cols)
      .eq("user_id", userId)
      .range(from, from + PAGE - 1);
    if (error) break;
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

interface Scored {
  item: MediaItem;
  score: number;
  source: "similar" | "genre" | "discovery";
}

function interleave(pools: Scored[][], quotas: number[], limit: number): MediaItem[] {
  const taken = new Set<number>();
  const out: MediaItem[] = [];
  const cursors = pools.map(() => 0);
  const counts = pools.map(() => 0);
  let progress = true;
  while (out.length < limit && progress) {
    progress = false;
    for (let p = 0; p < pools.length; p++) {
      if (counts[p] >= quotas[p]) continue;
      const pool = pools[p];
      while (cursors[p] < pool.length && taken.has(pool[cursors[p]].item.id)) {
        cursors[p]++;
      }
      if (cursors[p] >= pool.length) continue;
      const pick = pool[cursors[p]++];
      taken.add(pick.item.id);
      out.push(pick.item);
      counts[p]++;
      progress = true;
      if (out.length >= limit) break;
    }
  }
  // fill remaining slots from any pool
  if (out.length < limit) {
    for (const pool of pools) {
      for (const s of pool) {
        if (out.length >= limit) break;
        if (taken.has(s.item.id)) continue;
        taken.add(s.item.id);
        out.push(s.item);
      }
    }
  }
  return out.slice(0, limit);
}

export async function buildRecommendations(
  supabase: any,
  userId: string,
  seed: number,
): Promise<{ tv: MediaItem[]; movie: MediaItem[] }> {
  const [ratings, favorites, episodes, movies, watchlist, dropped, dismissed] =
    await Promise.all([
      collectAll(supabase, "user_ratings", userId, "media_type, tmdb_id, rating, updated_at"),
      collectAll(supabase, "favorites", userId, "media_type, tmdb_id, added_at"),
      collectAll(supabase, "watched_episodes", userId, "tmdb_id, watched_at"),
      collectAll(supabase, "watched_movies", userId, "tmdb_id, watched_at"),
      collectAll(supabase, "watchlist", userId, "tmdb_id, media_type"),
      collectAll(supabase, "dropped_shows", userId, "tmdb_id"),
      collectAll(supabase, "recommendation_dismissals", userId, "tmdb_id, media_type"),
    ]);

  // ---- exclusions ----
  const excludeTv = new Set<number>();
  const excludeMovie = new Set<number>();
  for (const e of episodes) excludeTv.add(e.tmdb_id);
  for (const d of dropped) excludeTv.add(d.tmdb_id);
  for (const m of movies) excludeMovie.add(m.tmdb_id);
  for (const w of watchlist)
    (w.media_type === "movie" ? excludeMovie : excludeTv).add(w.tmdb_id);
  for (const d of dismissed)
    (d.media_type === "movie" ? excludeMovie : excludeTv).add(d.tmdb_id);


  // ---- taste profile from ratings + favorites + recency ----
  const now = Date.now();
  const recencyWeight = (d?: string | null) => {
    if (!d) return 0.5;
    const days = (now - new Date(d).getTime()) / 86400000;
    if (!Number.isFinite(days)) return 0.5;
    return days < 30 ? 1.5 : days < 120 ? 1.1 : days < 365 ? 0.8 : 0.5;
  };

  // weight per library title (positive or negative)
  const titleWeight = new Map<string, number>(); // `${type}-${id}` -> weight
  const bump = (type: Kind, id: number, w: number) => {
    const k = `${type}-${id}`;
    titleWeight.set(k, (titleWeight.get(k) ?? 0) + w);
  };

  const lastEpisodeAt = new Map<number, string>();
  for (const e of episodes) {
    const prev = lastEpisodeAt.get(e.tmdb_id);
    if (!prev || (e.watched_at ?? "") > prev) lastEpisodeAt.set(e.tmdb_id, e.watched_at);
  }
  for (const [id, at] of lastEpisodeAt) bump("tv", id, recencyWeight(at));
  for (const m of movies) bump("movie", m.tmdb_id, recencyWeight(m.watched_at));
  for (const f of favorites)
    bump(f.media_type === "movie" ? "movie" : "tv", f.tmdb_id, 2.5);

  const positives: { type: Kind; id: number; w: number }[] = [];
  const negatives: { type: Kind; id: number }[] = [];
  for (const r of ratings) {
    const type: Kind = r.media_type === "movie" ? "movie" : "tv";
    const rating = Number(r.rating) || 0;
    if (rating >= 4) {
      bump(type, r.tmdb_id, 3 + (rating - 4) * 2);
      positives.push({ type, id: r.tmdb_id, w: rating });
    } else if (rating <= 2) {
      bump(type, r.tmdb_id, -3);
      negatives.push({ type, id: r.tmdb_id });
    }
  }

  // ---- genre weights via media_cache ----
  const genreWeights: Record<Kind, Map<number, number>> = {
    tv: new Map(),
    movie: new Map(),
  };
  const keys = [...titleWeight.keys()];
  const ids: Record<Kind, number[]> = { tv: [], movie: [] };
  for (const k of keys) {
    const [type, idStr] = k.split("-");
    ids[type as Kind].push(Number(idStr));
  }
  const CHUNK = 300;
  await Promise.all(
    (["tv", "movie"] as Kind[]).map(async (kind) => {
      const list = ids[kind];
      for (let i = 0; i < list.length; i += CHUNK) {
        const slice = list.slice(i, i + CHUNK);
        const { data } = await supabase
          .from("media_cache")
          .select("tmdb_id, genre_ids")
          .eq("media_type", kind)
          .in("tmdb_id", slice);
        for (const row of data ?? []) {
          const w = titleWeight.get(`${kind}-${row.tmdb_id}`) ?? 0;
          for (const g of (row.genre_ids ?? []) as number[]) {
            genreWeights[kind].set(g, (genreWeights[kind].get(g) ?? 0) + w);
          }
        }
      }
    }),
  );

  const topGenres = (kind: Kind, n: number) =>
    [...genreWeights[kind].entries()]
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([g]) => g);
  const badGenres = (kind: Kind) =>
    new Set(
      [...genreWeights[kind].entries()]
        .filter(([, w]) => w < 0)
        .map(([g]) => g),
    );
  const maxGenreWeight = (kind: Kind) =>
    Math.max(1, ...[...genreWeights[kind].values()].map((w) => Math.abs(w)));

  async function forKind(kind: Kind): Promise<MediaItem[]> {
    const exclude = kind === "tv" ? excludeTv : excludeMovie;

    // seeds: favorites + high ratings first, then recently watched
    const likedIds = [
      ...new Set([
        ...favorites
          .filter((f: any) => (f.media_type === "movie" ? "movie" : "tv") === kind)
          .map((f: any) => f.tmdb_id as number),
        ...positives.filter((p) => p.type === kind).map((p) => p.id),
      ]),
    ];
    const recentIds = [
      ...new Set(
        kind === "tv"
          ? [...lastEpisodeAt.entries()]
              .sort((a, b) => (b[1] ?? "").localeCompare(a[1] ?? ""))
              .map(([id]) => id)
          : [...movies]
              .sort((a: any, b: any) =>
                (b.watched_at ?? "").localeCompare(a.watched_at ?? ""),
              )
              .map((m: any) => m.tmdb_id as number),
      ),
    ].slice(0, 40);

    const seedOffset = kind === "tv" ? 0 : 7;
    const seeds = [
      ...shuffle(likedIds, seed + seedOffset).slice(0, 4),
      ...shuffle(recentIds, seed + seedOffset + 1).slice(0, 3),
    ];
    const seedSet = new Set(seeds);

    const genres = topGenres(kind, 6);
    const gShuffled = shuffle(genres, seed + seedOffset + 2);
    const genreParam = gShuffled.slice(0, 3).join(",");
    const discoveryGenreParam = gShuffled.slice(0, 2).join(",") || genreParam;
    const maxW = maxGenreWeight(kind);
    const bad = badGenres(kind);

    const page = (seed % 3) + 1;
    const dateField = kind === "tv" ? "first_air_date" : "primary_release_date";

    const [similarRes, genreRes, discoveryRes] = await Promise.all([
      Promise.all(
        seeds.map((id) =>
          fetchTmdb(`/${kind}/${id}/recommendations`).catch(() => null),
        ),
      ),
      genreParam
        ? fetchTmdb(`/discover/${kind}`, {
            with_genres: genreParam,
            sort_by: "vote_average.desc",
            "vote_count.gte": "200",
            page: String(page),
          }).catch(() => null)
        : Promise.resolve(null),
      discoveryGenreParam
        ? fetchTmdb(`/discover/${kind}`, {
            with_genres: discoveryGenreParam,
            sort_by: "vote_average.desc",
            "vote_count.gte": "50",
            "vote_count.lte": "1500",
            [`${dateField}.gte`]: "1990-01-01",
            page: String(((seed * 3) % 5) + 1),
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const score = (raw: RawAny) => {
      const gs = (raw.genre_ids ?? []) as number[];
      let affinity = 0;
      for (const g of gs) {
        const w = genreWeights[kind].get(g) ?? 0;
        affinity += w / maxW;
      }
      const penalty = gs.some((g) => bad.has(g)) ? 1.5 : 0;
      const quality = ((raw.vote_average ?? 0) - 6) / 4;
      return affinity * 1.2 + quality - penalty;
    };

    const usable = (raw: RawAny) =>
      raw.poster_path && !exclude.has(raw.id) && !seedSet.has(raw.id);

    // similar pool: frequency across seeds + affinity
    const similarMap = new Map<number, Scored>();
    for (const res of similarRes) {
      for (const raw of ((res?.results ?? []) as RawAny[]).slice(0, 20)) {
        if (!usable(raw)) continue;
        const existing = similarMap.get(raw.id);
        if (existing) existing.score += 1;
        else
          similarMap.set(raw.id, {
            item: mapItem(raw, kind),
            score: 1 + score(raw),
            source: "similar",
          });
      }
    }

    const buildPool = (
      res: any,
      source: Scored["source"],
    ): Scored[] =>
      ((res?.results ?? []) as RawAny[])
        .filter(usable)
        .map((raw) => ({ item: mapItem(raw, kind), score: score(raw), source }))
        .sort((a, b) => b.score - a.score);

    const similarPool = [...similarMap.values()].sort((a, b) => b.score - a.score);
    const genrePool = shuffle(buildPool(genreRes, "genre"), seed + seedOffset + 3);
    const discoveryPool = shuffle(
      buildPool(discoveryRes, "discovery"),
      seed + seedOffset + 4,
    );

    return interleave([similarPool, genrePool, discoveryPool], [8, 7, 5], 20);
  }

  const [tv, movie] = await Promise.all([forKind("tv"), forKind("movie")]);
  return { tv, movie };
}
