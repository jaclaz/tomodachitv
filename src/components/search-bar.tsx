import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { searchMulti, profileUrl, type SearchResultItem, type MediaItem } from "@/lib/tmdb";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from "@/lib/watchlist.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, User, Plus, Check } from "lucide-react";
import { toast } from "sonner";

function QuickAddButton({ item }: { item: MediaItem }) {
  const queryClient = useQueryClient();
  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => getWatchlist(),
  });
  const inLibrary = watchlist.some(
    (w) => w.media_type === item.media_type && w.tmdb_id === item.id,
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (inLibrary) {
        await removeFromWatchlist({
          data: { tmdb_id: item.id, media_type: item.media_type },
        });
        return { removed: true };
      }
      await addToWatchlist({
        data: {
          tmdb_id: item.id,
          media_type: item.media_type,
          series_name: item.title,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          first_air_date: item.release_date,
          vote_average: item.vote_average,
        },
      });
      return { removed: false };
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["watchlist"] });
      const prev = queryClient.getQueryData<WatchlistItem[]>(["watchlist"]);
      queryClient.setQueryData<WatchlistItem[]>(["watchlist"], (old = []) =>
        inLibrary
          ? old.filter(
              (w) => !(w.media_type === item.media_type && w.tmdb_id === item.id),
            )
          : [
              {
                id: `optimistic-${item.media_type}-${item.id}`,
                user_id: "",
                tmdb_id: item.id,
                media_type: item.media_type,
                series_name: item.title,
                poster_path: item.poster_path,
                backdrop_path: item.backdrop_path,
                first_air_date: item.release_date,
                vote_average: item.vote_average,
                added_at: new Date().toISOString(),
                status: "watching",
              } satisfies WatchlistItem,
              ...old,
            ],
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["watchlist"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: (r) => {
      toast.success(
        r.removed
          ? `"${item.title}" removed from your library`
          : `"${item.title}" added to your library`,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["currently-watching"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  return (
    <Button
      variant={inLibrary ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8 shrink-0"
      title={inLibrary ? "Remove from library" : "Add to library"}
      disabled={mutation.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate();
      }}
    >
      {inLibrary ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      <span className="sr-only">
        {inLibrary ? "Remove from library" : "Add to library"}
      </span>
    </Button>
  );
}


export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchMulti({ data: { query } }),
    enabled: query.length >= 2,
    staleTime: 1000 * 60,
  });

  const results = data?.results?.slice(0, 8) ?? [];

  const handleSelect = (item: SearchResultItem) => {
    setOpen(false);
    setQuery("");
    if (item.media_type === "tv") {
      navigate({ to: "/serie/$id", params: { id: String(item.id) } });
    } else if (item.media_type === "movie") {
      navigate({ to: "/movie/$id", params: { id: String(item.id) } });
    } else {
      navigate({ to: "/person/$id", params: { id: String(item.id) } });
    }
  };


  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search movies, TV shows, actors..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="border-border bg-surface pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-card p-2 shadow-2xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          {isFetching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No results.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((item) => (
                <li
                  key={`${item.media_type}-${item.id}`}
                  className="flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-surface"
                >
                  <button
                    onClick={() => handleSelect(item)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
                  >
                    {item.media_type === "person" ? (
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {item.profile_path ? (
                          <img
                            src={profileUrl(item.profile_path, "w185") || ""}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                    ) : (
                      <div className="flex h-10 w-7 items-center justify-center overflow-hidden rounded bg-muted text-xs font-bold text-muted-foreground">
                        {item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          item.title.slice(0, 1).toUpperCase()
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.media_type === "person" ? (
                          <>
                            Person
                            {item.known_for_department
                              ? ` · ${item.known_for_department}`
                              : ""}
                            {item.known_for_titles.length > 0
                              ? ` · ${item.known_for_titles.join(", ")}`
                              : ""}
                          </>
                        ) : (
                          <>
                            {item.media_type === "tv" ? "TV" : "Movie"}
                            {" · "}
                            {item.release_date
                              ? new Date(item.release_date).getFullYear()
                              : "—"}
                            {" · "}
                            {item.vote_average.toFixed(1)}
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                  {item.media_type !== "person" && (
                    <QuickAddButton item={item} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
