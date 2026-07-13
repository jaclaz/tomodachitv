import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFavorite,
  addListItem,
  createList,
  getMyFavorites,
  getUserLists,
  removeFavorite,
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
import { useEffect, useState } from "react";
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
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const addMut = useMutation({
    mutationFn: (list_id: string) =>
      addListItem({
        data: { list_id, media_type, tmdb_id, title, poster_path },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-lists", me?.id] });
      qc.invalidateQueries({ queryKey: ["list"] });
      toast.success("Added to list");
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
      qc.invalidateQueries({ queryKey: ["user-lists", me?.id] });
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
          <Button variant="outline" className="gap-2">
            <ListPlus className="h-4 w-4" /> Add to list
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
            <DropdownMenuItem key={l.id} onSelect={() => addMut.mutate(l.id)}>
              {l.title}
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
