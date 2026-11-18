// TMDB's `last_episode_to_air` lags on release day (episodes out "today"
// stay in `next_episode_to_air`). Resolve the real aired position by
// checking the season's episode air dates when the next episode is due.
const TMDB = "https://api.themoviedb.org/3";

type Details = {
  id?: number;
  seasons?: Array<{ season_number: number; episode_count?: number }>;
  last_episode_to_air?: { season_number: number; episode_number: number; air_date?: string | null } | null;
  next_episode_to_air?: { season_number: number; episode_number: number; air_date?: string | null } | null;
};

export async function resolveLastAired(
  d: Details,
  tmdbId: number,
): Promise<{ season_number: number; episode_number: number; air_date?: string | null } | null> {
  const today = new Date().toISOString().slice(0, 10);
  let last = d.last_episode_to_air ?? null;
  if (last?.air_date && last.air_date > today) last = null;
  const next = d.next_episode_to_air;
  if (next?.air_date && next.air_date <= today) {
    const key = process.env.TMDB_API_KEY;
    try {
      const r = await fetch(`${TMDB}/tv/${tmdbId}/season/${next.season_number}?api_key=${key}`);
      if (r.ok) {
        const s = await r.json();
        let maxEp = next.episode_number;
        for (const e of s.episodes ?? [])
          if (e.air_date && e.air_date <= today && e.episode_number > maxEp) maxEp = e.episode_number;
        return { season_number: next.season_number, episode_number: maxEp, air_date: today };
      }
    } catch {
      /* fall through */
    }
    return { season_number: next.season_number, episode_number: next.episode_number, air_date: today };
  }
  return last;
}

export function countAired(
  d: Details,
  last: { season_number: number; episode_number: number } | null,
): number | null {
  if (!last) return null;
  let total = 0;
  for (const s of d.seasons ?? []) {
    if (s.season_number <= 0) continue;
    const ec = s.episode_count ?? 0;
    if (s.season_number < last.season_number) total += ec;
    else if (s.season_number === last.season_number)
      total += Math.min(last.episode_number, ec || last.episode_number);
  }
  return total;
}
