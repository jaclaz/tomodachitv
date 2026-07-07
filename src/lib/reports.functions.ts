import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  status: "pending" | "reviewed" | "dismissed";
  source: "user" | "auto_moderation";
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reporter_username: string | null;
  reporter_display_name: string | null;
  reported_username: string | null;
  reported_display_name: string | null;
  reported_avatar_url: string | null;
  reported_banner_url: string | null;
};

async function requireAdmin(
  supabase: Awaited<ReturnType<typeof requireSupabaseAuth>> extends never
    ? never
    : Parameters<Parameters<typeof requireSupabaseAuth>[0] extends never ? never : never>[0],
) {
  void supabase;
}

export const listProfileReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.enum(["pending", "reviewed", "dismissed", "all"]).default("pending"),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminReport[]> => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

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
        status: z.enum(["reviewed", "dismissed"]),
        admin_notes: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabase
      .from("profile_reports")
      .update({
        status: data.status,
        admin_notes: data.admin_notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearReportedProfileImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: null, banner_url: null })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    return { admin: Boolean(data) };
  });
