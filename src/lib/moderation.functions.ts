import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `You are a strict content moderator for profile pictures and banners on a public social app.
Classify the image and reply with STRICT JSON of the form:
{"safe": boolean, "category": "ok"|"nsfw"|"violence"|"hate"|"gore"|"illegal"|"other", "reason": string}
Reject (safe=false) any: nudity, sexual content, explicit/suggestive poses, gore or graphic violence, hate symbols, illegal content, or content clearly unsuitable for a general audience (13+).
Allow (safe=true) ordinary photos of people, art, characters, landscapes, logos, memes, movie/TV promotional stills.`;

type ModerationResult = {
  safe: boolean;
  category: string;
  reason: string;
};

async function classify(imageUrl: string): Promise<ModerationResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    // Fail open if the gateway isn't configured — don't block uploads.
    return { safe: true, category: "ok", reason: "moderation-disabled" };
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Moderate this image. Reply with JSON only." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    // Fail open on gateway errors — don't block user uploads on infra hiccups.
    return { safe: true, category: "ok", reason: `gateway-${res.status}` };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { safe: true, category: "ok", reason: "parse-failed" };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ModerationResult>;
    return {
      safe: parsed.safe !== false,
      category: parsed.category ?? "ok",
      reason: parsed.reason ?? "",
    };
  } catch {
    return { safe: true, category: "ok", reason: "parse-failed" };
  }
}

/**
 * Moderate an uploaded avatar/banner. If unsafe, deletes the object from storage
 * and files an auto-moderation report so admins can review the case.
 */
export const moderateProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        url: z.string().url(),
        bucket: z.enum(["avatars", "banners"]),
        path: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { url, bucket, path } = data;
    const { supabase, userId } = context;

    const result = await classify(url);
    if (result.safe) return { safe: true as const };

    // Remove the offending object from storage.
    await supabase.storage.from(bucket).remove([path]).catch(() => {});

    // File an auto-moderation report (best-effort — needs service role to bypass
    // the "reporter <> reported" check for self-reports).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("profile_reports").insert({
        reporter_id: userId,
        reported_user_id: userId,
        reason: `auto:${result.category}`,
        details: `Auto-moderation blocked ${bucket} upload: ${result.reason}`.slice(0, 500),
        source: "auto_moderation",
        status: "pending",
      });
    } catch {
      // ignore — logging is best-effort
    }

    return {
      safe: false as const,
      category: result.category,
      reason: result.reason,
    };
  });
