import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, XCircle, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  dropShow,
  removeShowFromLibrary,
  undropShow,
} from "@/lib/dropped.functions";
import { toast } from "sonner";

interface Props {
  tmdb_id: number;
  title: string;
  mode?: "watchlist" | "dropped";
}

export function ShowActionsMenu({ tmdb_id, title, mode = "watchlist" }: Props) {
  const qc = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["watchlist"] });
    qc.invalidateQueries({ queryKey: ["watched-library"] });
    qc.invalidateQueries({ queryKey: ["currently-watching"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const dropMut = useMutation({
    mutationFn: () => dropShow({ data: { tmdb_id } }),
    onSuccess: () => {
      toast.success(`Dropped “${title}”`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undropMut = useMutation({
    mutationFn: () => undropShow({ data: { tmdb_id } }),
    onSuccess: () => {
      toast.success(`“${title}” back to watching`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => removeShowFromLibrary({ data: { tmdb_id } }),
    onSuccess: () => {
      toast.success(`Removed “${title}” from library`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 bg-background/80 backdrop-blur"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Show options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {mode === "watchlist" ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                dropMut.mutate();
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Drop this show
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                undropMut.mutate();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Resume watching
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmRemove(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove from library
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{title}” from your library?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every watched episode for this show, along with its
              watchlist and dropped entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeMut.mutate()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
