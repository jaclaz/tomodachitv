import { useQuery } from "@tanstack/react-query";
import { getCredits, type SeriesDetails } from "@/lib/tmdb";

interface SeriesInfoProps {
  series: SeriesDetails;
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

function LangTags({
  languages,
  countries,
}: {
  languages: string[];
  countries?: string[];
}) {
  if (languages.length === 0) return "—";
  const countryStr = Array.from(new Set(countries?.filter(Boolean) ?? []))
    .map(regionLabel)
    .join(", ");
  return (
    <div className="flex flex-wrap gap-1.5">
      {languages.map((code) => (
        <span
          key={code}
          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
        >
          {languageLabel(code)}
          {countryStr && ` (${countryStr})`}
        </span>
      ))}
    </div>
  );
}

export function SeriesInfo({ series }: SeriesInfoProps) {
  const { data: credits } = useQuery({
    queryKey: ["credits", "tv", series.id],
    queryFn: () => getCredits({ data: { id: series.id, type: "tv" } }),
  });

  const { data: translationsData } = useQuery({
    queryKey: ["translations", "tv", series.id],
    queryFn: () => getTranslations({ data: { id: series.id, type: "tv" } }),
  });

  const directors = (credits?.crew ?? [])
    .filter((c) => c.job === "Director" || c.department === "Directing")
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .slice(0, 6);

  const creators = series.created_by ?? [];
  const productionCompanies = series.production_companies ?? [];

  // Merge original language + spoken languages, append country of origin in parentheses.
  const allLanguages: string[] = [];
  if (series.original_language) allLanguages.push(series.original_language);
  for (const l of series.spoken_languages ?? []) {
    if (l.iso_639_1 && !allLanguages.includes(l.iso_639_1)) {
      allLanguages.push(l.iso_639_1);
    }
  }

  const originCountries = series.origin_country ?? [];
  const countryStr = originCountries.map(regionLabel).join(", ");

  // Dubs: audio languages available for the series.
  const dubLanguages = Array.from(
    new Set((series.languages ?? []).filter(Boolean))
  ).sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)));

  // Subtitles: metadata translations grouped by language with their countries.
  const subGroups = new Map<string, Set<string>>();
  for (const t of translationsData?.translations ?? []) {
    if (!t.iso_639_1) continue;
    const countries = subGroups.get(t.iso_639_1) ?? new Set<string>();
    if (t.iso_3166_1) countries.add(t.iso_3166_1);
    subGroups.set(t.iso_639_1, countries);
  }
  const subLanguages = Array.from(subGroups.entries())
    .map(([code, countries]) => ({
      code,
      countries: Array.from(countries).sort(),
    }))
    .sort((a, b) => languageLabel(a.code).localeCompare(languageLabel(b.code)));

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground">Details</h2>
      <dl className="rounded-xl border border-border bg-surface px-5 py-1">
        {productionCompanies.length > 0 && (
          <Row label="Production">
            {productionCompanies.map((c) => c.name).join(", ")}
          </Row>
        )}
        {creators.length > 0 && (
          <Row label="Created by">
            {creators.map((c) => c.name).join(", ")}
          </Row>
        )}
        {directors.length > 0 && (
          <Row label="Directors">
            {directors.map((d) => d.name).join(", ")}
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
            <LangTags languages={dubLanguages} countries={[]} />
          </Row>
        )}
        {subLanguages.length > 0 && (
          <Row label="Subtitles">
            <div className="flex flex-wrap gap-1.5">
              {subLanguages.map(({ code }) => (
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
