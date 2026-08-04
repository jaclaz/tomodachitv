import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, body, link, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as AppNotification[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Internal helper used by admin flows. Runs as service role so it can write to any user. */
export async function createNotification(
  user_id: string,
  type: string,
  title: string,
  body: string | null,
  link: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id,
    type,
    title,
    body,
    link,
    read: false,
  });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export type NotificationPreferences = {
  follows: boolean;
  new_episodes: boolean;
  new_releases: boolean;
  moderation: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  follows: true,
  new_episodes: true,
  new_releases: true,
  moderation: true,
};

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPreferences> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("follows, new_episodes, new_releases, moderation")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as NotificationPreferences | null) ?? DEFAULT_PREFS;
  });

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        follows: z.boolean().optional(),
        new_episodes: z.boolean().optional(),
        new_releases: z.boolean().optional(),
        moderation: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Release / episode notifications                                     */
/* ------------------------------------------------------------------ */

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch(path: string) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  const res = await fetch(`${TMDB_BASE}${path}?api_key=${key}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

function daysAgo(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

type NewNotification = {
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  dedupe_key: string;
};

/**
 * Scans the user's library and creates notifications for episodes that aired
 * or movies released in the last 7 days. Deduplicated per item.
 */
export const syncMediaNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: prefRow } = await supabase
      .from("notification_preferences")
      .select("new_episodes, new_releases")
      .eq("user_id", userId)
      .maybeSingle();
    const wantEpisodes = prefRow?.new_episodes ?? true;
    const wantReleases = prefRow?.new_releases ?? true;
    if (!wantEpisodes && !wantReleases) return { created: 0 };

    const { data: library, error } = await supabase
      .from("watchlist")
      .select("tmdb_id, media_type, series_name, status")
      .eq("user_id", userId)
      .in("status", ["planned", "watching"])
      .limit(80);
    if (error) throw new Error(error.message);

    const pending: NewNotification[] = [];

    await Promise.all(
      (library ?? []).map(async (item) => {
        try {
          if (item.media_type === "movie") {
            if (!wantReleases) return;
            const raw = await tmdbFetch(`/movie/${item.tmdb_id}`);
            const age = daysAgo(raw.release_date);
            if (age === null || age < 0 || age > 7) return;
            pending.push({
              user_id: userId,
              type: "new_release",
              title: "New release",
              body: `${raw.title ?? item.series_name} is out now`,
              link: `/movie/${item.tmdb_id}`,
              dedupe_key: `release:movie:${item.tmdb_id}`,
            });
          } else {
            if (!wantEpisodes) return;
            const raw = await tmdbFetch(`/tv/${item.tmdb_id}`);
            const last = raw.last_episode_to_air;
            const age = daysAgo(last?.air_date);
            if (!last || age === null || age < 0 || age > 7) return;
            pending.push({
              user_id: userId,
              type: "new_episode",
              title: "New episode",
              body: `${raw.name ?? item.series_name} S${last.season_number}E${last.episode_number}${
                last.name ? ` — ${last.name}` : ""
              } is available`,
              link: `/serie/${item.tmdb_id}`,
              dedupe_key: `episode:${item.tmdb_id}:${last.season_number}:${last.episode_number}`,
            });
          }
        } catch {
          /* ignore single-item failures */
        }
      }),
    );

    if (pending.length === 0) return { created: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .upsert(pending, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
    if (insertError) throw new Error(insertError.message);

    return { created: pending.length };
  });

