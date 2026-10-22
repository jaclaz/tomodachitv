import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getFollowingActivity, searchUsers } from "@/lib/social.functions";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Film, Search, Tv, Users } from "lucide-react";
import { posterUrl } from "@/lib/tmdb";
import { episodeRanges, groupFollowingActivity } from "@/lib/activity-groups";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({ meta: [
    { title: "Friends' activity · TomodachiTV" },
    { name: "description", content: "Find friends and see their recent movie and episode watches on TomodachiTV." },
    { property: "og:title", content: "Friends' activity · TomodachiTV" },
    { property: "og:description", content: "Keep up with what your friends are watching on TomodachiTV." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TomodachiPage,
});

function TomodachiPage() {
  return (
    <div className="space-y-8">
      <div className="sm:pt-0">
        <h1 className="font-display text-2xl font-bold">Tomodachi</h1>
        <p className="text-sm text-muted-foreground">
          Find new people to follow and keep up with what your friends watch.
        </p>
      </div>

      <FindFriends />

      <ActivityFeed />
    </div>
  );
}

function FindFriends() {
  const [query, setQuery] = useState("");
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["users", query],
    queryFn: () => searchUsers({ data: { query } }),
    enabled: query.trim().length >= 2,
  });

  const showResults = query.trim().length >= 2;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-base font-semibold">Find friends</h2>
      </div>
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by @username or display name..."
          className="border-border bg-background pl-10"
        />
      </div>

      {!showResults ? (
        <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
      ) : isFetching ? (
        <p className="text-sm text-muted-foreground">Searching...</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((u) => (
            <li key={u.id}>
              <Link
                to="/u/$username"
                params={{ username: u.username }}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:bg-card"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {(u.display_name ?? u.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {u.display_name ?? u.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{u.username}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityFeed() {
  const { data: activity, isLoading } = useQuery({
    queryKey: ["following-activity"],
    queryFn: () => getFollowingActivity(),
  });
  const groupedActivity = groupFollowingActivity(activity ?? []);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Recent activity</h2>
        <p className="text-xs text-muted-foreground">
          What the people you follow have been watching lately.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !activity || activity.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nothing to show yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow some friends to see their recent watches here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groupedActivity.map((a) => (
            <li key={a.id}>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <Link
                to={a.kind === "episode" ? "/serie/$id" : "/movie/$id"}
                params={{ id: String(a.tmdb_id) }}
                aria-label={a.title}
                className="flex-shrink-0"
              >
                <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                  {a.poster_path ? (
                    <img
                      src={posterUrl(a.poster_path)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              </Link>
              <Link to="/u/$username" params={{ username: a.user.username }} aria-label={`@${a.user.username}`}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={a.user.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(a.user.display_name ?? a.user.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm">
                    <Link to="/u/$username" params={{ username: a.user.username }} className="font-semibold text-foreground hover:text-primary hover:underline">
                      {a.user.display_name ?? a.user.username}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      watched {a.kind === "episode"
                        ? `${a.episode_numbers.length > 1 ? "episodes" : "episode"} ${episodeRanges(a.episode_numbers)} of`
                        : "the movie"}
                    </span>{" "}
                    <Link to={a.kind === "episode" ? "/serie/$id" : "/movie/$id"} params={{ id: String(a.tmdb_id) }} className="font-medium text-foreground hover:text-primary hover:underline">{a.title}</Link>
                    {a.kind === "episode" && (
                      <span className="text-muted-foreground">
                        {a.season_number !== undefined ? ` · Season ${a.season_number}` : ""}
                        {a.episode_numbers.length === 1 && a.episode_name ? ` — ${a.episode_name}` : ""}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {a.kind === "episode" ? (
                      <Tv className="h-3 w-3" />
                    ) : (
                      <Film className="h-3 w-3" />
                    )}
                    {new Date(a.watched_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
