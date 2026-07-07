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
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tv2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Where to watch</h2>
        </div>
        <Select value={country} onValueChange={onCountryChange}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Country" />
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
          No streaming services available in this country.
        </p>
      ) : (
        <div className="space-y-3">
          <ProvidersRow
            free={p!.free}
            flatrate={p!.flatrate}
            ads={p!.ads}
            rent={p!.rent}
            buy={p!.buy}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {p!.link ? (
              <a
                href={p!.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Details on JustWatch <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span />
            )}
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Data provided by JustWatch via TMDB
            </p>
          </div>
        </div>

      )}
    </section>
  );
}

function ProvidersRow({
  free,
  flatrate,
  ads,
  rent,
  buy,
}: {
  free?: WatchProvider[];
  flatrate?: WatchProvider[];
  ads?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}) {
  // Order: Free first, then subscription streaming, then ad-supported.
  // Deduplicate by provider_id so a provider offering both free and flatrate
  // isn't shown twice — the first occurrence wins.
  const streaming: { prov: WatchProvider; kind: "free" | "sub" | "ads" }[] = [];
  const seen = new Set<number>();
  const push = (list: WatchProvider[] | undefined, kind: "free" | "sub" | "ads") => {
    (list ?? []).forEach((prov) => {
      if (seen.has(prov.provider_id)) return;
      seen.add(prov.provider_id);
      streaming.push({ prov, kind });
    });
  };
  push(free, "free");
  push(flatrate, "sub");
  push(ads, "ads");

  const hasStreaming = streaming.length > 0;
  const hasRent = (rent?.length ?? 0) > 0;
  const hasBuy = (buy?.length ?? 0) > 0;

  if (!hasStreaming && !hasRent && !hasBuy) return null;

  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {hasStreaming && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Streaming
            </span>
            <div className="h-10">
              <ProviderPill prov={streaming[0].prov} kind={streaming[0].kind} />
            </div>
          </div>
          {streaming.slice(1).map(({ prov, kind }) => (
            <ProviderPill key={prov.provider_id} prov={prov} kind={kind} />
          ))}
        </div>
      )}
      {hasStreaming && (hasRent || hasBuy) && (
        <div className="h-10 w-px shrink-0 bg-muted-foreground/40" />
      )}
      {hasRent && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rent
            </span>
            <div className="h-10">
              <ProviderPill prov={rent![0]} kind="rent" />
            </div>
          </div>
          {rent!.slice(1).map((prov) => (
            <ProviderPill key={prov.provider_id} prov={prov} kind="rent" />
          ))}
        </div>
      )}
      {hasRent && hasBuy && (
        <div className="h-10 w-px shrink-0 bg-muted-foreground/40" />
      )}
      {hasBuy && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Buy
            </span>
            <div className="h-10">
              <ProviderPill prov={buy![0]} kind="buy" />
            </div>
          </div>
          {buy!.slice(1).map((prov) => (
            <ProviderPill key={prov.provider_id} prov={prov} kind="buy" />
          ))}
        </div>
      )}
    </div>
  );
}




function ProviderPill({
  prov,
  kind,
}: {
  prov: WatchProvider;
  kind?: "free" | "sub" | "ads" | "rent" | "buy";
}) {
  const badge =
    kind === "free"
      ? { label: "Free", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
      : kind === "ads"
        ? { label: "Ads", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
        : kind === "rent"
          ? { label: "Rent", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" }
          : kind === "buy"
            ? { label: "Buy", cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" }
            : null;
  return (
    <div
      title={prov.provider_name}
      className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-background/60 p-1.5 pr-3"
    >
      {prov.logo_path ? (
        <img
          src={providerLogoUrl(prov.logo_path)}
          alt={prov.provider_name}
          className="h-7 w-7 rounded-md object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-7 w-7 rounded-md bg-muted" />
      )}
      <span className="text-sm font-medium whitespace-nowrap">{prov.provider_name}</span>
      {badge && (
        <span
          className={`ml-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.cls}`}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}

