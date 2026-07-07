import { useQuery } from "@tanstack/react-query";
import { getCredits, type MovieDetails } from "@/lib/tmdb";

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

export function MovieInfo({ movie }: MovieInfoProps) {
  const { data: credits } = useQuery({
    queryKey: ["credits", "movie", movie.id],
    queryFn: () => getCredits({ data: { id: movie.id, type: "movie" } }),
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
        <Row label="Original language">
          {allLanguages.length > 0 ? (
            <>
              {allLanguages.map(languageLabel).join(", ")}
              {countryStr && ` (${countryStr})`}
            </>
          ) : (
            "—"
          )}
        </Row>
      </dl>
    </section>
  );
}
