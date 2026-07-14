import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, FileArchive, Download, RefreshCw, AlertCircle, Trash2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  resolveShowsBatch,
  resolveMoviesBatch,
  bulkInsertEpisodes,
  bulkInsertWatchedMovies,
  bulkInsertWatchlist,
  savePendingImports,
  getPendingImportsCount,
  retryPendingImports,
  exportLibrary,
  cleanupWatchedFromWatchlist,
  resetLibrary,
} from "@/lib/import.functions";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});

type Row = Record<string, string>;

interface Counts {
  showsFollowed: number;
  moviesFollowed: number;
  episodesWatched: number;
  moviesWatched: number;
  unresolved: number;
}

const num = (v: string | undefined | null) => {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : NaN;
};
const yearOf = (v: string | undefined | null) => {
  if (!v) return null;
  const m = v.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
};

interface Parsed {
  // shows to follow: mix of tvdb and tmdb ids
  followShowsTvdb: Map<number, { title?: string | null }>;
  followShowsTmdb: Map<number, { title?: string | null }>;
  // episodes watched — keyed by (source, id, s, e)
  episodes: {
    tvdb_id?: number;
    tmdb_id?: number;
    season_number: number;
    episode_number: number;
    watched_at: string | null;
  }[];
  // movies watched / to watch
  watchedMovies: {
    tmdb_id?: number;
    imdb_id?: string;
    title?: string | null;
    year?: number | null;
    runtime_minutes?: number | null;
    watched_at?: string | null;
    source_id: string; // stable identifier for pending fallback
    source: "tmdb" | "imdb" | "name";
  }[];
  followMovies: {
    tmdb_id?: number;
    imdb_id?: string;
    title?: string | null;
    year?: number | null;
    source_id: string;
    source: "tmdb" | "imdb" | "name";
  }[];
}

