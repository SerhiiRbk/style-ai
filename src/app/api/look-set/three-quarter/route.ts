import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { styleProfileSchema, type StyleProfile } from "@/lib/style-profile";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import {
  cacheBustAssetUrl,
  renderAndStoreThreeQuarterLook,
} from "@/lib/data/look-three-quarter";
import { resolveLookSetReferencePhotos } from "@/lib/photo-tryon";

export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * Generate a 3/4 companion for a ready look (+1 credit). The front image stays
 * the lock so clothes don't drift. Does not run on initial set creation.
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Image generation is not configured" },
      { status: 501 },
    );
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
  const { data: setRow } = await admin
    .from("look_sets")
    .select("id, report_id, created_at")
    .eq("id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!setRow) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }
  const reportId = (setRow.report_id as string | null) ?? null;
  const setCreatedAt = (setRow.created_at as string | null) ?? null;

  type TqLookRow = {
    id: string;
    idx: number | null;
    title: string | null;
    description: string | null;
    palette: string[] | null;
    image_path: string | null;
    image_path_tq?: string | null;
    report_id?: string | null;
  };
  const lookSelectTq =
    "id, idx, title, description, palette, image_path, image_path_tq, report_id";
  const lookSelect =
    "id, idx, title, description, palette, image_path, report_id";
  let byIdx: TqLookRow[] | null = null;
  let byIdxErr: { message: string } | null = null;
  {
    const first = await admin
      .from("looks")
      .select(lookSelectTq)
      .eq("set_id", setId)
      .eq("idx", lookIndex)
      .order("created_at", { ascending: false })
      .limit(1);
    if (first.error && /image_path_tq/.test(first.error.message)) {
      const fallback = await admin
        .from("looks")
        .select(lookSelect)
        .eq("set_id", setId)
        .eq("idx", lookIndex)
        .order("created_at", { ascending: false })
        .limit(1);
      byIdx = (fallback.data ?? null) as TqLookRow[] | null;
      byIdxErr = fallback.error;
    } else {
      byIdx = (first.data ?? null) as TqLookRow[] | null;
      byIdxErr = first.error;
    }
  }
  if (byIdxErr) {
    console.error("[look-set] 3/4 look by idx failed", setId, lookIndex, byIdxErr);
  }
  let lookRow = byIdx?.[0] ?? null;
  if (!lookRow) {
    const first = await admin
      .from("looks")
      .select(lookSelectTq)
      .eq("set_id", setId)
      .order("idx", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    const listed =
      first.error && /image_path_tq/.test(first.error.message)
        ? await admin
            .from("looks")
            .select(lookSelect)
            .eq("set_id", setId)
            .order("idx", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true })
        : first;
    if (listed.error) {
      console.error("[look-set] 3/4 looks list failed", setId, listed.error);
    }
    const rows = (listed.data ?? []) as TqLookRow[];
    lookRow = rows.find((r) => r.idx === lookIndex) ?? rows[lookIndex] ?? null;
  }
  if (!lookRow?.image_path) {
    return NextResponse.json(
      { error: "Look not found", code: "look_not_found" },
      { status: 409 },
    );
  }
  if (lookRow.image_path_tq) {
    const existing = lookRow.image_path_tq;
    return NextResponse.json({
      ok: true,
      imageTq: cacheBustAssetUrl(signedAssetProxyUrl(existing)),
      alreadyHad: true,
    });
  }

  const { data: profRow, error: profErr } = await admin
    .from("look_set_profiles")
    .select("profile")
    .eq("set_id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) {
    console.error("[look-set] 3/4 profile failed", setId, profErr);
  }
  const parsed = styleProfileSchema.safeParse(profRow?.profile);
  let profile = parsed.success ? parsed.data : null;
  if (!profile && profRow?.profile && typeof profRow.profile === "object") {
    profile = profRow.profile as StyleProfile;
  }
  if (!profile) {
    return NextResponse.json(
      { error: "Look profile missing", code: "profile_missing" },
      { status: 409 },
    );
  }

  let facePath: string | null = null;
  let fullPath: string | null = null;
  const { data: rp, error: rpErr } = await admin
    .from("look_set_profiles")
    .select("face_ref_path, full_ref_path")
    .eq("set_id", setId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!rpErr) {
    facePath = (rp?.face_ref_path as string | null) ?? null;
    fullPath = (rp?.full_ref_path as string | null) ?? null;
  }

  const cost = CREDIT_COSTS.look_three_quarter;
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(admin, user.id);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: "Not enough credits.",
          code: "insufficient_credits",
          balance,
          needed: cost,
        },
        { status: 402 },
      );
    }
  }

  const refs = await resolveLookSetReferencePhotos(admin, {
    userId: user.id,
    setId,
    facePath,
    fullPath,
    reportId: reportId ?? lookRow.report_id ?? null,
    reportCreatedAt: setCreatedAt,
  });
  const faceRefUrl = refs.faceUrl;
  const fullRefUrl = refs.fullUrl;

  const title = lookRow.title ?? "Look";
  const description = lookRow.description ?? "";
  const palette = lookRow.palette ?? [];
  const tqPath = await renderAndStoreThreeQuarterLook({
    admin,
    userId: user.id,
    setId,
    lookIndex,
    profile,
    look: { title, description, palette },
    faceRefUrl,
    fullRefUrl,
    frontImagePath: lookRow.image_path,
  });
  if (!tqPath) {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  let { error: updErr } = await admin
    .from("looks")
    .update({ image_path_tq: tqPath })
    .eq("id", lookRow.id);
  if (updErr && /image_path_tq/.test(updErr.message)) {
    return NextResponse.json(
      { error: "3/4 storage is not available yet" },
      { status: 501 },
    );
  }
  if (updErr) {
    return NextResponse.json({ error: "Could not save look" }, { status: 500 });
  }

  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "look_three_quarter",
        refId: setId,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits.",
            code: "insufficient_credits",
            balance: e.balance,
            needed: e.needed,
          },
          { status: 402 },
        );
      }
      throw e;
    }
  }

  return NextResponse.json({
    ok: true,
    balance,
    imageTq: cacheBustAssetUrl(signedAssetProxyUrl(tqPath)),
  });
}
