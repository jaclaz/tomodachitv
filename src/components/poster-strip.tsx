import { Link } from "@tanstack/react-router";
import { posterUrl } from "@/lib/tmdb";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";


export type PosterMediaType = "movie" | "tv";

export interface PosterItem {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  media_type: PosterMediaType;
}

export function PosterStrip({
  items,
  emptyLabel,
  max = 12,
  actions,
  moreHref,
  moreSearch,
  moreLabel = "See all",
}: {
  items: PosterItem[];
  emptyLabel: string;
  max?: number;
  actions?: (item: PosterItem) => ReactNode;
  moreHref?: string;
  moreSearch?: Record<string, string>;
  moreLabel?: string;
}) {

  if (items.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {items.slice(0, max).map((item, index) => (
        <div
          key={`${item.media_type}-${item.tmdb_id}-${index}`}
          className="group relative aspect-[2/3] w-[92px] flex-shrink-0 snap-start overflow-hidden rounded-lg bg-muted sm:w-[110px]"
          title={item.title}
        >
          <Link
            to={item.media_type === "tv" ? "/serie/$id" : "/movie/$id"}
            params={{ id: String(item.tmdb_id) }}
            className="block h-full w-full"
          >
            {item.poster_path ? (
              <img
                src={posterUrl(item.poster_path)}
                alt={item.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                {item.title.slice(0, 24)}
              </div>
            )}
          </Link>
          {actions && (
            <div className="absolute bottom-1 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {actions(item)}
            </div>
          )}
        </div>
      ))}
      {moreHref && items.length > 0 && (
        <Link
          to={moreHref as string}
          search={moreSearch as never}
          className="group flex aspect-[2/3] w-[92px] flex-shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-primary hover:text-primary sm:w-[110px]"
          aria-label={moreLabel}
          title={moreLabel}
        >
          <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-0.5" />
          <span className="px-2 text-center text-xs font-medium">{moreLabel}</span>
        </Link>
      )}

    </div>
  );
}


