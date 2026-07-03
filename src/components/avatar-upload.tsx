import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/social.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  fallback: string;
  onUpdated?: () => void;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// ~10 years in seconds
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export function AvatarUpload({ userId, currentUrl, fallback, onUpdated }: AvatarUploadProps) {
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
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: signed, error: signedError } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signedError || !signed?.signedUrl) {
        throw signedError ?? new Error("Could not generate avatar URL");
      }

      await updateMyProfile({ data: { avatar_url: signed.signedUrl } });
      return signed.signedUrl;
    },
    onSuccess: (url) => {
      setPreviewUrl(url);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile photo updated");
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const shownUrl = previewUrl ?? currentUrl ?? undefined;

  return (
    <div className="relative">
      <Avatar className="h-24 w-24">
        <AvatarImage src={shownUrl} />
        <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
      </Avatar>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={mutation.isPending}
        aria-label="Change profile photo"
        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 disabled:opacity-100"
      >
        {mutation.isPending ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Camera className="h-6 w-6" />
        )}
      </button>
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
