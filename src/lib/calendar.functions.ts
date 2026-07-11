import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MediaType } from "@/lib/tmdb";

const TMDB_BASE = "https://api.themoviedb.org/3";

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  return key;
}

async function tmdbFetch(path: string) {
  const key = getApiKey();
  const url = `${TMDB_BASE}${path}?api_key=${key}&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

export interface UpcomingItem {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string; // YYYY-MM-DD
  // TV-only extras
  season_number?: number;
  episode_number?: number;
  episode_name?: string;
}

export const getUpcomingReleases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UpcomingItem[]> => {
    const { data: watchlist, error } = await context.supabase
      .from("watchlist")
      .select("tmdb_id, media_type, series_name, poster_path, backdrop_path")
      .eq("user_id", context.userId);
    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await Promise.allSettled(
      (watchlist ?? []).map(async (w): Promise<UpcomingItem[]> => {
        try {
          const raw = await tmdbFetch(`/${w.media_type}/${w.tmdb_id}`);
          if (w.media_type === "movie") {
            const date: string | undefined = raw.release_date;
            if (!date) return [];
            const d = new Date(date);
            if (isNaN(d.getTime()) || d < today) return [];
            return [
              {
                tmdb_id: w.tmdb_id,
                media_type: "movie",
                title: raw.title ?? w.series_name,
                poster_path: raw.poster_path ?? w.poster_path,
                backdrop_path: raw.backdrop_path ?? w.backdrop_path,
                release_date: date,
              },
            ];
          } else {
            const next = raw.next_episode_to_air;
            if (!next?.season_number) return [];
            // Fetch the current upcoming season plus the next one (if any)
            // to catch all episodes with a known air date.
            const numSeasons: number = raw.number_of_seasons ?? next.season_number;
            const seasonNumbers = [next.season_number];
            if (next.season_number + 1 <= numSeasons) {
              seasonNumbers.push(next.season_number + 1);
            }
            const seasons = await Promise.all(
              seasonNumbers.map((sn) =>
                tmdbFetch(`/tv/${w.tmdb_id}/season/${sn}`).catch(() => null)
              )
            );
            const items: UpcomingItem[] = [];
            for (const season of seasons) {
              if (!season?.episodes) continue;
              for (const ep of season.episodes) {
                if (!ep.air_date) continue;
                const d = new Date(ep.air_date);
                if (isNaN(d.getTime()) || d < today) continue;
                items.push({
                  tmdb_id: w.tmdb_id,
                  media_type: "tv",
                  title: raw.name ?? w.series_name,
                  poster_path: raw.poster_path ?? w.poster_path,
                  backdrop_path: raw.backdrop_path ?? w.backdrop_path,
                  release_date: ep.air_date,
                  season_number: ep.season_number,
                  episode_number: ep.episode_number,
                  episode_name: ep.name,
                });
              }
            }
            return items;
          }
        } catch {
          return [];
        }
      })
    );

    const items: UpcomingItem[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") items.push(...r.value);
    }
    items.sort((a, b) => a.release_date.localeCompare(b.release_date));
    return items;
  });

