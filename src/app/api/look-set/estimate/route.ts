import { NextResponse } from "next/server";
import { hasAI, hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { generateConstructedLookOpinion } from "@/lib/ai/tryon-opinion";
import { lookSetOccasionLabel } from "@/lib/look-contexts";
import {
  estimateMatchesLook,
  lookEstimateFingerprint,
  parseLookEstimates,
  type StoredLookEstimate,
} from "@/lib/look-estimate";
import { estimatesFromArchived } from "@/lib/look-archive";
import { saveConstructEstimate } from "@/lib/data/look-sets";
import { styleProfileSchema, type StyleProfile } from "@/lib/style-profile";
import type { ShoppingItem } from "@/lib/report";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Carlo's estimate of a constructor-rebuilt look. Free text — no credits.
 * Cached on look_sets.construct_estimates when that column exists.
 */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ opinion: null, hasProfile: false });
  }
  if (!hasAI) {
    return NextResponse.json({ opinion: null, hasProfile: false });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const setId: unknown = body?.setId;
  const lookIndex: unknown = body?.lookIndex;
  if (typeof setId !== "string" || !setId) {
    return NextResponse.json({ error: "Missing setId" }, { status: 400 });
  }
  if (typeof lookIndex !== "number" || !Number.isInteger(lookIndex) || lookIndex < 0) {
    return NextResponse.json({ error: "Invalid lookIndex" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: setRow, error: setErr } = await admin
    .from("look_sets")
    .select("id, occasion_id, look_items")
    .eq("id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (setErr) {
    console.error("[look-estimate] set query failed", setId, setErr.message);
  }
  if (!setRow) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const { data: lookRows, error: lookErr } = await admin
    .from("looks")
    .select("idx, title, description")
    .eq("set_id", setId)
    .eq("idx", lookIndex)
    .order("created_at", { ascending: false })
    .limit(1);
  if (lookErr) {
    console.error("[look-estimate] look query failed", setId, lookErr.message);
  }
  const look = lookRows?.[0] as
    | { title?: string | null; description?: string | null }
    | undefined;
  if (!look) {
    return NextResponse.json({ error: "Look not found" }, { status: 404 });
  }

  const lookItems =
    (setRow.look_items as Record<number | string, ShoppingItem[]> | null) ?? {};
  const items = Array.isArray(lookItems[lookIndex])
    ? lookItems[lookIndex]
    : Array.isArray(lookItems[String(lookIndex)])
      ? lookItems[String(lookIndex)]
      : [];
  const title = typeof look.title === "string" ? look.title : "Look";
  const description = typeof look.description === "string" ? look.description : "";
  const fingerprint = lookEstimateFingerprint(description, items);

  const cached = await readCachedEstimate(admin, setId, lookIndex);
  if (estimateMatchesLook(cached, fingerprint)) {
    return NextResponse.json({
      opinion: cached!.opinion,
      hasProfile: true,
      cached: true,
    });
  }

  const profile = await loadSetProfile(admin, user.id, setId);
  const garments = items.map((item) => ({
    title: item.title,
    category: item.category,
    color: item.colorName ?? item.color,
  }));

  const opinion = await generateConstructedLookOpinion({
    title,
    description,
    garments,
    profile,
    occasionLabel: lookSetOccasionLabel(setRow.occasion_id as string | null),
  });
  if (!opinion) {
    return NextResponse.json({ opinion: null, hasProfile: Boolean(profile) });
  }

  const stored: StoredLookEstimate = {
    opinion,
    fingerprint,
    savedAt: new Date().toISOString(),
  };
  await saveConstructEstimate(admin, setId, lookIndex, stored);

  return NextResponse.json({
    opinion,
    hasProfile: Boolean(profile),
    cached: false,
  });
}

async function readCachedEstimate(
  admin: ReturnType<typeof createAdminSupabase>,
  setId: string,
  lookIndex: number,
): Promise<StoredLookEstimate | null> {
  const { data, error } = await admin
    .from("look_sets")
    .select("construct_estimates")
    .eq("id", setId)
    .maybeSingle();
  if (!error && data) {
    return parseLookEstimates(data.construct_estimates)[lookIndex] ?? null;
  }
  const archived = await admin
    .from("look_sets")
    .select("archived_images")
    .eq("id", setId)
    .maybeSingle();
  if (archived.error || !archived.data) return null;
  return estimatesFromArchived(archived.data.archived_images)[lookIndex] ?? null;
}

async function loadSetProfile(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
  setId: string,
): Promise<StyleProfile | null> {
  const { data } = await admin
    .from("look_set_profiles")
    .select("profile")
    .eq("set_id", setId)
    .eq("user_id", userId)
    .maybeSingle();
  const parsed = styleProfileSchema.safeParse(data?.profile);
  if (parsed.success) return parsed.data;
  if (data?.profile && typeof data.profile === "object") {
    return data.profile as StyleProfile;
  }
  return null;
}
