import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importTvTime } from "@/lib/import.functions";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});

interface ImportResult {
  importedEpisodes: number;
  importedMovies: number;
  importedWatchlist: number;
  unresolvedShows: number;
  unresolvedMovies: number;
}

type Row = Record<string, string>;

function ImportPage() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      setProgress("Reading archive…");
      const zip = await JSZip.loadAsync(file);

      const csvs: Record<string, Row[]> = {};
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir || !name.toLowerCase().endsWith(".csv")) continue;
        const text = await entry.async("string");
        const parsed = Papa.parse<Row>(text, {
          header: true,
          skipEmptyLines: true,
        });
        csvs[name.split("/").pop() ?? name] = parsed.data;
      }

      if (!Object.keys(csvs).length) {
        throw new Error("No CSV files found in the archive.");
      }

      setProgress("Detecting your data…");
      const episodes: {
        tvdb_show_id: number;
        season_number: number;
        episode_number: number;
        watched_at: string | null;
      }[] = [];
      const watched_movies: {
        tmdb_id: number | null;
        imdb_id: string | null;
        title: string | null;
        year: number | null;
        runtime_minutes: number | null;
        watched_at: string | null;
      }[] = [];
      const follow_shows: { tvdb_show_id: number }[] = [];
      const follow_movies: {
        tmdb_id: number | null;
        imdb_id: string | null;
        title: string | null;
        year: number | null;
      }[] = [];

      const num = (v: string | undefined) => {
        const n = parseInt(v ?? "", 10);
        return Number.isFinite(n) ? n : NaN;
      };
      const yearOf = (v: string | undefined) => {
        if (!v) return null;
        const m = v.match(/(\d{4})/);
        return m ? parseInt(m[1], 10) : null;
      };

      for (const [name, rows] of Object.entries(csvs)) {
        if (!rows.length) continue;
        const cols = Object.keys(rows[0]);
        const has = (c: string) => cols.includes(c);
        const lname = name.toLowerCase();

        // TV Time v2 tracking: full watched-episode history
        if (lname.includes("tracking-prod-records-v2") && has("key") && has("s_id")) {
          for (const r of rows) {
            if (!(r.key ?? "").startsWith("watch-episode-")) continue;
            const tvdb = num(r.s_id);
            const s = num(r.season_number || r.s_no);
            const e = num(r.episode_number || r.ep_no);
            if (tvdb > 0 && s >= 0 && e > 0) {
              episodes.push({
                tvdb_show_id: tvdb,
                season_number: s,
                episode_number: e,
                watched_at: r.updated_at || r.created_at || null,
              });
            }
          }
          continue;
        }

        // TV Time v1 tracking: watched movies + movie watchlist (follow/towatch)
        if (lname.includes("tracking-prod-records") && has("entity_type") && has("type")) {
          for (const r of rows) {
            if ((r.entity_type ?? "").toLowerCase() !== "movie") continue;
            const t = (r.type ?? "").toLowerCase();
            const title = r.movie_name || r.series_name || null;
            const year = yearOf(r.release_date);
            const runtimeSec = num(r.runtime);
            const runtime_minutes =
              Number.isFinite(runtimeSec) && runtimeSec > 0
                ? Math.round(runtimeSec / 60)
                : null;
            if (t === "watch") {
              watched_movies.push({
                tmdb_id: null,
                imdb_id: null,
                title,
                year,
                runtime_minutes,
                watched_at: r.watch_date || r.updated_at || r.created_at || null,
              });
            } else if (t === "follow" || t === "towatch") {
              follow_movies.push({
                tmdb_id: null,
                imdb_id: null,
                title,
                year,
              });
            }
          }
          continue;
        }

        // TV Time: followed shows (watchlist)
        if (lname.includes("followed_tv_show") && has("tv_show_id")) {
          for (const r of rows) {
            if (r.archived === "1") continue;
            const tvdb = num(r.tv_show_id);
            if (tvdb > 0) follow_shows.push({ tvdb_show_id: tvdb });
          }
          continue;
        }

        // Fallback: generic episode CSV
        if (has("tv_show_id") && has("season_number") && has("episode_number")) {
          for (const r of rows) {
            const tvdb = num(r.tv_show_id);
            const s = num(r.season_number);
            const e = num(r.episode_number);
            if (tvdb > 0 && s >= 0 && e > 0) {
              episodes.push({
                tvdb_show_id: tvdb,
                season_number: s,
                episode_number: e,
                watched_at: r.updated_at || r.created_at || r.watched_at || null,
              });
            }
          }
        }
      }

      // Dedupe
      const uniq = <T,>(arr: T[], key: (x: T) => string) => {
        const m = new Map<string, T>();
        for (const x of arr) m.set(key(x), x);
        return [...m.values()];
      };
      const dedupEpisodes = uniq(
        episodes,
        (e) => `${e.tvdb_show_id}-${e.season_number}-${e.episode_number}`
      );
      const dedupFollowShows = uniq(follow_shows, (f) =>
        String(f.tvdb_show_id)
      );
      const dedupMovies = uniq(watched_movies, (m) =>
        String(m.tmdb_id ?? m.imdb_id ?? m.title ?? "")
      );
      const dedupFollowMovies = uniq(follow_movies, (m) =>
        String(m.tmdb_id ?? m.imdb_id ?? m.title ?? "")
      );

      if (
        !dedupEpisodes.length &&
        !dedupMovies.length &&
        !dedupFollowShows.length &&
        !dedupFollowMovies.length
      ) {
        throw new Error(
          "Couldn't recognise any TV Time data in this archive."
        );
      }

      setProgress(
        `Importing ${dedupEpisodes.length} episodes · ${dedupMovies.length} movies · ${
          dedupFollowShows.length + dedupFollowMovies.length
        } watchlist items…`
      );

      const res = await importTvTime({
        data: {
          episodes: dedupEpisodes,
          watched_movies: dedupMovies,
          follow_shows: dedupFollowShows,
          follow_movies: dedupFollowMovies,
        },
      });

      setResult(res);
      toast.success("Import complete");
      qc.invalidateQueries();
    } catch (err) {
      console.error(err);
      toast.error(
        "Import failed: " +
          (err instanceof Error ? err.message : "unknown error")
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-12 sm:pt-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Import from TV Time
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the ZIP archive TV Time gave you when you requested your data.
          We'll import your watched episodes, watched movies and watchlist.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-8">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-4 text-center">
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {busy ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">{progress}</p>
              <p className="text-xs text-muted-foreground">
                Large archives may take a couple of minutes.
              </p>
            </>
          ) : (
            <>
              <FileArchive className="h-10 w-10 text-primary" />
              <div>
                <p className="font-display text-base font-semibold">
                  Drop your TV Time ZIP here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The file is parsed in your browser before being sent.
                </p>
              </div>
              <Button type="button" variant="secondary">
                <Upload className="h-4 w-4" /> Choose file
              </Button>
            </>
          )}
        </label>
      </div>

      {result && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 font-display text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Import complete
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              Episodes imported:{" "}
              <span className="font-semibold text-foreground">
                {result.importedEpisodes}
              </span>
            </li>
            <li>
              Movies imported:{" "}
              <span className="font-semibold text-foreground">
                {result.importedMovies}
              </span>
            </li>
            <li>
              Watchlist items added:{" "}
              <span className="font-semibold text-foreground">
                {result.importedWatchlist}
              </span>
            </li>
            {result.unresolvedShows > 0 && (
              <li>Shows not found on TMDB: {result.unresolvedShows}</li>
            )}
            {result.unresolvedMovies > 0 && (
              <li>Movies not found on TMDB: {result.unresolvedMovies}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
