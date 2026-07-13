import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDroppedShowIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number[]> => {
    const { data, error } = await context.supabase
      .from("dropped_shows")
      .select("tmdb_id")
      .eq("user_id", context.userId);
    if (error) throw error;
    return (data ?? []).map((r) => r.tmdb_id);
  });

export const dropShow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("dropped_shows").upsert(
      { user_id: context.userId, tmdb_id: data.tmdb_id },
      { onConflict: "user_id, tmdb_id" }
    );
    if (error) throw error;
    // Remove from watchlist too — no longer "to watch"
    await context.supabase
      .from("watchlist")
      .delete()
      .eq("user_id", context.userId)
      .eq("media_type", "tv")
      .eq("tmdb_id", data.tmdb_id);
    return { success: true };
  });

export const undropShow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("dropped_shows")
      .delete()
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });

export const removeShowFromLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    // Wipe all traces of this show for the user
    const [a, b, c] = await Promise.all([
      context.supabase
        .from("watched_episodes")
        .delete()
        .eq("user_id", context.userId)
        .eq("tmdb_id", data.tmdb_id),
      context.supabase
        .from("watchlist")
        .delete()
        .eq("user_id", context.userId)
        .eq("media_type", "tv")
        .eq("tmdb_id", data.tmdb_id),
      context.supabase
        .from("dropped_shows")
        .delete()
        .eq("user_id", context.userId)
        .eq("tmdb_id", data.tmdb_id),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    if (c.error) throw c.error;
    return { success: true };
  });
