import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const JW_URL = "https://apis.justwatch.com/graphql";

const SEARCH_QUERY = `
query SearchTitles($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter!) {
  popularTitles(country: $country, first: $first, filter: $filter) {
    edges {
      node {
        id
        objectType
        content(country: $country, language: $language) {
          title
          fullPath
          originalReleaseYear
          externalIds { tmdbId }
        }
      }
    }
  }
}`;

const DETAILS_QUERY = `
query GetUrlTitleDetails($fullPath: String!, $country: Country!, $language: Language!) {
  urlV2(fullPath: $fullPath) {
    node {
      id
      __typename
      ... on MovieOrShow {
        content(country: $country, language: $language) { title }
        offers(country: $country, platform: WEB) {
          monetizationType
          presentationType
          audioLanguages
          subtitleLanguages
          package { clearName shortName }
        }
      }
    }
  }
}`;

type Offer = {
  monetizationType: string;
  presentationType: string;
  audioLanguages: string[] | null;
  subtitleLanguages: string[] | null;
  package: { clearName: string; shortName: string } | null;
};

type SearchNode = {
  id: string;
  objectType: string;
  content: {
    title: string;
    fullPath: string;
    originalReleaseYear: number | null;
    externalIds: { tmdbId: string | null } | null;
  };
};

async function jwFetch<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(JW_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        Origin: "https://www.justwatch.com",
        Referer: "https://www.justwatch.com/",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

export type JustWatchLanguages = {
  found: boolean;
  fullPath: string | null;
  providers: Array<{
    provider: string;
    shortName: string;
    monetizationType: string;
    audioLanguages: string[];
    subtitleLanguages: string[];
  }>;
  dubs: string[]; // union of all audio languages
  subs: string[]; // union of all subtitle languages
};

export const getJustWatchLanguages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        tmdb_id: z.number().int(),
        media_type: z.enum(["movie", "tv"]),
        title: z.string().min(1),
        year: z.number().int().optional(),
        country: z.string().length(2),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<JustWatchLanguages> => {
    const emptyResult: JustWatchLanguages = {
      found: false,
      fullPath: null,
      providers: [],
      dubs: [],
      subs: [],
    };

    const targetType = data.media_type === "tv" ? "SHOW" : "MOVIE";

    // 1) Search JustWatch, match by TMDB id.
    const search = await jwFetch<{
      popularTitles: { edges: Array<{ node: SearchNode }> };
    }>(SEARCH_QUERY, {
      country: data.country.toUpperCase(),
      language: "en",
      first: 20,
      filter: { searchQuery: data.title },
    });
    if (!search) return emptyResult;

    const nodes = search.popularTitles.edges.map((e) => e.node);
    const tmdbIdStr = String(data.tmdb_id);
    let match = nodes.find(
      (n) =>
        n.objectType === targetType && n.content?.externalIds?.tmdbId === tmdbIdStr,
    );
    // Fallback: same type + year match
    if (!match && data.year) {
      match = nodes.find(
        (n) =>
          n.objectType === targetType &&
          n.content?.originalReleaseYear === data.year,
      );
    }
    if (!match) return emptyResult;

    // 2) Fetch offers for the matched title in the given country.
    const details = await jwFetch<{
      urlV2: { node: { offers: Offer[] } };
    }>(DETAILS_QUERY, {
      fullPath: match.content.fullPath,
      country: data.country.toUpperCase(),
      language: "en",
    });
    if (!details?.urlV2?.node?.offers) {
      return { ...emptyResult, found: true, fullPath: match.content.fullPath };
    }

    const offers = details.urlV2.node.offers;

    // Aggregate per provider (union across SD/HD/4K variants).
    const perProviderMap = new Map<
      string,
      {
        provider: string;
        shortName: string;
        monetizationType: string;
        audio: Set<string>;
        subs: Set<string>;
      }
    >();

    for (const o of offers) {
      if (!o.package) continue;
      const key = `${o.package.shortName}|${o.monetizationType}`;
      const entry =
        perProviderMap.get(key) ??
        {
          provider: o.package.clearName,
          shortName: o.package.shortName,
          monetizationType: o.monetizationType,
          audio: new Set<string>(),
          subs: new Set<string>(),
        };
      (o.audioLanguages ?? []).forEach((l) => entry.audio.add(l));
      (o.subtitleLanguages ?? []).forEach((l) => entry.subs.add(l));
      perProviderMap.set(key, entry);
    }

    const providers = Array.from(perProviderMap.values())
      .map((p) => ({
        provider: p.provider,
        shortName: p.shortName,
        monetizationType: p.monetizationType,
        audioLanguages: Array.from(p.audio).sort(),
        subtitleLanguages: Array.from(p.subs).sort(),
      }))
      .filter((p) => p.audioLanguages.length + p.subtitleLanguages.length > 0)
      .sort((a, b) => a.provider.localeCompare(b.provider));

    const dubs = Array.from(new Set(providers.flatMap((p) => p.audioLanguages))).sort();
    const subs = Array.from(new Set(providers.flatMap((p) => p.subtitleLanguages))).sort();

    return {
      found: true,
      fullPath: match.content.fullPath,
      providers,
      dubs,
      subs,
    };
  });
