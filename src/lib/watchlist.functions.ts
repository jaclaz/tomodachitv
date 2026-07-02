import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WatchlistItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  series_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number | null;
  added_at: string;
}

export const getWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchlistItem[]> => {
    const { data, error } = await context.supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", context.userId)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const addToWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tmdb_id: number;
      series_name: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      first_air_date?: string | null;
      vote_average?: number | null;
    }) => input
  )
  .handler(async ({ context, data }): Promise<WatchlistItem> => {
    const { data: result, error } = await context.supabase
      .from("watchlist")
      .upsert(
        {
          user_id: context.userId,
          ...data,
        },
        { onConflict: "user_id, tmdb_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return result;
  });

export const removeFromWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .delete()
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });
