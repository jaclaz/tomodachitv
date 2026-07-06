import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/social.functions";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface BannerUploadProps {
  userId: string;
  currentUrl: string | null;
  onUpdated?: () => void;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// ~10 years in seconds
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export function BannerUpload({ userId, currentUrl, onUpdated }: BannerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED.includes(file.type)) {
        throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
      }
      if (file.size > MAX_SIZE) {
        throw new Error("Image must be under 5MB.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/banner-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: signed, error: signedError } = await supabase.storage
        .from("banners")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signedError || !signed?.signedUrl) {
        throw signedError ?? new Error("Could not generate banner URL");
      }

      await updateMyProfile({ data: { banner_url: signed.signedUrl } });
      return signed.signedUrl;
    },
    onSuccess: (url) => {
      setPreviewUrl(url);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Banner updated");
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      await updateMyProfile({ data: { banner_url: null } });
      return null;
    },
    onSuccess: () => {
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Banner removed");
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const shownUrl = previewUrl ?? currentUrl ?? undefined;

  return (
    <div className="group relative h-48 w-full overflow-hidden rounded-2xl sm:h-64">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={shownUrl ? { backgroundImage: `url(${shownUrl})` } : undefined}
      >
        {!shownUrl && (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-sm text-muted-foreground">No banner</span>
          </div>
        )}
      </div>

      {/* Blur / darkening overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Edit controls */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={mutation.isPending || removeMutation.isPending}
          aria-label="Change banner"
          className="inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:opacity-70"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Change banner
        </button>
        {shownUrl && (
          <button
            type="button"
            onClick={() => removeMutation.mutate()}
            disabled={mutation.isPending || removeMutation.isPending}
            aria-label="Remove banner"
            className="inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:opacity-70"
          >
            <X className="h-4 w-4" />
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) mutation.mutate(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
