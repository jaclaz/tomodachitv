import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createList,
  deleteList,
  getUserLists,
  updateList,
  type UserList,
} from "@/lib/lists.functions";
import { posterUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Globe, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function UserListsSection({
  userId,
  isSelf,
}: {
  userId: string;
  isSelf: boolean;
}) {
  const qc = useQueryClient();
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["user-lists", userId],
    queryFn: () => getUserLists({ data: { user_id: userId } }),
  });
  const { data: saved = [] } = useQuery({
    queryKey: ["saved-lists"],
    queryFn: () => getSavedLists(),
    enabled: isSelf,
  });

  const allLists = [
    ...lists.map((l) => ({ list: l as TrendingList, saved: false })),
    ...(isSelf ? saved.map((l) => ({ list: l, saved: true })) : []),
  ].sort((a, b) => (b.list.updated_at > a.list.updated_at ? 1 : -1));

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserList | null>(null);
  const [deleting, setDeleting] = useState<UserList | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteList({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-lists", userId] });
      toast.success("List deleted");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unsaveMut = useMutation({
    mutationFn: (id: string) => unsaveList({ data: { list_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-lists"] });
      qc.invalidateQueries({ queryKey: ["trending-lists"] });
      toast.success("Removed from saved lists");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Lists</h2>
          <p className="text-xs text-muted-foreground">
            {isSelf
              ? "Your collections and the ones you saved from other people."
              : "Public collections curated by this user."}
          </p>
        </div>
        {isSelf && (
          <Button size="sm" onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New list
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : allLists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {isSelf ? "No lists yet. Create your first one." : "No public lists yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allLists.map(({ list: l, saved: isSaved }) => (
            <ListCard
              key={l.id}
              list={l}
              isSelf={isSelf && !isSaved}
              isSaved={isSaved}
              onEdit={() => setEditing(l)}
              onDelete={() => setDeleting(l)}
              onUnsave={() => unsaveMut.mutate(l.id)}
            />
          ))}
        </div>
      )}


      {isSelf && (
        <ListFormDialog
          open={creating}
          onOpenChange={setCreating}
          userId={userId}
        />
      )}
      {isSelf && editing && (
        <ListFormDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          userId={userId}
          existing={editing}
        />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" and its items will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
              disabled={deleteMut.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ListCard({
  list,
  isSelf,
  isSaved,
  onEdit,
  onDelete,
  onUnsave,
}: {
  list: TrendingList | UserList;
  isSelf: boolean;
  isSaved?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUnsave?: () => void;
}) {
  const posters = list.preview_posters ?? [];
  const owner = (list as TrendingList).owner ?? null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
      <Link
        to="/list/$id"
        params={{ id: list.id }}
        className="block"
      >
        <div className="grid aspect-[16/9] grid-cols-4 gap-[2px] bg-muted">
          {posters.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-muted" />
              ))
            : Array.from({ length: 4 }).map((_, i) => {
                const p = posters[i];
                return (
                  <div key={i} className="overflow-hidden bg-muted">
                    {p ? (
                      <img
                        src={posterUrl(p)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                );
              })}
        </div>
        <div className="space-y-1 p-3">
          <div className="flex items-center gap-2">
            <h3 className="line-clamp-1 flex-1 font-semibold">{list.title}</h3>
            {isSaved ? (
              <Badge variant="outline" className="gap-1 border-border text-[10px]">
                <Bookmark className="h-3 w-3" /> Saved
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-border text-[10px]">
                {list.is_public ? (
                  <>
                    <Globe className="h-3 w-3" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" /> Private
                  </>
                )}
              </Badge>
            )}
          </div>
          {list.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {list.description}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {list.item_count ?? 0} item{(list.item_count ?? 0) === 1 ? "" : "s"}
            {isSaved && owner ? ` · by @${owner.username}` : ""}
          </p>
        </div>
      </Link>
      {isSaved && owner && (
        <Link
          to="/u/$username"
          params={{ username: owner.username }}
          className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-background/90 py-1 pl-1 pr-2.5 shadow-sm backdrop-blur transition-colors hover:bg-background"
          title={`Saved from ${owner.display_name ?? owner.username}`}
        >
          <Avatar className="h-5 w-5">
            <AvatarImage src={owner.avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px]">
              {(owner.display_name ?? owner.username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[8rem] truncate text-[11px] font-medium">
            @{owner.username}
          </span>
        </Link>
      )}
      {isSaved && onUnsave && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onUnsave();
          }}
          className="absolute right-2 top-2 rounded-md bg-background/90 p-1.5 text-foreground shadow-sm transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Unsave list"
        >
          <BookmarkX className="h-3.5 w-3.5" />
        </button>
      )}
      {isSelf && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onEdit();
            }}
            className="rounded-md bg-background/90 p-1.5 text-foreground shadow-sm hover:bg-background"
            aria-label="Edit list"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="rounded-md bg-background/90 p-1.5 text-destructive shadow-sm hover:bg-background"
            aria-label="Delete list"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}

function ListFormDialog({
  open,
  onOpenChange,
  userId,
  existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  existing?: UserList;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isPublic, setIsPublic] = useState(existing?.is_public ?? false);

  const mut = useMutation({
    mutationFn: async () => {
      if (existing) {
        await updateList({
          data: { id: existing.id, title, description, is_public: isPublic },
        });
      } else {
        await createList({
          data: { title, description, is_public: isPublic },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-lists", userId] });
      toast.success(existing ? "List updated" : "List created");
      onOpenChange(false);
      if (!existing) {
        setTitle("");
        setDescription("");
        setIsPublic(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit list" : "New list"}</DialogTitle>
          <DialogDescription>
            Give it a title and description. Public lists are visible to everyone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="My favorite thrillers"
              maxLength={80}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="What is this list about?"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Public</p>
              <p className="text-xs text-muted-foreground">
                Anyone can view this list on your profile.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !title.trim()}
          >
            {existing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
