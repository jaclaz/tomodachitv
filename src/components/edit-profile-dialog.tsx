import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateMyProfile } from "@/lib/social.functions";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDisplayName: string | null;
  currentUsername: string;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  currentDisplayName,
  currentUsername,
}: EditProfileDialogProps) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(currentDisplayName ?? "");
  const [username, setUsername] = useState(currentUsername);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: { display_name?: string; username?: string } = {};
      const trimmedName = displayName.trim();
      if (trimmedName && trimmedName !== (currentDisplayName ?? "")) {
        payload.display_name = trimmedName.slice(0, 60);
      }
      const cleanTag = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (cleanTag && cleanTag !== currentUsername) payload.username = cleanTag;
      if (Object.keys(payload).length === 0)
        return Promise.resolve({ success: true, unchanged: true });
      return updateMyProfile({ data: payload });
    },
    onSuccess: (res: { unchanged?: boolean } | { success: true }) => {
      const changedUsername =
        username.toLowerCase().replace(/[^a-z0-9_]/g, "") !== currentUsername;
      toast.success("Profile updated");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (changedUsername && !("unchanged" in res && res.unchanged)) {
        // Redirect to new URL after tag change
        const newTag = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
        window.location.href = `/u/${newTag}`;
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update your display name and user tag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-display-name">Display name</Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
              placeholder="Your name"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-username">User tag</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24),
                  )
                }
                placeholder="username"
                maxLength={24}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Only lowercase letters, numbers and underscores. Must be unique.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