function parseArchive(csvs: Record<string, Row[]>): Parsed {
  const out: Parsed = {
    followShowsTvdb: new Map(),
    followShowsTmdb: new Map(),
    episodes: [],
    watchedMovies: [],
    followMovies: [],
  };

  for (const [name, rows] of Object.entries(csvs)) {
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const has = (c: string) => cols.includes(c);
    const lname = name.toLowerCase();

    // Tomodachi's own export ---------------------------------
    if (lname === "tomodachi_watched_episodes.csv" && has("tmdb_show_id")) {
      for (const r of rows) {
        const tmdb = num(r.tmdb_show_id);
        const s = num(r.season_number);
        const e = num(r.episode_number);
        if (tmdb > 0 && s >= 0 && e > 0) {
          out.episodes.push({
            tmdb_id: tmdb,
            season_number: s,
            episode_number: e,
            watched_at: r.watched_at || null,
          });
          if (!out.followShowsTmdb.has(tmdb)) out.followShowsTmdb.set(tmdb, {});
        }
      }
      continue;
    }
    if (lname === "tomodachi_watched_movies.csv" && has("tmdb_id")) {
      for (const r of rows) {
        const tmdb = num(r.tmdb_id);
        if (!(tmdb > 0)) continue;
        const runtime = num(r.runtime_minutes);
        out.watchedMovies.push({
          tmdb_id: tmdb,
          title: r.title || null,
          runtime_minutes: Number.isFinite(runtime) && runtime > 0 ? runtime : null,
          watched_at: r.watched_at || null,
          source: "tmdb",
          source_id: String(tmdb),
        });
      }
      continue;
    }
    if (lname === "tomodachi_watchlist.csv" && has("tmdb_id") && has("media_type")) {
      for (const r of rows) {
        const tmdb = num(r.tmdb_id);
        if (!(tmdb > 0)) continue;
        if ((r.media_type ?? "").toLowerCase() === "tv") {
          out.followShowsTmdb.set(tmdb, { title: r.series_name || null });
        } else {
          out.followMovies.push({
            tmdb_id: tmdb,
            title: r.series_name || null,
            source: "tmdb",
            source_id: String(tmdb),
          });
        }
      }
      continue;
    }

    // TV Time v2 tracking: full watched-episode history (tvdb-based)
    if (lname.includes("tracking-prod-records-v2") && has("key") && has("s_id")) {
      for (const r of rows) {
        if (!(r.key ?? "").startsWith("watch-episode-")) continue;
        const tvdb = num(r.s_id);
        const s = num(r.season_number || r.s_no);
        const e = num(r.episode_number || r.ep_no);
        if (tvdb > 0 && s >= 0 && e > 0) {
          out.episodes.push({
            tvdb_id: tvdb,
            season_number: s,
            episode_number: e,
            watched_at: r.updated_at || r.created_at || null,
          });
          if (!out.followShowsTvdb.has(tvdb))
            out.followShowsTvdb.set(tvdb, { title: r.series_name || null });
        }
      }
      continue;
    }

    // TV Time v1 tracking: movies (watch/follow/towatch)
    if (lname.includes("tracking-prod-records") && has("entity_type") && has("type")) {
      for (const r of rows) {
        if ((r.entity_type ?? "").toLowerCase() !== "movie") continue;
        const t = (r.type ?? "").toLowerCase();
        const title = r.movie_name || null;
        const year = yearOf(r.release_date);
        const runtimeSec = num(r.runtime);
        const runtime_minutes =
          Number.isFinite(runtimeSec) && runtimeSec > 0 ? Math.round(runtimeSec / 60) : null;
        const source_id = (r.uuid || `${(title ?? "").toLowerCase()}|${year ?? ""}`).trim();
        if (t === "watch") {
          out.watchedMovies.push({
            title,
            year,
            runtime_minutes,
            watched_at: r.watch_date || r.updated_at || r.created_at || null,
            source: "name",
            source_id,
          });
        } else if (t === "follow" || t === "towatch") {
          out.followMovies.push({
            title,
            year,
            source: "name",
            source_id,
          });
        }
      }
      continue;
    }

    // TV Time: followed shows via user_tv_show_data.csv (tvdb ids)
    if (lname === "user_tv_show_data.csv" && has("tv_show_id")) {
      for (const r of rows) {
        if (r.is_followed && r.is_followed !== "1") continue;
        const tvdb = num(r.tv_show_id);
        if (tvdb > 0) {
          out.followShowsTvdb.set(tvdb, { title: r.tv_show_name || null });
        }
      }
      continue;
    }

    // Legacy: followed_tv_show.csv
    if (lname.includes("followed_tv_show") && has("tv_show_id")) {
      for (const r of rows) {
        if (r.archived === "1") continue;
        const tvdb = num(r.tv_show_id);
        if (tvdb > 0 && !out.followShowsTvdb.has(tvdb)) out.followShowsTvdb.set(tvdb, {});
      }
      continue;
    }
  }

  // Dedupe episodes
  const epKey = (e: (typeof out.episodes)[number]) =>
    `${e.tmdb_id ? "tmdb:" + e.tmdb_id : "tvdb:" + e.tvdb_id}-${e.season_number}-${e.episode_number}`;
  const ep = new Map<string, (typeof out.episodes)[number]>();
  for (const e of out.episodes) ep.set(epKey(e), e);
  out.episodes = [...ep.values()];

  // Dedupe movies
  const dedup = <T extends { source_id: string; source: string }>(arr: T[]) => {
    const m = new Map<string, T>();
    for (const x of arr) m.set(`${x.source}:${x.source_id}`, x);
    return [...m.values()];
  };
  out.watchedMovies = dedup(out.watchedMovies);
  out.followMovies = dedup(out.followMovies);

  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type PendingImportRow = Parameters<typeof savePendingImports>[0]["data"]["rows"][number];

function dedupePendingRows(rows: PendingImportRow[]): PendingImportRow[] {
  const dedup = new Map<string, PendingImportRow>();
  for (const row of rows) {
    if (!row?.kind || !row.source || !row.source_id) continue;
    const key = `${row.kind}:${row.source}:${row.source_id}:${row.season_number ?? -1}:${row.episode_number ?? -1}`;
    dedup.set(key, row);
  }
  return Array.from(dedup.values());
}

function ImportPage() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [doneSteps, setDoneSteps] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [retrying, setRetrying] = useState(false);
  const [autoStatus, setAutoStatus] = useState<"idle" | "syncing" | "waiting" | "backoff">("idle");
  const loopTokenRef = useRef(0);
  const loopRunningRef = useRef(false);

  useEffect(() => {
    getPendingImportsCount().then((r) => setPendingCount(r.count)).catch(() => {});
  }, []);

  // Continuous background resolver: whenever there are pending items, poll the
  // server every ~4s in small batches. On failure, back off for 10s. The loop
  // is cancellable via loopTokenRef so we can force-restart it ("wake").
  const runBackgroundLoop = async (token: number) => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;
    const wait = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));
    try {
      while (loopTokenRef.current === token) {
        setAutoStatus("syncing");
        try {
          const r = await retryPendingImports();
          if (loopTokenRef.current !== token) break;
          setPendingCount(r.remaining);
          if (r.remaining <= 0) {
            setAutoStatus("idle");
            qc.invalidateQueries();
            break;
          }
          if (r.resolved > 0) qc.invalidateQueries();
          setAutoStatus("waiting");
          await wait(r.resolved > 0 ? 3000 : 5000);
        } catch {
          if (loopTokenRef.current !== token) break;
          setAutoStatus("backoff");
          await wait(10000);
        }
      }
    } finally {
      loopRunningRef.current = false;
      if (loopTokenRef.current === token) setAutoStatus("idle");
    }
  };

  // Kick the loop whenever we have pending items and no loop is currently running.
  useEffect(() => {
    if (pendingCount > 0 && !loopRunningRef.current) {
      const token = ++loopTokenRef.current;
      void runBackgroundLoop(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount]);

  // Manual "wake" — cancels the current iteration and starts a fresh one.
  const wakeLoop = () => {
    const token = ++loopTokenRef.current;
    // Give the previous iteration a moment to observe the token change.
    setTimeout(() => {
      if (!loopRunningRef.current) void runBackgroundLoop(token);
    }, 50);
    toast.success("Background sync woken up");
  };



  const bump = (n = 1) => {
    setDoneSteps((d) => {
      const nd = d + n;
      setProgress(totalSteps > 0 ? Math.min(100, Math.round((nd / totalSteps) * 100)) : 0);
      return nd;
    });
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setCounts(null);
    setProgress(0);
    setDoneSteps(0);
    setTotalSteps(0);
    let running: Counts = {
      showsFollowed: 0,
      moviesFollowed: 0,
      episodesWatched: 0,
      moviesWatched: 0,
      unresolved: 0,
    };
    const setLive = (patch: Partial<Counts>) => {
      running = { ...running, ...patch };
      setCounts({ ...running });
    };

    try {
      setPhase("Reading archive…");
      const zip = await JSZip.loadAsync(file);
      const csvs: Record<string, Row[]> = {};
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir || !name.toLowerCase().endsWith(".csv")) continue;
        const text = await entry.async("string");
        const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
        csvs[name.split("/").pop() ?? name] = parsed.data;
      }
      if (!Object.keys(csvs).length) throw new Error("No CSV files found in the archive.");

      setPhase("Analysing your data…");
      const parsed = parseArchive(csvs);

      // Compute total steps for progress bar
      const RESOLVE_CHUNK = 40;
      const INSERT_CHUNK = 500;
      const tvdbIds = [...parsed.followShowsTvdb.keys()];
      const tmdbShowIds = [...parsed.followShowsTmdb.keys()];
      const resolveShowSteps =
        Math.ceil(tvdbIds.length / RESOLVE_CHUNK) + Math.ceil(tmdbShowIds.length / RESOLVE_CHUNK);
      const resolveMovieSteps =
        Math.ceil(parsed.watchedMovies.length / RESOLVE_CHUNK) +
        Math.ceil(parsed.followMovies.length / RESOLVE_CHUNK);
      const insertSteps =
        Math.ceil((tvdbIds.length + tmdbShowIds.length) / INSERT_CHUNK) +
        Math.ceil(parsed.episodes.length / INSERT_CHUNK) +
        Math.ceil(parsed.watchedMovies.length / INSERT_CHUNK) +
        Math.ceil(parsed.followMovies.length / INSERT_CHUNK);
      const total = resolveShowSteps + resolveMovieSteps + insertSteps + 1;
      setTotalSteps(total);

      // -------- Resolve shows --------
      setPhase("Resolving series on TMDB…");
      const tvdbResolved = new Map<number, any>();
      const tmdbResolved = new Map<number, any>();
      for (const c of chunk(tvdbIds, RESOLVE_CHUNK)) {
        const res = await resolveShowsBatch({ data: { tvdb_ids: c } });
        for (const [k, v] of Object.entries(res.byTvdb)) tvdbResolved.set(Number(k), v);
        bump();
      }
      for (const c of chunk(tmdbShowIds, RESOLVE_CHUNK)) {
        const res = await resolveShowsBatch({ data: { tmdb_ids: c } });
        for (const [k, v] of Object.entries(res.byTmdb)) tmdbResolved.set(Number(k), v);
        bump();
      }

      // Build watchlist rows from resolved shows; queue unresolved
      const watchlistShowRows: Parameters<typeof bulkInsertWatchlist>[0]["data"]["rows"] = [];
      const pendingShowFollows: Parameters<typeof savePendingImports>[0]["data"]["rows"] = [];
      const showTmdbByTvdb = new Map<number, number>();
      const validTmdbShows = new Set<number>();

      for (const id of tvdbIds) {
        const s = tvdbResolved.get(id);
        if (s) {
          watchlistShowRows.push({
            tmdb_id: s.tmdb_id,
            media_type: "tv",
            series_name: s.name,
            poster_path: s.poster_path,
            backdrop_path: s.backdrop_path,
            first_air_date: s.first_air_date,
            vote_average: s.vote_average,
          });
          showTmdbByTvdb.set(id, s.tmdb_id);
          validTmdbShows.add(s.tmdb_id);
        } else {
          pendingShowFollows.push({
            kind: "follow_show",
            source: "tvdb",
            source_id: String(id),
            title: parsed.followShowsTvdb.get(id)?.title ?? null,
          });
        }
      }
      for (const id of tmdbShowIds) {
        const s = tmdbResolved.get(id);
        if (s) {
          watchlistShowRows.push({
            tmdb_id: s.tmdb_id,
            media_type: "tv",
            series_name: s.name,
            poster_path: s.poster_path,
            backdrop_path: s.backdrop_path,
            first_air_date: s.first_air_date,
            vote_average: s.vote_average,
          });
          validTmdbShows.add(s.tmdb_id);
        } else {
          pendingShowFollows.push({
            kind: "follow_show",
            source: "tmdb",
            source_id: String(id),
            title: parsed.followShowsTmdb.get(id)?.title ?? null,
          });
        }
      }

      // -------- Insert followed shows into watchlist --------
      setPhase("Adding series to your library…");
      let insertedShows = 0;
      for (const c of chunk(watchlistShowRows, INSERT_CHUNK)) {
        const r = await bulkInsertWatchlist({ data: { rows: c } });
        insertedShows += r.inserted;
        setLive({ showsFollowed: insertedShows });
        bump();
      }

      // -------- Prepare & insert watched episodes --------
      setPhase("Saving watched episodes…");
      const episodeRows: Parameters<typeof bulkInsertEpisodes>[0]["data"]["rows"] = [];
      const pendingEpisodes: Parameters<typeof savePendingImports>[0]["data"]["rows"] = [];
      for (const e of parsed.episodes) {
        let tmdb: number | undefined;
        let runtime: number | null = null;
        if (e.tmdb_id) {
          tmdb = e.tmdb_id;
          runtime = tmdbResolved.get(e.tmdb_id)?.runtime ?? null;
        } else if (e.tvdb_id) {
          tmdb = showTmdbByTvdb.get(e.tvdb_id);
          runtime = tvdbResolved.get(e.tvdb_id)?.runtime ?? null;
        }
        if (tmdb) {
          episodeRows.push({
            tmdb_id: tmdb,
            season_number: e.season_number,
            episode_number: e.episode_number,
            runtime_minutes: runtime,
            watched_at: e.watched_at,
          });
        } else {
          pendingEpisodes.push({
            kind: "watched_episode",
            source: e.tmdb_id ? "tmdb" : "tvdb",
            source_id: String(e.tmdb_id ?? e.tvdb_id),
            season_number: e.season_number,
            episode_number: e.episode_number,
            watched_at: e.watched_at,
          });
        }
      }

      let insertedEpisodes = 0;
      for (const c of chunk(episodeRows, INSERT_CHUNK)) {
        const r = await bulkInsertEpisodes({ data: { rows: c } });
        insertedEpisodes += r.inserted;
        setLive({ episodesWatched: insertedEpisodes });
        bump();
      }

      // -------- Resolve & insert watched movies --------
      setPhase("Resolving watched movies on TMDB…");
      const watchedMovieRows: Parameters<typeof bulkInsertWatchedMovies>[0]["data"]["rows"] = [];
      const pendingWatchedMovies: Parameters<typeof savePendingImports>[0]["data"]["rows"] = [];
      for (const c of chunk(parsed.watchedMovies, RESOLVE_CHUNK)) {
        const items = c.map((m) => ({
          tmdb_id: m.tmdb_id ?? null,
          imdb_id: m.imdb_id ?? null,
          title: m.title ?? null,
          year: m.year ?? null,
        }));
        const { results } = await resolveMoviesBatch({ data: { items } });
        results.forEach((r, i) => {
          try {
            const src = c[i];
            if (!src) return;
            if (r) {
              watchedMovieRows.push({
                tmdb_id: r.tmdb_id,
                title: r.title,
                runtime_minutes: r.runtime ?? src.runtime_minutes ?? null,
                watched_at: src.watched_at ?? null,
              });
            } else {
              pendingWatchedMovies.push({
                kind: "watched_movie",
                source: src.source,
                source_id: src.source_id,
                title: src.title ?? null,
                year: src.year ?? null,
                runtime_minutes: src.runtime_minutes ?? null,
                watched_at: src.watched_at ?? null,
              });
            }
          } catch (e) {
            console.warn("Skipped malformed watched movie import row", e);
          }
        });
        bump();
      }

      setPhase("Saving watched movies…");
      let insertedMovies = 0;
      for (const c of chunk(watchedMovieRows, INSERT_CHUNK)) {
        const r = await bulkInsertWatchedMovies({ data: { rows: c } });
        insertedMovies += r.inserted;
        setLive({ moviesWatched: insertedMovies });
        bump();
      }

      // -------- Resolve & insert followed movies --------
      setPhase("Resolving movie watchlist…");
      const followMovieRows: Parameters<typeof bulkInsertWatchlist>[0]["data"]["rows"] = [];
      const pendingFollowMovies: Parameters<typeof savePendingImports>[0]["data"]["rows"] = [];
      for (const c of chunk(parsed.followMovies, RESOLVE_CHUNK)) {
        const items = c.map((m) => ({
          tmdb_id: m.tmdb_id ?? null,
          imdb_id: m.imdb_id ?? null,
          title: m.title ?? null,
          year: m.year ?? null,
        }));
        const { results } = await resolveMoviesBatch({ data: { items } });
        results.forEach((r, i) => {
          try {
            const src = c[i];
            if (!src) return;
            if (r) {
              followMovieRows.push({
                tmdb_id: r.tmdb_id,
                media_type: "movie",
                series_name: r.title,
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path,
                first_air_date: r.release_date,
                vote_average: r.vote_average,
              });
            } else {
              pendingFollowMovies.push({
                kind: "follow_movie",
                source: src.source,
                source_id: src.source_id,
                title: src.title ?? null,
                year: src.year ?? null,
              });
            }
          } catch (e) {
            console.warn("Skipped malformed follow movie import row", e);
          }
        });
        bump();
      }

      let insertedFollowMovies = 0;
      for (const c of chunk(followMovieRows, INSERT_CHUNK)) {
        const r = await bulkInsertWatchlist({ data: { rows: c } });
        insertedFollowMovies += r.inserted;
        setLive({ moviesFollowed: insertedFollowMovies });
        bump();
      }

      // -------- Save pending (unresolved) --------
      const allPending = dedupePendingRows([
        ...pendingShowFollows,
        ...pendingEpisodes,
        ...pendingWatchedMovies,
        ...pendingFollowMovies,
      ]);
      if (allPending.length) {
        setPhase("Queuing unresolved items for background resolution…");
        for (const c of chunk(allPending, 500)) {
          await savePendingImports({ data: { rows: c } });
        }
        setLive({ unresolved: allPending.length });
      }
      bump();

      setPhase("Cleaning up watchlist…");
      try {
        await cleanupWatchedFromWatchlist();
      } catch (e) {
        console.error("cleanup failed", e);
      }

      setPhase("Done");
      setProgress(100);
      toast.success("Import complete");
      const pc = await getPendingImportsCount();
      setPendingCount(pc.count);
      qc.invalidateQueries();
    } catch (err) {
      console.error(err);
      toast.error("Import failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const r = await retryPendingImports();
      setPendingCount(r.remaining);
      toast.success(`Resolved ${r.resolved} items · ${r.remaining} still pending`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error("Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportLibrary();
      const toCsv = (rows: Record<string, unknown>[]) => Papa.unparse(rows, { quotes: true });
      const zip = new JSZip();
      zip.file("tomodachi_watched_episodes.csv", toCsv(data.episodes as Record<string, unknown>[]));
      zip.file("tomodachi_watched_movies.csv", toCsv(data.movies as Record<string, unknown>[]));
      zip.file("tomodachi_watchlist.csv", toCsv(data.watchlist as Record<string, unknown>[]));
      zip.file(
        "README.txt",
        "Tomodachi export\n\nRe-import this ZIP on the Import page to restore your library.\n",
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tomodachi-export-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${data.episodes.length} episodes · ${data.movies.length} movies · ${data.watchlist.length} watchlist items`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Export failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const [resetting, setResetting] = useState<null | "all" | "tv" | "movies">(null);
  const handleReset = async (scope: "all" | "tv" | "movies") => {
    setResetting(scope);
    try {
      await resetLibrary({ data: { scope } });
      if (scope === "all") {
        setCounts(null);
        setPendingCount(0);
      }
      const label =
        scope === "all" ? "Library cleared" : scope === "tv" ? "TV shows cleared" : "Movies cleared";
      toast.success(`${label} — you can re-import from scratch`);
      qc.invalidateQueries();
    } catch (err) {
      console.error(err);
      toast.error("Reset failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setResetting(null);
    }
  };


  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-12 sm:pt-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Import &amp; Export</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import your TV Time archive, or export your Tomodachi library as a ZIP you can re-import
          later.
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
            <div className="w-full space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm font-medium">{phase}</p>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{progress}%</p>
              {counts && (
                <ul className="grid grid-cols-2 gap-2 text-left text-xs sm:grid-cols-4">
                  <li className="rounded-lg border border-border bg-background p-2">
                    <div className="text-muted-foreground">Series</div>
                    <div className="font-display text-lg font-semibold">{counts.showsFollowed}</div>
                  </li>
                  <li className="rounded-lg border border-border bg-background p-2">
                    <div className="text-muted-foreground">Episodes</div>
                    <div className="font-display text-lg font-semibold">
                      {counts.episodesWatched}
                    </div>
                  </li>
                  <li className="rounded-lg border border-border bg-background p-2">
                    <div className="text-muted-foreground">Movies watched</div>
                    <div className="font-display text-lg font-semibold">{counts.moviesWatched}</div>
                  </li>
                  <li className="rounded-lg border border-border bg-background p-2">
                    <div className="text-muted-foreground">Movies watchlist</div>
                    <div className="font-display text-lg font-semibold">
                      {counts.moviesFollowed}
                    </div>
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <>
              <FileArchive className="h-10 w-10 text-primary" />
              <div>
                <p className="font-display text-base font-semibold">Drop your TV Time ZIP here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Parsed in your browser · large archives may take a few minutes.
                </p>
              </div>
              <Button type="button" variant="secondary">
                <Upload className="h-4 w-4" /> Choose file
              </Button>
            </>
          )}
        </label>
      </div>

      {counts && !busy && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 font-display text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Import complete
          </div>
          <ul className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <li>
              <div className="text-muted-foreground">Series added</div>
              <div className="font-display text-xl font-bold">{counts.showsFollowed}</div>
            </li>
            <li>
              <div className="text-muted-foreground">Episodes</div>
              <div className="font-display text-xl font-bold">{counts.episodesWatched}</div>
            </li>
            <li>
              <div className="text-muted-foreground">Movies watched</div>
              <div className="font-display text-xl font-bold">{counts.moviesWatched}</div>
            </li>
            <li>
              <div className="text-muted-foreground">Movies watchlist</div>
              <div className="font-display text-xl font-bold">{counts.moviesFollowed}</div>
            </li>
          </ul>
          {counts.unresolved > 0 && (
            <p className="text-xs text-muted-foreground">
              {counts.unresolved} items couldn't be resolved on TMDB yet — they're queued and will
              retry in the background.
            </p>
          )}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="font-display text-base font-semibold">
                {pendingCount} items awaiting resolution
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {autoStatus === "syncing" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                    Background auto-sync running…
                  </>
                )}
                {autoStatus === "waiting" && (
                  <>
                    <RefreshCw className="h-3 w-3 text-amber-500" />
                    Background auto-sync active — next batch in a few seconds
                  </>
                )}
                {autoStatus === "backoff" && (
                  <>
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    TMDB rate-limited — retrying in ~10s
                  </>
                )}
                {autoStatus === "idle" && (
                  <>Background auto-sync paused. Click “Wake sync” to resume.</>
                )}
              </p>
              <button
                type="button"
                onClick={wakeLoop}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
              >
                <Zap className="h-3 w-3" /> Wake sync
              </button>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={handleRetry} disabled={retrying}>
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {retrying ? "Retrying…" : "Retry now"}
          </Button>
        </div>
      )}


      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-base font-semibold">Export your library</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Downloads a ZIP with your watched episodes, movies and watchlist. You can re-import it
            here anytime.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting || busy}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "Preparing…" : "Export ZIP"}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-base font-semibold">Reset library</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deletes all your watched episodes, watched movies, watchlist, favorites and pending
            imports. Your profile and lists are kept. This cannot be undone.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={resetting || busy}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {resetting ? "Clearing…" : "Reset library"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset your library?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete every watched episode, watched movie, watchlist entry,
                favorite and pending import from your account. You can then re-import from scratch.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Yes, wipe everything</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
