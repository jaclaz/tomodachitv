import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProfileByUsername,
  followUser,
  unfollowUser,
  getUserWatchlist,
  updateMyProfile,
} from "@/lib/social.functions";
import {
  getUserWatchedLibrary,
  getUserRecentlyWatchedShows,
  type WatchedLibraryItem,
} from "@/lib/watched-library.functions";
import { getUserFavorites, getUserLists } from "@/lib/lists.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import { BannerUpload } from "@/components/banner-upload";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, UserPlus, UserMinus, Pencil, Check, X, Loader2, Tv, Film, Star } from "lucide-react";

import { useState } from "react";
import { toast } from "sonner";
import { PosterStrip, type PosterItem } from "@/components/poster-strip";
import { PosterActions } from "@/components/poster-actions";
import { UserListsSection } from "@/components/user-lists-section";
import { ReportProfileButton } from "@/components/report-profile-button";
import { FollowListDialog } from "@/components/follow-list-dialog";
import { posterUrl } from "@/lib/tmdb";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const queryClient = useQueryClient();
  const [followDialogMode, setFollowDialogMode] = useState<"followers" | "following" | null>(null);


  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => getProfileByUsername({ data: { username } }),
  });

  const canSeeWatched = !!profile && (profile.is_self || profile.is_following);

  const { data: watchlist = [] } = useQuery({
    queryKey: ["user-watchlist", profile?.id],
    queryFn: () => getUserWatchlist({ data: { user_id: profile!.id } }),
    enabled: !!profile,
  });

  const { data: watchedLibrary = [] } = useQuery({
    queryKey: ["user-watched-library", profile?.id],
    queryFn: () => getUserWatchedLibrary({ data: { user_id: profile!.id } }),
    enabled: !!profile && canSeeWatched,
  });

  const { data: recentShows = [] } = useQuery({
    queryKey: ["user-recent-shows", profile?.id],
    queryFn: () => getUserRecentlyWatchedShows({ data: { user_id: profile!.id } }),
    enabled: !!profile && canSeeWatched,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["user-favorites", profile?.id],
    queryFn: () => getUserFavorites({ data: { user_id: profile!.id } }),
    enabled: !!profile && canSeeWatched,
  });

  const followMut = useMutation({
    mutationFn: (uid: string) => followUser({ data: { user_id: uid } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", username] }),
  });
  const unfollowMut = useMutation({
    mutationFn: (uid: string) => unfollowUser({ data: { user_id: uid } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", username] }),
  });

  if (isLoading) {
    return <div className="pt-12 text-sm text-muted-foreground">Loading...</div>;
  }
  if (!profile) throw notFound();

  // Profile-only view: TV shows with any watched episode count as "last watched",
  // so the watchlist tab shows only titles never started.
  const startedShowIds = new Set(recentShows.map((s) => s.tmdb_id));

  const activeWatchlist = watchlist.filter(
    (w) =>
      w.status !== "completed" &&
      w.status !== "dropped" &&
      !(w.media_type === "tv" && startedShowIds.has(w.tmdb_id)),
  );
  const watchlistTv: PosterItem[] = activeWatchlist
    .filter((w) => w.media_type === "tv")
    .map((w) => ({
      tmdb_id: w.tmdb_id,
      title: w.series_name,
      poster_path: w.poster_path,
      media_type: "tv" as const,
    }));
  const watchlistMovies: PosterItem[] = activeWatchlist
    .filter((w) => w.media_type === "movie")
    .map((w) => ({
      tmdb_id: w.tmdb_id,
      title: w.series_name,
      poster_path: w.poster_path,
      media_type: "movie" as const,
    }));

  const toItem = (w: WatchedLibraryItem): PosterItem => ({
    tmdb_id: w.tmdb_id,
    title: w.title,
    poster_path: w.poster_path,
    media_type: w.media_type,
  });
  const byRecent = (a: WatchedLibraryItem, b: WatchedLibraryItem) =>
    (b.watched_at ?? "").localeCompare(a.watched_at ?? "");
  const watchedTv: PosterItem[] = recentShows.map((s) => ({
    tmdb_id: s.tmdb_id,
    title: s.title,
    poster_path: s.poster_path,
    media_type: "tv" as const,
  }));
  const watchedMovies: PosterItem[] = watchedLibrary
    .filter((w) => w.media_type === "movie" && !w.dropped)
    .slice()
    .sort(byRecent)
    .map(toItem);


  const favTv: PosterItem[] = favorites
    .filter((f) => f.media_type === "tv")
    .map((f) => ({
      tmdb_id: f.tmdb_id,
      title: f.title,
      poster_path: f.poster_path,
      media_type: "tv" as const,
    }));
  const favMovies: PosterItem[] = favorites
    .filter((f) => f.media_type === "movie")
    .map((f) => ({
      tmdb_id: f.tmdb_id,
      title: f.title,
      poster_path: f.poster_path,
      media_type: "movie" as const,
    }));

  return (
    <div className="space-y-8">
      {/* Banner + profile header */}
      <div className="relative rounded-2xl border border-border bg-card">
        <div className="relative h-40 w-full overflow-hidden rounded-t-2xl sm:h-[200px]">
          {profile.is_self ? (
            <BannerUpload userId={profile.id} currentUrl={profile.banner_url} />
          ) : (
            <>
              {profile.banner_url ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${profile.banner_url})` }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.75)_0%,rgba(0,0,0,0.4)_50%,transparent_80%)]" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <span className="text-sm font-medium text-foreground/60">No banner</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Profile info layered over the bottom of the banner */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 sm:px-6 sm:pb-4">
          <div className="flex items-end gap-4">
            <div className="flex-shrink-0">
              {profile.is_self ? (
                <AvatarUpload
                  userId={profile.id}
                  currentUrl={profile.avatar_url}
                  fallback={(profile.display_name ?? profile.username).slice(0, 2).toUpperCase()}
                  className="h-28 w-28 border-4 border-background/80 sm:h-32 sm:w-32"
                  fallbackClassName="text-2xl sm:text-3xl"
                />
              ) : (
                <Avatar className="h-28 w-28 border-4 border-background/80 sm:h-32 sm:w-32">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="text-2xl sm:text-3xl">
                    {(profile.display_name ?? profile.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>

            <div className="flex flex-1 flex-col">
              <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                {profile.display_name ?? profile.username}
              </h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <BioSection profile={profile} />
              <div className="mt-2 flex gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setFollowDialogMode("followers")}
                  className="transition-colors hover:text-primary"
                >
                  <strong>{profile.followers_count}</strong>{" "}
                  <span className="text-muted-foreground">followers</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFollowDialogMode("following")}
                  className="transition-colors hover:text-primary"
                >
                  <strong>{profile.following_count}</strong>{" "}
                  <span className="text-muted-foreground">following</span>
                </button>
              </div>
            </div>

            {!profile.is_self && (
              <div className="flex items-end gap-1 self-end">
                {profile.is_following ? (
                  <Button
                    variant="secondary"
                    onClick={() => unfollowMut.mutate(profile.id)}
                    disabled={unfollowMut.isPending}
                  >
                    <UserMinus className="mr-2 h-4 w-4" /> Unfollow
                  </Button>
                ) : (
                  <Button
                    onClick={() => followMut.mutate(profile.id)}
                    disabled={followMut.isPending}
                  >
                    <UserPlus className="mr-2 h-4 w-4" /> Follow
                  </Button>
                )}
                <ReportProfileButton reportedUserId={profile.id} username={profile.username} />
              </div>
            )}

          </div>
        </div>
      </div>

      <Tabs defaultValue="watched">
        <TabsList>
          <TabsTrigger value="watched">
            Last watched ({watchedTv.length + watchedMovies.length})
          </TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist ({activeWatchlist.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="watched" className="mt-4 space-y-6">
          {!canSeeWatched ? (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center">
              <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">Followers only</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow @{profile.username} to see their watched history.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Tv className="h-4 w-4" /> TV Shows ({watchedTv.length})
                </h3>
                <PosterStrip
                  items={watchedTv}
                  emptyLabel="No series watched yet."
                  max={20}
                  moreHref={profile.is_self ? "/watched" : undefined}
                  moreSearch={{ type: "tv" }}
                  moreLabel="See all watched"
                />
              </div>
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Film className="h-4 w-4" /> Movies ({watchedMovies.length})
                </h3>
                <PosterStrip
                  items={watchedMovies}
                  emptyLabel="No movies watched yet."
                  max={20}
                  moreHref={profile.is_self ? "/watched" : undefined}
                  moreSearch={{ type: "movie" }}
                  moreLabel="See all watched"
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="watchlist" className="mt-4 space-y-6">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Tv className="h-4 w-4" /> TV Shows ({watchlistTv.length})
            </h3>
            <PosterStrip
              items={watchlistTv}
              emptyLabel="No series in watchlist."
              max={20}
              moreHref={profile.is_self ? "/watchlist" : undefined}
              moreSearch={{ type: "tv" }}
              moreLabel="See all watchlist"
            />
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Film className="h-4 w-4" /> Movies ({watchlistMovies.length})
            </h3>
            <PosterStrip
              items={watchlistMovies}
              emptyLabel="No movies in watchlist."
              max={20}
              moreHref={profile.is_self ? "/watchlist" : undefined}
              moreSearch={{ type: "movie" }}
              moreLabel="See all watchlist"
            />
          </div>

        </TabsContent>
      </Tabs>


      {/* Favorites — always for self; only if non-empty for others */}
      {canSeeWatched && (profile.is_self || favorites.length > 0) && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Favorites</h2>
            <p className="text-xs text-muted-foreground">
              {profile.is_self
                ? "Mark movies and series as favorites from their pages."
                : "Loved by this user."}
            </p>
          </div>
          <div className="space-y-4">
            {(profile.is_self || favTv.length > 0) && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Tv className="h-4 w-4" /> Favorite series
                </h3>
                <PosterStrip
                  items={favTv}
                  emptyLabel="No favorite series yet."
                  max={20}
                  moreHref={profile.is_self && favTv.length > 20 ? "/watched" : undefined}
                  moreSearch={{ type: "tv", fav: "1" }}
                  moreLabel="See all favorites"
                  actions={(item) => (
                    <PosterActions
                      media_type={item.media_type}
                      tmdb_id={item.tmdb_id}
                      title={item.title}
                      poster_path={item.poster_path}
                      size="sm"
                    />
                  )}
                />
              </div>
            )}
            {(profile.is_self || favMovies.length > 0) && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Film className="h-4 w-4" /> Favorite movies
                </h3>
                <PosterStrip
                  items={favMovies}
                  emptyLabel="No favorite movies yet."
                  max={20}
                  moreHref={profile.is_self && favMovies.length > 20 ? "/watched" : undefined}
                  moreSearch={{ type: "movie", fav: "1" }}
                  moreLabel="See all favorites"
                  actions={(item) => (
                    <PosterActions
                      media_type={item.media_type}
                      tmdb_id={item.tmdb_id}
                      title={item.title}
                      poster_path={item.poster_path}
                      size="sm"
                    />
                  )}
                />

              </div>
            )}
          </div>
        </section>
      )}

      {/* Personal lists — always for self; only if any exist for others */}
      <ListsSectionGate userId={profile.id} isSelf={profile.is_self} />

      <FollowListDialog
        userId={profile.id}
        username={profile.username}
        mode={followDialogMode}
        onClose={() => setFollowDialogMode(null)}
      />

    </div>
  );
}

function ListsSectionGate({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const { data: lists = [] } = useQuery({
    queryKey: ["user-lists", userId],
    queryFn: () => getUserLists({ data: { user_id: userId } }),
  });
  if (!isSelf && lists.length === 0) return null;
  return <UserListsSection userId={userId} isSelf={isSelf} />;
}

function BioSection({
  profile,
}: {
  profile: { id: string; bio: string | null; is_self: boolean };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile.bio ?? "");
  const queryClient = useQueryClient();

  const MAX_BIO_LENGTH = 120;

  const mutation = useMutation({
    mutationFn: async (newBio: string) => {
      await updateMyProfile({ data: { bio: newBio.trim().slice(0, MAX_BIO_LENGTH) || null } });
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Bio updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!profile.is_self && !profile.bio) return null;

  if (isEditing) {
    return (
      <div className="mt-1 flex max-w-xl items-start gap-2">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              mutation.mutate(bio);
            } else if (e.key === "Escape") {
              setBio(profile.bio ?? "");
              setIsEditing(false);
            }
          }}
          maxLength={MAX_BIO_LENGTH}
          rows={1}
          placeholder="Write a short bio..."
          autoFocus
          className="flex-1 resize-none rounded-md border border-border bg-background px-2 py-1 text-sm leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => mutation.mutate(bio)}
            disabled={mutation.isPending}
            aria-label="Save bio"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setBio(profile.bio ?? "");
              setIsEditing(false);
            }}
            disabled={mutation.isPending}
            aria-label="Cancel"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex max-w-xl items-start gap-2">
      <p className="line-clamp-2 text-sm text-foreground/80 min-h-[1.25em]">{profile.bio || ""}</p>
      {profile.is_self && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          aria-label="Edit bio"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
