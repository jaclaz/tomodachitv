import { useQuery } from "@tanstack/react-query";
import { getRelatedTitles } from "@/lib/tmdb";
import { PosterStrip, type PosterItem } from "@/components/poster-strip";
import { PosterActions } from "@/components/poster-actions";

export function RelatedTitles({ id, type }: { id: number; type: "movie" | "tv" }) {
  const { data = [] } = useQuery({
    queryKey: ["related-titles", type, id],
    queryFn: () => getRelatedTitles({ data: { id, type } }),
    staleTime: 1000 * 60 * 30,
  });

  if (data.length === 0) return null;

  const items: PosterItem[] = data.map((r) => ({
    tmdb_id: r.tmdb_id,
    title: r.title,
    poster_path: r.poster_path,
    media_type: r.media_type as "movie" | "tv",
  }));

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">You might also like</h2>
        <p className="text-xs text-muted-foreground">
          Similar in genre, style and cast.
        </p>
      </div>
      <PosterStrip
        items={items}
        emptyLabel="Nothing related found."
        max={20}
        actions={(item) => (
          <PosterActions
            media_type={item.media_type}
            tmdb_id={item.tmdb_id}
            title={item.title}
            poster_path={item.poster_path}
            size="sm"
          />
        )}
      />
    </section>
  );
}
