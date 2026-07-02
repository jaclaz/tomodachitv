import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWatchlist, removeFromWatchlist } from "@/lib/watchlist.functions";
import { posterUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Trash2, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/watchlist")({
  component: WatchlistPage,
});

function WatchlistPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });

  const removeMutation = useMutation({
    mutationFn: (tmdb_id: number) => removeFromWatchlist({ data: { tmdb_id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold text-foreground">
          La mia lista
        </h1>
        <p className="text-sm text-muted-foreground">
          Le serie che vuoi seguire o stai già guardando.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <h3 className="font-display text-lg font-semibold">Lista vuota</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Esplora le serie e aggiungi quelle che ti interessano.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Esplora</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {data.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-xl bg-card"
            >
              <Link to="/serie/$id" params={{ id: String(item.tmdb_id) }}>
                <div className="aspect-[2/3] overflow-hidden">
                  {item.poster_path ? (
                    <img
                      src={posterUrl(item.poster_path)}
                      alt={item.series_name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <span className="font-display text-2xl font-bold text-muted-foreground">
                        {item.series_name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => removeMutation.mutate(item.tmdb_id)}
              >
                <Trash2 className="h-4 w-4 text-accent" />
              </Button>
              <div className="p-3">
                <h3 className="font-display text-sm font-semibold text-foreground line-clamp-1">
                  {item.series_name}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-rating text-rating" />
                  {item.vote_average?.toFixed(1) ?? "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
