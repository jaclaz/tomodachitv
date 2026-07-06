import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { searchMulti, profileUrl, type SearchResultItem } from "@/lib/tmdb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, User } from "lucide-react";

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
                <li key={`${item.media_type}-${item.id}`}>
                  <button
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
