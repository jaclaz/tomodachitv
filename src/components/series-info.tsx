import { useQuery } from "@tanstack/react-query";
import { getCredits, getTranslations, type SeriesDetails } from "@/lib/tmdb";

interface SeriesInfoProps {
  series: SeriesDetails;
}

const LANG_DISPLAY = new Intl.DisplayNames(["en"], { type: "language" });

function languageLabel(code: string) {
  if (!code) return "—";
  try {
    return LANG_DISPLAY.of(code) ?? code.toUpperCase();
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
  const networks = series.networks ?? [];

  const availableLangs = Array.from(
    new Set(
      (translationsData?.translations ?? []).map((t) => t.iso_639_1).filter(Boolean)
    )
  ).sort();

  const spokenLangs = series.spoken_languages ?? [];

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground">Details</h2>
      <dl className="rounded-xl border border-border bg-surface px-5 py-1">
        {networks.length > 0 && (
          <Row label="Network">
            {networks.map((n) => n.name).join(", ")}
          </Row>
        )}
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
        <Row label="Original language">
          {languageLabel(series.original_language)}
        </Row>
        {spokenLangs.length > 0 && (
          <Row label="Spoken languages">
            {spokenLangs
              .map((l) => l.english_name || languageLabel(l.iso_639_1))
              .join(", ")}
          </Row>
        )}
        {availableLangs.length > 0 && (
          <Row label="Available dubs / subtitles">
            <div className="flex flex-wrap gap-1.5">
              {availableLangs.map((code) => (
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
        {series.origin_country && series.origin_country.length > 0 && (
          <Row label="Country of origin">
            {series.origin_country.join(", ")}
          </Row>
        )}
      </dl>
    </section>
  );
}
