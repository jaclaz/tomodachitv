import { createFileRoute } from "@tanstack/react-router";
import { tmdbFetch } from "@/lib/tmdb";

/**
 * Public showcase feed for the signed-out landing page.
 *
 * Returns only public TMDB metadata (title + image paths) — no user data, no
 * per-user signals. Cached in memory so a burst of visitors doesn't hammer TMDB.
 */
export const Route = createFileRoute("/api/public/showcase")({
  server: {
    handlers: {
      GET: async () => {
        const items = await getShowcase();
        return Response.json(items, {
          headers: { "cache-control": "public, max-age=600, stale-while-revalidate=3600" },
        });
      },
    },
  },
});

export interface ShowcaseItem {
  title: string;
  media_type: "tv" | "movie";
  poster_path: string | null;
  backdrop_path: string | null;
}

let cache: { at: number; items: ShowcaseItem[] } | null = null;
const TTL = 10 * 60 * 1000;

async function getShowcase(): Promise<ShowcaseItem[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.items;

  const [tv, movies] = await Promise.allSettled([
    tmdbFetch("/trending/tv/week", { language: "en-US" }),
    tmdbFetch("/trending/movie/week", { language: "en-US" }),
  ]);

  const items: ShowcaseItem[] = [];
  for (const [res, type] of [
    [tv, "tv"],
    [movies, "movie"],
  ] as const) {
    if (res.status !== "fulfilled") continue;
    for (const raw of (res.value.results ?? []) as Array<Record<string, unknown>>) {
      const title = (raw.title ?? raw.name) as string | undefined;
      const poster = raw.poster_path as string | null | undefined;
      const backdrop = raw.backdrop_path as string | null | undefined;
      if (!title || !poster || !backdrop) continue;
      items.push({ title, media_type: type, poster_path: poster, backdrop_path: backdrop });
    }
  }

  if (items.length) cache = { at: Date.now(), items };
  return items.slice(0, 40);
}
