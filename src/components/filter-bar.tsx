import { useQuery } from "@tanstack/react-query";
import { getGenres, type MediaType, type SortBy } from "@/lib/tmdb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface FilterState {
  genreId: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
  sortBy: SortBy;
}

export const DEFAULT_FILTERS: FilterState = {
  genreId: null,
  yearFrom: null,
  yearTo: null,
  minRating: null,
  sortBy: "popularity.desc",
};

const CURRENT_YEAR = new Date().getFullYear();
const DECADES = [
  { label: "2020s", from: 2020, to: CURRENT_YEAR },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "1990s", from: 1990, to: 1999 },
  { label: "1980s", from: 1980, to: 1989 },
  { label: "Older", from: 1900, to: 1979 },
];

const RATINGS = [9, 8, 7, 6, 5];

interface Props {
  type: MediaType;
  value: FilterState;
  onChange: (next: FilterState) => void;
}

export function FilterBar({ type, value, onChange }: Props) {
  const { data: genresData } = useQuery({
    queryKey: ["genres", type],
    queryFn: () => getGenres({ data: { type } }),
    staleTime: 1000 * 60 * 60,
  });
  const genres = genresData?.genres ?? [];

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: "popularity.desc", label: "Most popular" },
    { value: "vote_average.desc", label: "Highest rated" },
    {
      value: type === "movie" ? "primary_release_date.desc" : "first_air_date.desc",
      label: "Newest",
    },
    { value: type === "movie" ? "title.asc" : "name.asc", label: "A–Z" },
  ];

  const currentDecadeIdx = DECADES.findIndex(
    (d) => d.from === value.yearFrom && d.to === value.yearTo
  );
  const decadeVal = currentDecadeIdx >= 0 ? String(currentDecadeIdx) : "all";

  const isActive =
    value.genreId != null ||
    value.yearFrom != null ||
    value.minRating != null ||
    value.sortBy !== "popularity.desc";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.genreId ? String(value.genreId) : "all"}
        onValueChange={(v) =>
          onChange({ ...value, genreId: v === "all" ? null : Number(v) })
        }
      >
        <SelectTrigger className="h-9 w-[140px] bg-surface">
          <SelectValue placeholder="Genre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All genres</SelectItem>
          {genres.map((g) => (
            <SelectItem key={g.id} value={String(g.id)}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={decadeVal}
        onValueChange={(v) => {
          if (v === "all") onChange({ ...value, yearFrom: null, yearTo: null });
          else {
            const d = DECADES[Number(v)];
            onChange({ ...value, yearFrom: d.from, yearTo: d.to });
          }
        }}
      >
        <SelectTrigger className="h-9 w-[130px] bg-surface">
          <SelectValue placeholder="Decade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any year</SelectItem>
          {DECADES.map((d, i) => (
            <SelectItem key={d.label} value={String(i)}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.minRating != null ? String(value.minRating) : "all"}
        onValueChange={(v) =>
          onChange({ ...value, minRating: v === "all" ? null : Number(v) })
        }
      >
        <SelectTrigger className="h-9 w-[130px] bg-surface">
          <SelectValue placeholder="Rating" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any rating</SelectItem>
          {RATINGS.map((r) => (
            <SelectItem key={r} value={String(r)}>
              {r}+ ★
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.sortBy}
        onValueChange={(v) => onChange({ ...value, sortBy: v as SortBy })}
      >
        <SelectTrigger className="h-9 w-[160px] bg-surface">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-3 w-3" /> Reset
        </Button>
      )}
    </div>
  );
}
