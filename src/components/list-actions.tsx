import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFavorite,
  addListItem,
  createList,
  getListMembership,
  getMyFavorites,
  getUserLists,
  removeFavorite,
  removeListItem,
} from "@/lib/lists.functions";
import { getMyProfile } from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Heart, ListPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface Props {
  media_type: "movie" | "tv";
  tmdb_id: number;
  title: string;
  poster_path: string | null;
}

export function FavoriteButton({ media_type, tmdb_id, title, poster_path }: Props) {
  const qc = useQueryClient();
  const { data: favorites = [] } = useQuery({
    queryKey: ["my-favorites"],
    queryFn: () => getMyFavorites(),
  });
  const isFav = favorites.some(
    (f) => f.media_type === media_type && f.tmdb_id === tmdb_id,
  );

  const mut = useMutation({
    mutationFn: async () => {
      if (isFav) {
        await removeFavorite({ data: { media_type, tmdb_id } });
      } else {
        await addFavorite({
          data: { media_type, tmdb_id, title, poster_path },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-favorites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Button
      variant={isFav ? "secondary" : "outline"}
      className="gap-2"
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
    >
      <Heart
        className={`h-4 w-4 ${isFav ? "fill-current text-red-500" : ""}`}
      />
      {isFav ? "Favorited" : "Favorite"}
    </Button>
  );
}

export function AddToListButton({ media_type, tmdb_id, title, poster_path }: Props) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const { data: lists = [] } = useQuery({
    queryKey: ["user-lists", me?.id],
    queryFn: () => getUserLists({ data: { user_id: me!.id } }),
    enabled: !!me,
  });
  const { data: membership = [] } = useQuery({
    queryKey: ["list-membership", media_type, tmdb_id],
    queryFn: () => getListMembership({ data: { media_type, tmdb_id } }),
  });
  const memberIds = new Set(membership.map((m) => m.list_id));
  const isAdded = membership.length > 0;
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["list-membership", media_type, tmdb_id] });
    qc.invalidateQueries({ queryKey: ["user-lists", me?.id] });
    qc.invalidateQueries({ queryKey: ["list"] });
  };

  const toggleMut = useMutation({
    mutationFn: async (list: { id: string; title: string }) => {
      if (memberIds.has(list.id)) {
        await removeListItem({ data: { list_id: list.id, media_type, tmdb_id } });
        return { removed: true, title: list.title };
      }
      await addListItem({
        data: { list_id: list.id, media_type, tmdb_id, title, poster_path },
      });
      return { removed: false, title: list.title };
    },
    onSuccess: (r) => {
      invalidate();
      toast.success(
        r.removed ? `Removed from ${r.title}` : `Added to ${r.title}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const list = await createList({
        data: { title: newTitle, is_public: isPublic },
      });
      await addListItem({
        data: {
          list_id: list.id,
          media_type,
          tmdb_id,
          title,
          poster_path,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("List created");
      setCreating(false);
      setNewTitle("");
      setIsPublic(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={isAdded ? "secondary" : "outline"}
            className="gap-2"
            title={
              isAdded
                ? `In: ${membership.map((m) => m.list_title).join(", ")}`
                : "Add to list"
            }
          >
            {isAdded ? (
              <>
                <Check className="h-4 w-4" /> Added
              </>
            ) : (
              <>
                <ListPlus className="h-4 w-4" /> Add to list
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Your lists</DropdownMenuLabel>
          {lists.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No lists yet.
            </p>
          )}
          {lists.map((l) => (
            <DropdownMenuItem
              key={l.id}
              onSelect={(e) => {
                e.preventDefault();
                toggleMut.mutate({ id: l.id, title: l.title });
              }}
              className="justify-between gap-2"
            >
              <span className="truncate">{l.title}</span>
              {memberIds.has(l.id) && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> New list…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>


      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New list</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value.slice(0, 80))}
              placeholder="List title"
              autoFocus
            />
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">Public</span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !newTitle.trim()}
            >
              Create & add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
