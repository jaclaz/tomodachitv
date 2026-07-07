import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getJustWatchLanguages } from "@/lib/justwatch.functions";
import { Languages, Subtitles, Mic } from "lucide-react";

const STORAGE_KEY = "watch-providers-country";
const DEFAULT_COUNTRY = "IT";

const LANG_DISPLAY = new Intl.DisplayNames(["en"], { type: "language" });
function languageLabel(code: string) {
  try {
    return LANG_DISPLAY.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

interface Props {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year?: number;
}

export function WatchLanguages({ tmdbId, mediaType, title, year }: Props) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setCountry(saved);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setCountry(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    // Poll for same-tab changes (StorageEvent only fires cross-tab).
    const iv = window.setInterval(() => {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v && v !== country) setCountry(v);
    }, 800);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(iv);
    };
  }, [country]);

  const { data, isLoading } = useQuery({
    queryKey: ["justwatch-langs", mediaType, tmdbId, country],
    queryFn: () =>
      getJustWatchLanguages({
        data: { tmdb_id: tmdbId, media_type: mediaType, title, country, year },
      }),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-lg font-semibold">Audio & subtitles</h2>
        <span className="ml-auto text-xs text-muted-foreground">{country}</span>
      </div>

      {isLoading ? (
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
      ) : !data?.found ? (
        <p className="text-sm text-muted-foreground">
          No language data available for this country.
        </p>
      ) : data.dubs.length === 0 && data.subs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Providers in this country don't publish audio/subtitle details for this title.
        </p>
      ) : (
        <div className="space-y-3">
          <LangRow icon={Mic} label="Dubs" langs={data.dubs} emptyLabel="No dubbed audio listed." />
          <LangRow
            icon={Subtitles}
            label="Subtitles"
            langs={data.subs}
            emptyLabel="No subtitle tracks listed."
          />

          {data.providers.length > 0 && (
            <details className="rounded-lg border border-border/60 bg-background/40 p-2">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Per provider
              </summary>
              <ul className="mt-2 space-y-2">
                {data.providers.map((p) => (
                  <li key={`${p.shortName}-${p.monetizationType}`} className="text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold text-foreground">{p.provider}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {p.monetizationType.toLowerCase()}
                      </span>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Audio: </span>
                        {p.audioLanguages.length > 0
                          ? p.audioLanguages.map(languageLabel).join(", ")
                          : "—"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Subs: </span>
                        {p.subtitleLanguages.length > 0
                          ? p.subtitleLanguages.map(languageLabel).join(", ")
                          : "—"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Data provided by JustWatch
          </p>
        </div>
      )}
    </section>
  );
}

function LangRow({
  icon: Icon,
  label,
  langs,
  emptyLabel,
}: {
  icon: typeof Mic;
  label: string;
  langs: string[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      {langs.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {langs.map((code) => (
            <span
              key={code}
              className="rounded-md border border-border bg-background/60 px-2 py-0.5 text-xs"
              title={code}
            >
              {languageLabel(code)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
