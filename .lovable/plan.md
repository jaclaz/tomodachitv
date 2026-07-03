# English UI + Movies support

Two changes together: switch all UI copy to English, and make Pavulli work for both **TV series and movies** (TMDB has both).

## 1. Language: Italian → English

Rewrite all user-facing strings in:
- Sidebar: "Home", "Trending", "Watchlist", "Stats", "Sign out"
- Auth page: "Sign in" / "Sign up", "Email", "Password", "Display name", success/error messages
- Home, Trending, Watchlist, Stats pages: headings, empty states, buttons
- Detail pages: "Add to watchlist", "Remove", "Seasons", "Episodes", "Mark as watched", "Watched", etc.
- Search placeholder, hero copy, TMDB attribution
- App name stays **Pavulli**
- TMDB API calls switch from `language=it-IT` to `language=en-US`

## 2. Movies support

TMDB exposes movies at `/movie/*` and `/trending/movie/week`, `/search/movie`. We add a **media type** dimension across the app.

### Database

Add `media_type` (`'tv' | 'movie'`) to the existing tables and add movie-watch tracking:

```text
watchlist:
  + media_type text not null default 'tv'  -- 'tv' | 'movie'
  (existing columns stay; `first_air_date` reused for movie release_date,
   `series_name` reused as title)
  unique(user_id, media_type, tmdb_id)

watched_movies (new):
  id uuid pk
  user_id uuid
  tmdb_id int
  title text
  runtime_minutes int
  watched_at timestamptz
  unique(user_id, tmdb_id)
  RLS: user_id = auth.uid()
  GRANT to authenticated + service_role
```

`watched_episodes` stays as-is (TV only).

### Server functions

- `src/lib/tmdb.ts`: add `getTrendingMovies`, `searchMovies`, `getMovieDetails`. Extend `searchSeries` → unified `searchAll` (multi-search) OR keep two functions and let each page pick. Simplest: add a `searchMulti` that queries `/search/multi` and returns items tagged with `media_type`.
- `src/lib/watchlist.functions.ts`: accept `media_type` on add/remove/list; queries filter by it or return all.
- `src/lib/watched.functions.ts`: keep episode functions; add `markMovieWatched`, `unmarkMovieWatched`, `getWatchedMovies`.

### Routes / pages

- `/` (home): show trending mix (both media types), tabs "All / TV / Movies".
- `/trending`: same, with tabs.
- `/watchlist`: tabs "All / TV / Movies", each card links to the right detail route.
- `/stats`: extend to include movies watched, total movie minutes, combined totals.
- Rename `/serie/$id` → keep for TV, add `/movie/$id` for movies. Detail page differs:
  - TV: seasons + episodes tracking (current behaviour)
  - Movie: overview, runtime, "Mark as watched" toggle, "Add to watchlist"
- Search bar: uses multi-search, results show a small "TV" or "Movie" badge and route accordingly.

### Components

- `series-card.tsx` → `media-card.tsx`, generic over `{ id, title, poster, backdrop, date, rating, media_type }`; links to `/serie/$id` or `/movie/$id`.
- `hero-section.tsx`, `stats-strip.tsx`, `search-bar.tsx`: adapt to generic media items and English copy.

## Out of scope

- Recommendations, genres filter, per-user language preference. Locale is fixed to English for now.

## Technical notes

- TMDB attribution text updated to English.
- Route path `/serie/$id` stays (backwards compatible with existing watchlist rows for TV); new `/movie/$id` added.
- Migration adds `media_type` with default `'tv'` so existing rows stay valid.
- Unique constraint on `watchlist` widened to `(user_id, media_type, tmdb_id)`.
