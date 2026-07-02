import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { searchSeries, type SeriesResult } from "@/lib/tmdb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchSeries({ data: { query } }),
    enabled: query.length >= 2,
    staleTime: 1000 * 60,
  });

  const results = data?.results?.slice(0, 6) ?? [];

  const handleSelect = (series: SeriesResult) => {
    setOpen(false);
    setQuery("");
    navigate({ to: "/serie/$id", params: { id: String(series.id) } });
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca una serie TV..."
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
            <p className="px-3 py-2 text-sm text-muted-foreground">Ricerca...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nessun risultato.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((series) => (
                <li key={series.id}>
                  <button
                    onClick={() => handleSelect(series)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
                  >
                    <div className="flex h-10 w-7 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
                      {series.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${series.poster_path}`}
                          alt=""
                          className="h-full w-full rounded object-cover"
                        />
                      ) : (
                        series.name.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{series.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {series.first_air_date
                          ? new Date(series.first_air_date).getFullYear()
                          : "—"}
                        {" · "}
                        {series.vote_average.toFixed(1)}
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
