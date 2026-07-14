import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MediaType } from "@/lib/tmdb";

export type LibraryStatus = "planned" | "watching" | "completed" | "dropped";

export interface WatchlistItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  series_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number | null;
  added_at: string;
  status: LibraryStatus;
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
    return (data ?? []).map((r) => ({
      ...r,
      status: (r.status ?? "planned") as LibraryStatus,
    })) as WatchlistItem[];
  });

export const addToWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      media_type: MediaType;
      series_name: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      first_air_date?: string | null;
      vote_average?: number | null;
      status?: LibraryStatus;
    }) => input
  )
  .handler(async ({ context, data }): Promise<WatchlistItem> => {
    // Do not downgrade an existing status: only set status if none/planned.
    const { data: existing } = await context.supabase
      .from("watchlist")
      .select("id, status")
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id)
      .maybeSingle();

    const desired = data.status ?? "planned";
    const priority: Record<string, number> = {
      planned: 0,
      watching: 1,
      completed: 2,
      dropped: 2,
    };
    const finalStatus =
      existing && priority[existing.status ?? "planned"] > priority[desired]
        ? (existing.status as LibraryStatus)
        : desired;

    const { status: _s, ...rest } = data;
    const { data: result, error } = await context.supabase
      .from("watchlist")
      .upsert(
        {
          user_id: context.userId,
          ...rest,
          status: finalStatus,
        },
        { onConflict: "user_id, media_type, tmdb_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return { ...result, status: (result.status ?? "planned") as LibraryStatus } as WatchlistItem;
  });

export const removeFromWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tmdb_id: number; media_type: MediaType }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .delete()
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });

export const setLibraryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tmdb_id: number;
      media_type: MediaType;
      status: LibraryStatus;
    }) => input
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .update({ status: data.status })
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });
