import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MediaKind = "movie" | "tv";

export interface FavoriteItem {
  id: string;
  user_id: string;
  media_type: MediaKind;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  added_at: string;
}

export interface UserList {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
  preview_posters?: (string | null)[];
  saves_count?: number;
  is_saved_by_me?: boolean;
}

export interface TrendingList extends UserList {
  owner: { username: string; display_name: string | null; avatar_url: string | null } | null;
}


export interface ListItem {
  id: string;
  list_id: string;
  media_type: MediaKind;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  added_at: string;
}

// -------- Favorites --------

export const getUserFavorites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(async ({ context, data }): Promise<FavoriteItem[]> => {
    const { data: rows, error } = await context.supabase
      .from("favorites")
      .select("*")
      .eq("user_id", data.user_id)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as FavoriteItem[];
  });

export const getMyFavorites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FavoriteItem[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select("*")
      .eq("user_id", context.userId)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as FavoriteItem[];
  });

export const addFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      media_type: MediaKind;
      tmdb_id: number;
      title: string;
      poster_path?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("favorites").upsert(
      {
        user_id: context.userId,
        media_type: data.media_type,
        tmdb_id: data.tmdb_id,
        title: data.title,
        poster_path: data.poster_path ?? null,
      },
      { onConflict: "user_id, media_type, tmdb_id" },
    );
    if (error) throw error;
    return { success: true };
  });

export const removeFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { media_type: MediaKind; tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("favorites")
      .delete()
      .eq("user_id", context.userId)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });

// -------- Lists --------

export const getUserLists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(async ({ context, data }): Promise<UserList[]> => {
    const { data: lists, error } = await context.supabase
      .from("user_lists")
      .select("*")
      .eq("user_id", data.user_id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    if (!lists || lists.length === 0) return [];
    const ids = lists.map((l) => l.id);
    const { data: items } = await context.supabase
      .from("user_list_items")
      .select("list_id, poster_path, added_at")
      .in("list_id", ids)
      .order("added_at", { ascending: false });
    const grouped = new Map<string, { count: number; posters: (string | null)[] }>();
    for (const it of items ?? []) {
      const g = grouped.get(it.list_id) ?? { count: 0, posters: [] };
      g.count += 1;
      if (g.posters.length < 4) g.posters.push(it.poster_path);
      grouped.set(it.list_id, g);
    }
    return (lists as UserList[]).map((l) => {
      const g = grouped.get(l.id);
      return { ...l, item_count: g?.count ?? 0, preview_posters: g?.posters ?? [] };
    });
  });

export const createList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { title: string; description?: string | null; is_public?: boolean }) => input,
  )
  .handler(async ({ context, data }): Promise<UserList> => {
    const title = data.title.trim().slice(0, 80);
    if (!title) throw new Error("Title required");
    const { data: row, error } = await context.supabase
      .from("user_lists")
      .insert({
        user_id: context.userId,
        title,
        description: data.description?.trim().slice(0, 500) || null,
        is_public: !!data.is_public,
      })
      .select()
      .single();
    if (error) throw error;
    return row as UserList;
  });

export const updateList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id: string;
      title?: string;
      description?: string | null;
      is_public?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const patch: {
      title?: string;
      description?: string | null;
      is_public?: boolean;
    } = {};
    if (data.title !== undefined) patch.title = data.title.trim().slice(0, 80);
    if (data.description !== undefined)
      patch.description = data.description?.trim().slice(0, 500) || null;
    if (data.is_public !== undefined) patch.is_public = data.is_public;
    const { error } = await context.supabase
      .from("user_lists")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

export const deleteList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_lists")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

export const getListWithItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }): Promise<{ list: UserList; items: ListItem[] } | null> => {
    const { data: list, error } = await context.supabase
      .from("user_lists")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!list) return null;
    const { data: items } = await context.supabase
      .from("user_list_items")
      .select("*")
      .eq("list_id", data.id)
      .order("added_at", { ascending: false });
    return { list: list as UserList, items: (items ?? []) as ListItem[] };
  });

export const addListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      list_id: string;
      media_type: MediaKind;
      tmdb_id: number;
      title: string;
      poster_path?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("user_list_items").upsert(
      {
        list_id: data.list_id,
        media_type: data.media_type,
        tmdb_id: data.tmdb_id,
        title: data.title,
        poster_path: data.poster_path ?? null,
      },
      { onConflict: "list_id, media_type, tmdb_id" },
    );
    if (error) throw error;
    // bump list updated_at
    await context.supabase
      .from("user_lists")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.list_id)
      .eq("user_id", context.userId);
    return { success: true };
  });

export const removeListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { list_id: string; media_type: MediaKind; tmdb_id: number }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_list_items")
      .delete()
      .eq("list_id", data.list_id)
      .eq("media_type", data.media_type)
      .eq("tmdb_id", data.tmdb_id);
    if (error) throw error;
    return { success: true };
  });

// Recent watched with posters (via media_cache lookup)
export interface RecentWatchedMedia {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  watched_at: string;
}

export const getUserRecentWatchedMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { user_id: string }) => input)
  .handler(
    async ({
      context,
      data,
    }): Promise<{ movies: RecentWatchedMedia[]; series: RecentWatchedMedia[] }> => {
      const [{ data: movies }, { data: episodes }] = await Promise.all([
        context.supabase
          .from("watched_movies")
          .select("tmdb_id, title, watched_at")
          .eq("user_id", data.user_id)
          .order("watched_at", { ascending: false })
          .limit(30),
        context.supabase
          .from("watched_episodes")
          .select("tmdb_id, watched_at")
          .eq("user_id", data.user_id)
          .order("watched_at", { ascending: false })
          .limit(200),
      ]);
      // unique series preserving order
      const seenSeries = new Map<number, string>();
      for (const e of episodes ?? []) {
        if (!seenSeries.has(e.tmdb_id)) seenSeries.set(e.tmdb_id, e.watched_at);
      }
      const seriesIds = [...seenSeries.keys()];
      const movieIds = (movies ?? []).map((m) => m.tmdb_id);
      const allIds = [...new Set([...seriesIds, ...movieIds])];
      let cacheMap = new Map<string, { title: string | null; poster_path: string | null }>();
      if (allIds.length > 0) {
        const { data: cache } = await context.supabase
          .from("media_cache")
          .select("media_type, tmdb_id, title, poster_path")
          .in("tmdb_id", allIds);
        cacheMap = new Map(
          (cache ?? []).map((c) => [
            `${c.media_type}:${c.tmdb_id}`,
            { title: c.title, poster_path: c.poster_path },
          ]),
        );
      }
      return {
        movies: (movies ?? []).map((m) => {
          const c = cacheMap.get(`movie:${m.tmdb_id}`);
          return {
            tmdb_id: m.tmdb_id,
            title: m.title ?? c?.title ?? `#${m.tmdb_id}`,
            poster_path: c?.poster_path ?? null,
            watched_at: m.watched_at,
          };
        }),
        series: seriesIds.map((id) => {
          const c = cacheMap.get(`tv:${id}`);
          return {
            tmdb_id: id,
            title: c?.title ?? `#${id}`,
            poster_path: c?.poster_path ?? null,
            watched_at: seenSeries.get(id)!,
          };
        }),
      };
    },
  );
