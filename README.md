# 🍙 TomodachiTV

A social tracker for movies and TV series: log what you watch, follow friends, discover what's trending in your country and get personalised recommendations.

**Live:** https://tomodachitv.lovable.app

---

## ✨ Features

### Library & tracking
- **Watched / Watchlist** grids for movies and series, with favourites (heart) and filters.
- **Series status** — a show becomes *watched* only when every released episode is marked; also *currently watching*, *planned* and *dropped*.
- **Episode list** with a horizontally scrolling season bar (episode count per season), "Mark next watched", "Mark season as watched" and a dropdown to **mark all seasons** (released episodes only).
- **Auto-add to library** when you mark a title or episode you hadn't added yet.
- **Rewatches** — log rewatches of movies or selected seasons; they count towards your stats.
- **Personal ratings** with onigiri (0.5 – 5.0).
- **Selective reset** of TV or movie data.

### Discovery
- **Recommended for you** — hybrid engine (content-based + collaborative filtering), refreshable, with dismiss.
- **Trending in your country** — computed from real in-app activity per country with time decay, with a TMDB regional fallback.
- **Discover** with streaming-service and country filters (subscription / free / ads only).
- **Search bar** with typo tolerance and quick-add for movies and series.
- **Detail pages** for movies, series and people: cast, related titles, where to watch (JustWatch / TMDB providers), trailers (YouTube privacy-enhanced).
- **Calendar** of upcoming and released episodes.

### Social
- Public profiles (`/u/:username`) with avatar, banner, stats and "Last watched".
- Follow / followers, custom lists, saved lists from other users.
- Notifications for new episodes and releases of shows you follow (automatic check, toggles in Notifications).
- Profile reporting with an admin dashboard (*Warn user* / *Dismiss*).

### Stats
- Watch time in months / days / hours, 7/30/90-day counters, weekday distribution, "Most rewatched" leaderboard, clickable from Home.

### Import / Export
- **TV Time** export, **Netflix** viewing history CSV (titles matched in any language) and **TomodachiTV** backup ZIP.
- Deduplication, batch resilience, and a "Couldn't be imported" queue for manual fixes and "Retry all".

**Getting your Netflix history:** Account → Manage profiles → [your profile] → Viewing activity → scroll down → **Download all**.

### Mobile
- Bottom tab bar with a "More" sheet, compact layouts, installable as a PWA (web manifest + app icons).

---

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) v1 (React 19, SSR, server functions) |
| Routing | TanStack Router (file-based, `src/routes`) |
| Data | TanStack Query |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) |
| Backend | Lovable Cloud (Postgres, Auth, Storage, RLS) |
| Runtime | Edge (Cloudflare Workers) |
| External data | TMDB API, JustWatch |
| Tests | Vitest |

---

## 📁 Project structure

```text
src/
├── routes/                  # File-based routes
│   ├── __root.tsx           # Root layout, head/OG metadata
│   ├── auth.tsx             # Sign in / sign up (email + Google)
│   ├── reset-password.tsx
│   └── _authenticated/      # Protected pages
│       ├── index.tsx        # Home
│       ├── movie.$id.tsx  serie.$id.tsx  person.$id.tsx
│       ├── watched.tsx  watchlist.tsx  trending.tsx  calendar.tsx
│       ├── stats.tsx  social.tsx  notifications.tsx  import.tsx
│       ├── list.$id.tsx  u.$username.tsx
│       └── admin.reports.tsx
├── components/              # UI components (episode list, media cards, ...)
├── lib/
│   ├── *.functions.ts       # Server functions (createServerFn)
│   ├── recommendations.server.ts  # Hybrid recommendation engine
│   ├── trending.functions.ts      # Country trending engine
│   ├── tmdb.ts              # TMDB client
│   └── recommendations.test.ts
├── integrations/            # Auto-generated backend clients
└── styles.css               # Design tokens (Tailwind v4)
supabase/migrations/         # Database schema, RLS policies, functions
```

---

## 🧠 Algorithms

### Recommendations
```text
Score = Genre × 0.45 + Keywords/People × 0.25 + CommunityRating × 0.15 + CoWatch × 0.15
```
- User profile built from watched recency, watchlist, completed, favourites, ratings (≥ 3.5 positive, ≤ 2 negative) and dropped titles.
- **CoWatch**: users sharing ≥ 3 highly rated titles (`get_cowatch_scores` RPC).
- Excludes anything already in the library, completed, dropped or dismissed.
- Diversity: one per franchise, max 3 per genre and max 2 per seed in the top 10.

### Trending by country
```text
TrendingScore = Σ weight × 1 / (1 + (hours / 24)^1.5)     (last 7 days, user's country)
```
- Weights: watchlist = 2, watched = 3, rating/favourite = 4.
- Events recorded in `trend_events` via database triggers; import bursts are throttled.
- If fewer than 10 titles have local activity, the list is filled with TMDB regional discover.

---

## 🚀 Local development

```bash
bun install
bun run dev        # http://localhost:8080
bun run build
bunx vitest run    # tests
bun run lint
```

### Environment variables
Copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Server-side secrets (e.g. the TMDB API key) are configured in the backend secrets, never in the client bundle.

---

## 🔒 Security
- Row Level Security on every table, owner-scoped policies.
- Cross-user reads (followers, counts, trending, co-watch) through `SECURITY DEFINER` functions with a fixed `search_path`.
- Roles stored in a separate `user_roles` table; admin checks via `has_role`.
- Profanity filter on usernames and lists.

---

## 🤝 Contributing
This project is synced with [Lovable](https://lovable.dev). Don't force-push or rewrite pushed history; keep the main branch in a working state.

## 📜 Credits
Movie and TV data provided by [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by JustWatch.
