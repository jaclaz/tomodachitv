import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "@/lib/social.functions";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/social")({
  component: SocialPage,
});

function SocialPage() {
  const [query, setQuery] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["users", query],
    queryFn: () => searchUsers({ data: { query } }),
    enabled: query.trim().length >= 2,
  });

  return (
    <div className="space-y-8">
      <div className="pt-12 sm:pt-0">
        <h1 className="font-display text-2xl font-bold">Social</h1>
        <p className="text-sm text-muted-foreground">
          Find friends by username and see what they're watching.
        </p>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by @username or display name..."
          className="border-border bg-surface pl-10"
        />
      </div>

      {query.trim().length < 2 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-semibold">
            Discover other users
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </p>
        </div>
      ) : isFetching ? (
        <p className="text-sm text-muted-foreground">Searching...</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((u) => (
            <li key={u.id}>
              <Link
                to="/u/$username"
                params={{ username: u.username }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-card"
              >
                <Avatar className="h-12 w-12">
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
    </div>
  );
}
