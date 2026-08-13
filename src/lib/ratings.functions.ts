import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RatingMediaKind = "movie" | "tv";

export interface UserRating {
  id: string;
  user_id: string;
  media_type: RatingMediaKind;
  tmdb_id: number;
  rating: number;
  title: string | null;
  poster_path: string | null;
  created_at: string;
  updated_at: string;
}

const normalize = (rows: unknown[]): UserRating[] =>
  (rows ?? []).map((r) => {
    const row = r as UserRating & { rating: number | string };
    return { ...row, rating: Number(row.rating) };
  });

export const getMyRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserRating[]> => {
    const { data, error } = await context.supabase
      .from("user_ratings")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return normalize(data ?? []);
  });

export const getUserRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(async ({ context, data }): Promise<UserRating[]> => {
    const { data: rows, error } = await context.supabase
      .from("user_ratings")
      .select("*")
      .eq("user_id", data.user_id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return normalize(rows ?? []);
  });

export const setRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      media_type: RatingMediaKind;
      tmdb_id: number;
      rating: number;
      title?: string | null;
      poster_path?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const rating = Math.round(Math.min(5, Math.max(0.5, data.rating)) * 2) / 2;
    const { error } = await context.supabase.from("user_ratings").upsert(
      {
        user_id: context.userId,
        media_type: data.media_type,
        tmdb_id: data.tmdb_id,
        rating,
        title: data.title ?? null,
        poster_path: data.poster_path ?? null,
      },
      { onConflict: "user_id,media_type,tmdb_id" },
    );
    if (error) throw error;
    return { ok: true, rating };
  });

export const clearRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { media_type: RatingMediaKind; tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_ratings")
      .delete()
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { ok: true };
  });
