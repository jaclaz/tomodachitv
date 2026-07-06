import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getListWithItems, removeListItem } from "@/lib/lists.functions";
import { posterUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { PosterActions } from "@/components/poster-actions";
import { ArrowLeft, Globe, Lock, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/list/$id")({
  component: ListDetailPage,
});

function ListDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["list", id],
    queryFn: () => getListWithItems({ data: { id } }),
  });

  const removeMut = useMutation({
    mutationFn: (item: { media_type: "movie" | "tv"; tmdb_id: number }) =>
      removeListItem({
        data: { list_id: id, media_type: item.media_type, tmdb_id: item.tmdb_id },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list", id] });
      toast.success("Removed from list");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="pt-12 text-sm text-muted-foreground">Loading...</p>;
  if (!data) throw notFound();

  const { list, items } = data;
  const canEdit = true; // RLS filters; UI presence implies write access via own lists

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{list.title}</h1>
          <Badge variant="outline" className="gap-1 border-border">
            {list.is_public ? (
              <>
                <Globe className="h-3 w-3" /> Public
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" /> Private
              </>
            )}
          </Badge>
        </div>
        {list.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{list.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No items yet. Open a movie or series and use "Add to list".
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <Link
                to={item.media_type === "tv" ? "/serie/$id" : "/movie/$id"}
                params={{ id: String(item.tmdb_id) }}
                className="block overflow-hidden rounded-xl bg-card"
              >
                <div className="aspect-[2/3] overflow-hidden">
                  {item.poster_path ? (
                    <img
                      src={posterUrl(item.poster_path)}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                      {item.title.slice(0, 2)}
                    </div>
                  )}
                </div>
                <p className="line-clamp-1 p-2 text-sm font-medium">{item.title}</p>
              </Link>
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    removeMut.mutate({
                      media_type: item.media_type,
                      tmdb_id: item.tmdb_id,
                    })
                  }
                  className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-foreground opacity-0 shadow-sm transition-opacity hover:bg-background group-hover:opacity-100"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
