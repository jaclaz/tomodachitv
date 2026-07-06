import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProfileByUsername,
  followUser,
  unfollowUser,
  getUserWatchlist,
  getUserWatched,
  updateMyProfile,
} from "@/lib/social.functions";
import { posterUrl } from "@/lib/tmdb";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import { BannerUpload } from "@/components/banner-upload";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, UserPlus, UserMinus, Film, Tv, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => getProfileByUsername({ data: { username } }),
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["user-watchlist", profile?.id],
    queryFn: () => getUserWatchlist({ data: { user_id: profile!.id } }),
    enabled: !!profile,
  });

  const canSeeWatched = !!profile && (profile.is_self || profile.is_following);

  const { data: watched } = useQuery({
    queryKey: ["user-watched", profile?.id],
    queryFn: () => getUserWatched({ data: { user_id: profile!.id } }),
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

  return (
    <div className="space-y-8">
      {/* Banner + profile header */}
      <div className="relative rounded-2xl border border-border bg-card">
        <div className="relative h-36 w-full overflow-hidden rounded-t-2xl sm:h-44">
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
                  <div className="absolute inset-x-0 bottom-0 h-1/2 backdrop-blur-[2px]" />
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
                <span>
                  <strong>{profile.followers_count}</strong>{" "}
                  <span className="text-muted-foreground">followers</span>
                </span>
                <span>
                  <strong>{profile.following_count}</strong>{" "}
                  <span className="text-muted-foreground">following</span>
                </span>
              </div>
            </div>

            {!profile.is_self &&
              (profile.is_following ? (
                <Button
                  variant="secondary"
                  onClick={() => unfollowMut.mutate(profile.id)}
                  disabled={unfollowMut.isPending}
                  className="self-end"
                >
                  <UserMinus className="mr-2 h-4 w-4" /> Unfollow
                </Button>
              ) : (
                <Button
                  onClick={() => followMut.mutate(profile.id)}
                  disabled={followMut.isPending}
                  className="self-end"
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Follow
                </Button>
              ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="watchlist">
        <TabsList>
          <TabsTrigger value="watchlist">Watchlist ({watchlist.length})</TabsTrigger>
          <TabsTrigger value="watched">Watched</TabsTrigger>
        </TabsList>

        <TabsContent value="watchlist" className="mt-4">
          {watchlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Empty watchlist.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {watchlist.map((item) => (
                <Link
                  key={item.id}
                  to={item.media_type === "tv" ? "/serie/$id" : "/movie/$id"}
                  params={{ id: String(item.tmdb_id) }}
                  className="group overflow-hidden rounded-xl bg-card"
                >
                  <div className="aspect-[2/3] overflow-hidden">
                    {item.poster_path ? (
                      <img
                        src={posterUrl(item.poster_path)}
                        alt={item.series_name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                        {item.series_name.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <p className="p-2 text-sm font-medium line-clamp-1">
                    {item.series_name}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="watched" className="mt-4">
          {!canSeeWatched ? (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center">
              <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">Followers only</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow @{profile.username} to see their watched history.
              </p>
            </div>
          ) : !watched ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : watched.episodes.length === 0 && watched.movies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing watched yet.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Film className="h-4 w-4" /> Recent movies ({watched.movies.length})
                </h3>
                <ul className="space-y-2">
                  {watched.movies.slice(0, 20).map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-lg bg-surface px-4 py-2 text-sm"
                    >
                      <span>{m.title ?? `Movie #${m.tmdb_id}`}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.watched_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Tv className="h-4 w-4" /> Recent episodes ({watched.episodes.length})
                </h3>
                <ul className="space-y-2">
                  {watched.episodes.slice(0, 20).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between rounded-lg bg-surface px-4 py-2 text-sm"
                    >
                      <span>
                        S{e.season_number}E{e.episode_number}
                        {e.episode_name ? ` · ${e.episode_name}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.watched_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BioSection({ profile }: { profile: { id: string; bio: string | null; is_self: boolean } }) {
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile.bio ?? "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newBio: string) => {
      await updateMyProfile({ data: { bio: newBio.trim() || null } });
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
      <div className="mt-2 max-w-xl">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={240}
          rows={3}
          placeholder="Write a short bio..."
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => mutation.mutate(bio)}
            disabled={mutation.isPending}
          >
            <Check className="mr-1 h-4 w-4" /> Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setBio(profile.bio ?? "");
              setIsEditing(false);
            }}
            disabled={mutation.isPending}
          >
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex max-w-xl items-start gap-2">
      <p className="text-sm text-foreground/80">
        {profile.bio || (profile.is_self ? "No bio yet." : "")}
      </p>
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
