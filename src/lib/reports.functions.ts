import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createNotification } from "./notifications.functions";

const REPORT_REASONS = [
  "explicit_image",
  "harassment",
  "hate_speech",
  "spam",
  "impersonation",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const createProfileReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reported_user_id: z.string().uuid(),
        reason: z.enum(REPORT_REASONS),
        details: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.reported_user_id === userId) {
      throw new Error("You cannot report yourself.");
    }
    const { error } = await supabase.from("profile_reports").insert({
      reporter_id: userId,
      reported_user_id: data.reported_user_id,
      reason: data.reason,
      details: data.details ?? null,
      source: "user",
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("You already have a pending report for this profile.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export type AdminReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "actioned" | "dismissed";
  source: "user" | "auto_moderation";
  admin_notes: string | null;
  action_taken: string | null;
  created_at: string;
  reviewed_at: string | null;
  reporter_username: string | null;
  reporter_display_name: string | null;
  reported_username: string | null;
  reported_display_name: string | null;
  reported_avatar_url: string | null;
  reported_banner_url: string | null;
};

export const listProfileReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.enum(["pending", "actioned", "dismissed", "all"]).default("pending"),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminReport[]> => {
    const { supabase, userId } = context;

    const { data: isAdminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdminRole) throw new Error("Forbidden");

    let query = supabase
      .from("profile_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];

    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id])),
    );
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url")
      .in("id", userIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return rows.map((r) => {
      const reporter = byId.get(r.reporter_id);
      const reported = byId.get(r.reported_user_id);
      return {
        id: r.id,
        reporter_id: r.reporter_id,
        reported_user_id: r.reported_user_id,
        reason: r.reason,
        details: r.details,
        status: r.status as AdminReport["status"],
        source: r.source as AdminReport["source"],
        admin_notes: r.admin_notes,
        action_taken: r.action_taken,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        reporter_username: reporter?.username ?? null,
        reporter_display_name: reporter?.display_name ?? null,
        reported_username: reported?.username ?? null,
        reported_display_name: reported?.display_name ?? null,
        reported_avatar_url: reported?.avatar_url ?? null,
        reported_banner_url: reported?.banner_url ?? null,
      };
    });
  });

export const resolveProfileReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        resolution: z.enum(["actioned", "dismissed"]),
        admin_notes: z.string().max(500).optional(),
        notify_message: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdminRole) throw new Error("Forbidden");

    const { data: report, error: fetchErr } = await supabase
      .from("profile_reports")
      .select("reported_user_id, status, reason")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!report) throw new Error("Report not found");
    if (report.status !== "pending") throw new Error("Report is already resolved");

    const { error } = await supabase
      .from("profile_reports")
      .update({
        status: data.resolution,
        action_taken: data.resolution === "actioned" ? "warned_user" : "dismissed",
        admin_notes: data.admin_notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.resolution === "actioned") {
      const body = data.notify_message?.trim()
        ? data.notify_message.trim()
        : `A moderator reviewed your profile content and found it violates our community guidelines. Reason: ${report.reason}.`;
      await createNotification(
        report.reported_user_id,
        "profile_report_action",
        "Your profile content was reported",
        body,
        null,
      ).catch(() => {});
    }

    return { ok: true };
  });

export const clearReportedProfileImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), report_id: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdminRole) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: null, banner_url: null })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    if (data.report_id) {
      const { data: report } = await supabaseAdmin
        .from("profile_reports")
        .select("reported_user_id, status")
        .eq("id", data.report_id)
        .maybeSingle();
      if (report && report.status === "pending") {
        await supabaseAdmin
          .from("profile_reports")
          .update({
            status: "actioned",
            action_taken: "cleared_images",
            reviewed_at: new Date().toISOString(),
            reviewed_by: userId,
          })
          .eq("id", data.report_id);
        await createNotification(
          report.reported_user_id,
          "profile_report_action",
          "Your profile images were removed",
          "A moderator removed your avatar and/or banner because it violated our community guidelines. You can upload a new image that follows the rules.",
          null,
        ).catch(() => {});
      }
    }

    return { ok: true };
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: Boolean(data) };
  });

export type AdminStats = {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers7d: number;
  totalShowsTracked: number;
  totalMoviesTracked: number;
  watchedEpisodes: number;
  watchedMovies: number;
  totalLists: number;
  totalFollows: number;
  pendingReports: number;
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { supabase, userId } = context;
    const { data: isAdminRole, error: roleErr } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdminRole) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = (days: number) =>
      new Date(Date.now() - days * 86400_000).toISOString();

    const count = async (
      table: string,
      apply?: (q: any) => any,
    ): Promise<number> => {
      let q = (supabaseAdmin as any).from(table).select("*", { count: "exact", head: true });
      if (apply) q = apply(q);
      const { count: c } = await q;
      return c ?? 0;
    };

    const distinctActive = async (): Promise<number> => {
      const ids = new Set<string>();
      for (const table of ["watched_episodes", "watched_movies"]) {
        const { data } = await (supabaseAdmin as any)
          .from(table)
          .select("user_id")
          .gte("watched_at", since(7))
          .limit(5000);
        for (const r of (data ?? []) as { user_id: string }[]) ids.add(r.user_id);
      }
      return ids.size;
    };

    const [
      totalUsers,
      newUsers7d,
      newUsers30d,
      activeUsers7d,
      totalShowsTracked,
      totalMoviesTracked,
      watchedEpisodes,
      watchedMovies,
      totalLists,
      totalFollows,
      pendingReports,
    ] = await Promise.all([
      count("profiles"),
      count("profiles", (q: any) => q.gte("created_at", since(7))),
      count("profiles", (q: any) => q.gte("created_at", since(30))),
      distinctActive(),
      count("watchlist", (q: any) => q.eq("media_type", "tv")),
      count("watchlist", (q: any) => q.eq("media_type", "movie")),
      count("watched_episodes"),
      count("watched_movies"),
      count("user_lists"),
      count("follows"),
      count("profile_reports", (q: any) => q.eq("status", "pending")),
    ]);

    return {
      totalUsers,
      newUsers7d,
      newUsers30d,
      activeUsers7d,
      totalShowsTracked,
      totalMoviesTracked,
      watchedEpisodes,
      watchedMovies,
      totalLists,
      totalFollows,
      pendingReports,
    };
  });
