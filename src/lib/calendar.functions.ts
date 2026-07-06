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
      (watchlist ?? []).map(async (w): Promise<UpcomingItem | null> => {
        try {
          const raw = await tmdbFetch(`/${w.media_type}/${w.tmdb_id}`);
          if (w.media_type === "movie") {
            const date: string | undefined = raw.release_date;
            if (!date) return null;
            const d = new Date(date);
            if (isNaN(d.getTime()) || d < today) return null;
            return {
              tmdb_id: w.tmdb_id,
              media_type: "movie",
              title: raw.title ?? w.series_name,
              poster_path: raw.poster_path ?? w.poster_path,
              backdrop_path: raw.backdrop_path ?? w.backdrop_path,
              release_date: date,
            };
          } else {
            const next = raw.next_episode_to_air;
            if (!next?.air_date) return null;
            const d = new Date(next.air_date);
            if (isNaN(d.getTime()) || d < today) return null;
            return {
              tmdb_id: w.tmdb_id,
              media_type: "tv",
              title: raw.name ?? w.series_name,
              poster_path: raw.poster_path ?? w.poster_path,
              backdrop_path: raw.backdrop_path ?? w.backdrop_path,
              release_date: next.air_date,
              season_number: next.season_number,
              episode_number: next.episode_number,
              episode_name: next.name,
            };
          }
        } catch {
          return null;
        }
      })
    );

    const items: UpcomingItem[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) items.push(r.value);
    }
    items.sort((a, b) => a.release_date.localeCompare(b.release_date));
    return items;
  });
