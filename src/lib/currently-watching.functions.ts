import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB_BASE = "https://api.themoviedb.org/3";

export interface CurrentlyWatchingItem {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  episodes_watched: number;
  total_episodes: number;
  next_season: number;
  next_episode: number;
  runtime_minutes: number | null;
  last_watched_at: string;
}

export const getCurrentlyWatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentlyWatchingItem[]> => {
    const [epsRes, droppedRes] = await Promise.all([
      context.supabase
        .from("watched_episodes")
        .select("tmdb_id, season_number, episode_number, watched_at")
        .eq("user_id", context.userId),
      context.supabase
        .from("watchlist")
        .select("tmdb_id")
        .eq("user_id", context.userId)
        .eq("media_type", "tv")
        .eq("status", "dropped"),
    ]);
    if (epsRes.error) throw epsRes.error;
    const eps = epsRes.data;
    const droppedIds = new Set<number>((droppedRes.data ?? []).map((r) => r.tmdb_id));

    const byShow = new Map<number, { watched: Set<string>; last: string; count: number }>();
    for (const e of eps ?? []) {
      if (droppedIds.has(e.tmdb_id)) continue;
      let cur = byShow.get(e.tmdb_id);
      if (!cur) {
        cur = { watched: new Set(), last: e.watched_at, count: 0 };
        byShow.set(e.tmdb_id, cur);
      }
      cur.watched.add(`${e.season_number}-${e.episode_number}`);
      cur.count++;
      if (e.watched_at > cur.last) cur.last = e.watched_at;
    }

    const showEntries = Array.from(byShow.entries()).sort((a, b) =>
      b[1].last > a[1].last ? 1 : -1,
    );

    if (showEntries.length === 0) return [];

    const key = process.env.TMDB_API_KEY;
    if (!key) throw new Error("TMDB_API_KEY not configured");

    const fetchShow = async (tmdb_id: number) => {
      try {
        const r = await fetch(`${TMDB_BASE}/tv/${tmdb_id}?api_key=${key}&language=en-US`);
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };

    const results = await Promise.all(
      showEntries.map(async ([tmdb_id, agg]) => {
        const details = await fetchShow(tmdb_id);
        if (!details) return null;
        const seasons = (details.seasons ?? []).filter(
          (s: { season_number: number }) => s.season_number > 0,
        );

        // Only count episodes that have already aired based on last_episode_to_air.
        const last = details.last_episode_to_air as
          | { season_number: number; episode_number: number }
          | null
          | undefined;

        const isAired = (season: number, episode: number) => {
          if (!last) return true;
          if (season < last.season_number) return true;
          if (season === last.season_number && episode <= last.episode_number) return true;
          return false;
        };

        // Total aired episodes across the whole series.
        let totalAired = 0;
        if (last) {
          for (const s of seasons) {
            const ec = s.episode_count ?? 0;
            if (s.season_number < last.season_number) totalAired += ec;
            else if (s.season_number === last.season_number)
              totalAired += Math.min(last.episode_number, ec || last.episode_number);
          }
        } else {
          totalAired = details.number_of_episodes ?? 0;
        }

        // Find the next unwatched aired episode.
        let next: { season: number; episode: number } | null = null;
        for (const s of seasons) {
          for (let ep = 1; ep <= (s.episode_count ?? 0); ep++) {
            if (!isAired(s.season_number, ep)) break;
            if (!agg.watched.has(`${s.season_number}-${ep}`)) {
              next = { season: s.season_number, episode: ep };
              break;
            }
          }
          if (next) break;
        }

        // Currently watching only if 0 < watched < totalAired and there IS a next aired episode.
        if (!next) return null;
        if (agg.count <= 0) return null;
        if (totalAired > 0 && agg.count >= totalAired) return null;

        return {
          tmdb_id,
          title: details.name ?? "Unknown",
          poster_path: details.poster_path ?? null,
          backdrop_path: details.backdrop_path ?? null,
          episodes_watched: agg.count,
          total_episodes: totalAired,
          next_season: next.season,
          next_episode: next.episode,
          runtime_minutes: details.episode_run_time?.[0] ?? null,
          last_watched_at: agg.last,
        } satisfies CurrentlyWatchingItem;
      }),
    );

    return results.filter((r): r is CurrentlyWatchingItem => r !== null);
  });
