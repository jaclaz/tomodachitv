import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserMinus, UserPlus, Loader2 } from "lucide-react";
import {
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  type FollowUserItem,
} from "@/lib/social.functions";

interface Props {
  userId: string;
  username: string;
  mode: "followers" | "following" | null;
  onClose: () => void;
}

export function FollowListDialog({ userId, username, mode, onClose }: Props) {
  const open = mode !== null;
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["follow-list", mode, userId],
    queryFn: () =>
      mode === "followers"
        ? getFollowers({ data: { user_id: userId } })
        : getFollowing({ data: { user_id: userId } }),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["follow-list"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const followMut = useMutation({
    mutationFn: (uid: string) => followUser({ data: { user_id: uid } }),
    onSuccess: invalidate,
  });
  const unfollowMut = useMutation({
    mutationFn: (uid: string) => unfollowUser({ data: { user_id: uid } }),
    onSuccess: invalidate,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "followers" ? "Followers" : "Following"} · @{username}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {users.map((u: FollowUserItem) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <Link
                    to="/u/$username"
                    params={{ username: u.username }}
                    onClick={onClose}
                    className="flex flex-1 items-center gap-3 min-w-0"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {(u.display_name ?? u.username).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {u.display_name ?? u.username}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{u.username}
                      </p>
                    </div>
                  </Link>
                  {!u.is_self && (
                    <Button
                      size="sm"
                      variant={u.is_following ? "secondary" : "default"}
                      onClick={() =>
                        u.is_following
                          ? unfollowMut.mutate(u.id)
                          : followMut.mutate(u.id)
                      }
                      disabled={followMut.isPending || unfollowMut.isPending}
                    >
                      {u.is_following ? (
                        <>
                          <UserMinus className="mr-1 h-3.5 w-3.5" /> Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-1 h-3.5 w-3.5" /> Follow
                        </>
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
