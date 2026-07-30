import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Check, Loader2, RefreshCw, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listFailedImports,
  searchTmdbForImport,
  resolveFailedManually,
  discardFailedGroup,
  requeueFailedImports,
} from "@/lib/import.functions";

type FailedGroup = {
  kind: string;
  source: string;
  source_id: string;
  title: string | null;
  year: number | null;
  last_error: string | null;
  items: number;
};

type SearchResult = {
  id: number;
  title: string;
  year: string | null;
  poster_path: string | null;
  overview: string;
};

const kindLabel: Record<string, string> = {
  watched_episode: "Watched episodes",
  follow_show: "Series in library",
  watched_movie: "Watched movie",
  follow_movie: "Movie in library",
};

function isTvKind(kind: string) {
  return kind === "watched_episode" || kind === "follow_show";
}

function GroupRow({ group, onChanged }: { group: FailedGroup; onChanged: () => void }) {
  const mediaType = isTvKind(group.kind) ? "tv" : "movie";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(group.title ?? "");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await searchTmdbForImport({ data: { query, mediaType } });
      setResults(r as SearchResult[]);
    } catch {
      toast.error("Search failed, try again");
    } finally {
      setSearching(false);
    }
  };

  const link = async (tmdbId: number) => {
    setSaving(tmdbId);
    try {
      const r = await resolveFailedManually({
        data: { kind: group.kind, source: group.source, source_id: group.source_id, tmdbId },
      });
      toast.success(`Imported ${r.imported} item${r.imported === 1 ? "" : "s"}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import this title");
    } finally {
      setSaving(null);
    }
  };

  const discard = async () => {
    try {
      await discardFailedGroup({
        data: { kind: group.kind, source: group.source, source_id: group.source_id },
      });
      onChanged();
    } catch {
      toast.error("Could not remove this entry");
    }
  };

  return (
    <li className="rounded-xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {group.title || `Unknown title (${group.source} #${group.source_id})`}
            {group.year ? <span className="text-muted-foreground"> ({group.year})</span> : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {kindLabel[group.kind] ?? group.kind} · {group.items} row{group.items === 1 ? "" : "s"} ·
            source {group.source} #{group.source_id}
          </p>
          {group.last_error && (
            <p className="mt-1 text-xs text-muted-foreground/80">{group.last_error}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            {open ? "Close" : "Match manually"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={discard}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSearch();
                }
              }}
              placeholder={`Search ${mediaType === "tv" ? "a series" : "a movie"} on TMDB…`}
            />
            <Button type="button" onClick={runSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {results && results.length === 0 && (
            <p className="text-xs text-muted-foreground">No results for “{query}”.</p>
          )}

          {results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
                >
                  {r.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${r.poster_path}`}
                      alt={r.title}
                      loading="lazy"
                      className="h-16 w-11 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-16 w-11 shrink-0 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.title} {r.year ? <span className="text-muted-foreground">({r.year})</span> : null}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{r.overview}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => link(r.id)}
                    disabled={saving !== null}
                  >
                    {saving === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Use this
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function UnmatchedImports({ onChanged }: { onChanged?: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["failed-imports"],
    queryFn: () => listFailedImports() as Promise<FailedGroup[]>,
  });

  const refresh = async () => {
    await refetch();
    await queryClient.invalidateQueries();
    onChanged?.();
  };

  if (isLoading || !data || data.length === 0) return null;

  return (
    <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-display text-base font-semibold">
              {data.length} title{data.length === 1 ? "" : "s"} couldn't be imported
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Search the right entry on TMDB and link it — every row of that title gets imported at
              once. Or remove it from the queue.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            await requeueFailedImports();
            await refresh();
          }}
        >
          <RefreshCw className="h-4 w-4" /> Retry all automatically
        </Button>
      </div>

      <ul className="space-y-3">
        {data.map((g) => (
          <GroupRow key={`${g.kind}-${g.source}-${g.source_id}`} group={g} onChanged={refresh} />
        ))}
      </ul>
    </div>
  );
}
