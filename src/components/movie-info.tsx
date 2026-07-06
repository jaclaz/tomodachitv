import { useQuery } from "@tanstack/react-query";
import { getCredits, getTranslations, type MovieDetails } from "@/lib/tmdb";

interface MovieInfoProps {
  movie: MovieDetails;
}

const LANG_DISPLAY = new Intl.DisplayNames(["en"], { type: "language" });
const REGION_DISPLAY = new Intl.DisplayNames(["en"], { type: "region" });

function languageLabel(code: string) {
  if (!code) return "—";
  try {
    return LANG_DISPLAY.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function regionLabel(code: string) {
  if (!code) return "";
  try {
    return REGION_DISPLAY.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function LangTags({ languages }: { languages: string[] }) {
  if (languages.length === 0) return "—";
  return (
    <div className="flex flex-wrap gap-1.5">
      {languages.map((code) => (
        <span
          key={code}
          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
        >
          {languageLabel(code)}
        </span>
      ))}
    </div>
  );
}

export function MovieInfo({ movie }: MovieInfoProps) {
  const { data: credits } = useQuery({
    queryKey: ["credits", "movie", movie.id],
    queryFn: () => getCredits({ data: { id: movie.id, type: "movie" } }),
  });

  const { data: translationsData } = useQuery({
    queryKey: ["translations", "movie", movie.id],
    queryFn: () => getTranslations({ data: { id: movie.id, type: "movie" } }),
  });

  const directors = (credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .slice(0, 6);

  const writers = (credits?.crew ?? [])
    .filter((c) => c.department === "Writing")
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .slice(0, 6);

  const productionCompanies = movie.production_companies ?? [];

  const allLanguages: string[] = [];
  if (movie.original_language) allLanguages.push(movie.original_language);
  for (const l of movie.spoken_languages ?? []) {
    if (l.iso_639_1 && !allLanguages.includes(l.iso_639_1)) {
      allLanguages.push(l.iso_639_1);
    }
  }

  const originCountries = movie.origin_country ?? [];
  const countryStr = originCountries.map(regionLabel).join(", ");

  const dubLanguages = Array.from(
    new Set([
      ...(movie.original_language ? [movie.original_language] : []),
      ...(movie.spoken_languages ?? []).map((l) => l.iso_639_1).filter(Boolean),
    ])
  ).sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)));

  const subGroups = new Map<string, Set<string>>();
  for (const t of translationsData?.translations ?? []) {
    if (!t.iso_639_1) continue;
    const countries = subGroups.get(t.iso_639_1) ?? new Set<string>();
    if (t.iso_3166_1) countries.add(t.iso_3166_1);
    subGroups.set(t.iso_639_1, countries);
  }
  const subLanguages = Array.from(subGroups.entries())
    .map(([code]) => code)
    .sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)));

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground">Details</h2>
      <dl className="rounded-xl border border-border bg-surface px-5 py-1">
        {productionCompanies.length > 0 && (
          <Row label="Production">
            {productionCompanies.map((c) => c.name).join(", ")}
          </Row>
        )}
        {directors.length > 0 && (
          <Row label="Directors">
            {directors.map((d) => d.name).join(", ")}
          </Row>
        )}
        {writers.length > 0 && (
          <Row label="Writers">
            {writers.map((w) => w.name).join(", ")}
          </Row>
        )}
        <Row label="Languages">
          {allLanguages.length > 0 ? (
            <>
              {allLanguages.map(languageLabel).join(", ")}
              {countryStr && ` (${countryStr})`}
            </>
          ) : (
            "—"
          )}
        </Row>
        {dubLanguages.length > 0 && (
          <Row label="Dubs">
            <LangTags languages={dubLanguages} />
          </Row>
        )}
        {subLanguages.length > 0 && (
          <Row label="Subtitles">
            <div className="flex flex-wrap gap-1.5">
              {subLanguages.map((code) => (
                <span
                  key={code}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {languageLabel(code)}
                </span>
              ))}
            </div>
          </Row>
        )}
      </dl>
    </section>
  );
}
