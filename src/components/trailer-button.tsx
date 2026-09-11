import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTrailer, type MediaType } from "@/lib/tmdb";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface TrailerButtonProps {
  mediaType: MediaType;
  tmdbId: number;
  season?: number;
  /** "link": small inline text link; "icon": compact round icon button. */
  variant?: "link" | "icon";
  label?: string;
}

export function TrailerButton({
  mediaType,
  tmdbId,
  season,
  variant = "link",
  label,
}: TrailerButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: trailer } = useQuery({
    queryKey: ["trailer", mediaType, tmdbId, season ?? null],
    queryFn: () => getTrailer({ data: { type: mediaType, id: tmdbId, season } }),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !isNaN(tmdbId),
  });

  if (!trailer) return null;

  const ariaLabel =
    label ??
    `Watch ${season != null ? `season ${season} ` : ""}trailer`;

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label={ariaLabel}
          title={ariaLabel}
          className="mb-2 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Play className="h-4 w-4" />
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          aria-label={ariaLabel}
        >
          <Play className="h-3.5 w-3.5" />
          Watch trailer
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl border-border bg-background p-2 sm:p-3">
          <DialogTitle className="sr-only">{trailer.name}</DialogTitle>
          {open && (
            <div className="aspect-video w-full overflow-hidden rounded-lg">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`}
                title={trailer.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
