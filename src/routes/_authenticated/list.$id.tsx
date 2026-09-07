import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  getListWithItems,
  removeListItem,
  saveList,
  unsaveList,
} from "@/lib/lists.functions";
import { posterUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PosterActions } from "@/components/poster-actions";
import { ArrowLeft, Bookmark, BookmarkCheck, Globe, Lock, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/list/$id")({
  component: ListDetailPage,
});

function ListDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

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

  const saveMut = useMutation({
    mutationFn: (save: boolean) =>
      save ? saveList({ data: { list_id: id } }) : unsaveList({ data: { list_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list", id] });
      qc.invalidateQueries({ queryKey: ["trending-lists"] });
      qc.invalidateQueries({ queryKey: ["saved-lists"] });

    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!data) throw notFound();

  const { list, items } = data;
  const isOwner = myId === list.user_id;
  const canEdit = isOwner;
  const canSave = list.is_public && !isOwner && myId !== null;


  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
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
          {canSave && (
            <Button
              size="sm"
              variant={list.is_saved_by_me ? "secondary" : "default"}
              onClick={() => saveMut.mutate(!list.is_saved_by_me)}
              disabled={saveMut.isPending}
              className="ml-auto gap-1.5"
            >
              {list.is_saved_by_me ? (
                <>
                  <BookmarkCheck className="h-4 w-4" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          )}
        </div>
        {list.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{list.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
          {list.is_public && (
            <>
              {" · "}
              {list.saves_count ?? 0} save{(list.saves_count ?? 0) === 1 ? "" : "s"}
            </>
          )}
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
              </Link>
              <div className="flex items-start justify-between p-2">
                <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                <PosterActions
                  media_type={item.media_type}
                  tmdb_id={item.tmdb_id}
                  title={item.title}
                  poster_path={item.poster_path}
                />
              </div>
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
