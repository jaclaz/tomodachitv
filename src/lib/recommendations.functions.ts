import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const dismissRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { media_type: "tv" | "movie"; tmdb_id: number }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recommendation_dismissals")
      .upsert(
        {
          user_id: context.userId,
          media_type: data.media_type,
          tmdb_id: data.tmdb_id,
        },
        { onConflict: "user_id,media_type,tmdb_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const undoDismissRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { media_type: "tv" | "movie"; tmdb_id: number }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recommendation_dismissals")
      .delete()
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
