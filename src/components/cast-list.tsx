import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCredits, profileUrl, type MediaType } from "@/lib/tmdb";

interface CastListProps {
  id: number;
  type: MediaType;
  limit?: number;
}

export function CastList({ id, type, limit = 18 }: CastListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["credits", type, id],
    queryFn: () => getCredits({ data: { id, type } }),
  });

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Cast</h2>
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </section>
    );
  }

  const cast = (data?.cast ?? []).slice(0, limit);
  if (cast.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground">Cast</h2>
      <div className="-mx-1 overflow-x-auto pb-2">
        <ul className="flex gap-3 px-1">
          {cast.map((c) => {
            const img = profileUrl(c.profile_path);
            return (
              <li key={`${c.id}-${c.character}`} className="w-32 flex-shrink-0">
                <Link
                  to="/person/$id"
                  params={{ id: String(c.id) }}
                  className="group block space-y-2 rounded-xl border border-border bg-surface p-2 transition-colors hover:border-primary/60"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                    {img ? (
                      <img
                        src={img}
                        alt={c.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-display text-xl font-bold text-muted-foreground">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">
                      {c.name}
                    </p>
                    {c.character && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {c.character}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
