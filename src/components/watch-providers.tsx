import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getWatchProviders,
  providerLogoUrl,
  type MediaType,
  type WatchProvider,
} from "@/lib/tmdb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Tv2 } from "lucide-react";

const STORAGE_KEY = "watch-providers-country";
const DEFAULT_COUNTRY = "IT";

// Common countries first; TMDB returns actual availability per title.
const COUNTRIES: { code: string; name: string }[] = [
  { code: "IT", name: "Italia" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Deutschland" },
  { code: "ES", name: "España" },
  { code: "CH", name: "Schweiz" },
  { code: "AT", name: "Österreich" },
  { code: "NL", name: "Nederland" },
  { code: "BE", name: "Belgique" },
  { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "BR", name: "Brasil" },
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "JP", name: "日本" },
  { code: "KR", name: "대한민국" },
  { code: "IN", name: "India" },
];

interface Props {
  tmdbId: number;
  type: MediaType;
}

export function WatchProviders({ tmdbId, type }: Props) {
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setCountry(saved);
  }, []);

  const onCountryChange = (v: string) => {
    setCountry(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["watch-providers", type, tmdbId, country],
    queryFn: () => getWatchProviders({ data: { id: tmdbId, type, country } }),
    enabled: !isNaN(tmdbId),
  });

  const p = data?.providers;
  const hasAny =
    p && ((p.flatrate?.length ?? 0) + (p.free?.length ?? 0) + (p.ads?.length ?? 0) + (p.rent?.length ?? 0) + (p.buy?.length ?? 0)) > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tv2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Dove vederlo</h2>
        </div>
        <Select value={country} onValueChange={onCountryChange}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Paese" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name} ({c.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      ) : !hasAny ? (
        <p className="text-sm text-muted-foreground">
          Nessun servizio di streaming disponibile in questo paese.
        </p>
      ) : (
        <div className="space-y-4">
          <ProviderRow label="Streaming" items={p!.flatrate} />
          <ProviderRow label="Gratis" items={p!.free} />
          <ProviderRow label="Con pubblicità" items={p!.ads} />
          <ProviderRow label="Noleggio" items={p!.rent} />
          <ProviderRow label="Acquisto" items={p!.buy} />
          {p!.link && (
            <a
              href={p!.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Dettagli su JustWatch <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground">
        Dati forniti da JustWatch tramite TMDB
      </p>
    </section>
  );
}

function ProviderRow({ label, items }: { label: string; items?: WatchProvider[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((prov) => (
          <div
            key={prov.provider_id}
            title={prov.provider_name}
            className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-1.5 pr-3"
          >
            {prov.logo_path ? (
              <img
                src={providerLogoUrl(prov.logo_path)}
                alt={prov.provider_name}
                className="h-8 w-8 rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-8 w-8 rounded-md bg-muted" />
            )}
            <span className="text-sm font-medium">{prov.provider_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
