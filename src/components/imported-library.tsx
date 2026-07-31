import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Loader2, ListChecks } from "lucide-react";
import { listImportedLibrary, type ImportedLibraryEntry } from "@/lib/import.functions";

const SECTIONS: { key: keyof Awaited<ReturnType<typeof listImportedLibrary>>; label: string }[] = [
  { key: "watchingTv", label: "TV · Currently watching" },
  { key: "toWatchTv", label: "TV · To watch" },
  { key: "completedTv", label: "TV · Completed" },
  { key: "droppedTv", label: "TV · Dropped" },
  { key: "toWatchMovies", label: "Movies · To watch" },
  { key: "watchedMovies", label: "Movies · Watched" },
];

function Section({ label, items }: { label: string; items: ImportedLibraryEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {items.length}
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-border px-4 py-2">
          {items.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((item, i) => (
                <li key={`${item.media_type}-${item.tmdb_id}-${i}`} className="py-1.5">
                  <Link
                    to={item.media_type === "tv" ? "/serie/$id" : "/movie/$id"}
                    params={{ id: String(item.tmdb_id) }}
                    className="text-sm text-foreground hover:text-primary"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ImportedLibrary() {
  const { data, isLoading } = useQuery({
    queryKey: ["imported-library"],
    queryFn: () => listImportedLibrary(),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <div>
          <p className="font-display text-base font-semibold">Everything in your library</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All imported titles, grouped by status.
          </p>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {SECTIONS.map((s) => (
            <Section key={s.key} label={s.label} items={data[s.key]} />
          ))}
        </div>
      )}
    </div>
  );
}
