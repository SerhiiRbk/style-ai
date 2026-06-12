import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { generateLookImage } from "@/lib/ai/pipeline";
import { getReportById } from "@/lib/data/reports";
import { isDemoReportId } from "@/lib/demo-report";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import {
  catalogImageUrlsFromItems,
  catalogPromptFromItems,
  formatLookKey,
  resolveLookCatalogItems,
  tryonStoragePath,
  type LookTryOnKind,
} from "@/lib/look-tryon";
import type { StyleProfile } from "@/lib/style-profile";
import type { ShoppingItem } from "@/lib/report";
import { getFullLengthPhotoUrl } from "@/lib/photo-tryon";
import { signedAssetProxyUrl } from "@/lib/asset-token";

/** Look rendering + fal polling can exceed the default Vercel function timeout. */
export const maxDuration = 300;

function parseLookIndex(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && raw !== "" && Number.isInteger(Number(raw))) {
    return Number(raw);
  }
  return undefined;
}

function parseKind(raw: unknown): LookTryOnKind {
  return raw === "capsule" ? "capsule" : "look";
}

/** Return the latest saved full-look try-on for this report + look key, if any. */
export async function GET(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Try-on requires live mode" }, { status: 501 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId");
  if (!reportId || isDemoReportId(reportId)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }

  const lookIndex = parseLookIndex(searchParams.get("lookIndex"));
  const kind = parseKind(searchParams.get("kind"));
  const title = searchParams.get("title") ?? undefined;
  const lookKey = formatLookKey({ kind, lookIndex, title });

  const admin = createAdminSupabase();
  for (const ext of ["png", "jpg"] as const) {
    const path = tryonStoragePath(user.id, reportId, lookKey, ext);
    const { data: blob, error } = await admin.storage.from("assets").download(path);
    if (!error && blob) {
      const url = signedAssetProxyUrl(path);
      return NextResponse.json({ url, lookKey });
    }
  }

  const like = `%/tryon/look-${reportId}-${lookKey}.%`;
  const { data: row } = await admin
    .from("tryons")
    .select("image_path")
    .eq("user_id", user.id)
    .like("image_path", like)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (row?.image_path) {
    const url = signedAssetProxyUrl(row.image_path);
    return NextResponse.json({ url, lookKey });
  }

  return NextResponse.json({ url: null, lookKey });
}

/**
 * Full-look virtual try-on: render an entire outfit on the signed-in user's own
 * photo, preserving their identity via the image model (image-to-image). Uses
 * catalogue items from “Shop a look like this” when available.
 */
export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json(
      { error: "Try-on requires live mode" },
      { status: 501 },
    );
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
  const reportId: string | undefined = body?.reportId;
  const description: string | undefined = body?.description;
  const title: string = typeof body?.title === "string" ? body.title : "Look";
  const palette: string[] = Array.isArray(body?.palette)
    ? body.palette.filter((c: unknown): c is string => typeof c === "string")
    : [];
  const lookIndex = parseLookIndex(body?.lookIndex);
  const kind = parseKind(body?.kind);
  const isRegen = body?.regen === true;

  if (!reportId || isDemoReportId(reportId) || !description) {
    return NextResponse.json(
      { error: "Missing reportId or description" },
      { status: 400 },
    );
  }

  const lookKey = formatLookKey({ kind, lookIndex, title });

  // getReportById refreshes look_items via on-the-fly catalogue matching when
  // they are missing/stale and enriches each item with its product image URL —
  // so the try-on always sees the freshest "Shop a look like this" picks.
  const report = await getReportById(reportId);
  const profile = report?.profile as StyleProfile | undefined;
  if (!report || !profile) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Charge credits (try-on or re-render). Verify the balance up front so we
  // never run an expensive render the user can't pay for.
  const cost = isRegen ? CREDIT_COSTS.regen : CREDIT_COSTS.tryon;
  const reason = isRegen ? "regen" : "tryon";
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(createAdminSupabase(), user.id);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: "Not enough credits for this render.",
          code: "insufficient_credits",
          balance,
          needed: cost,
        },
        { status: 402 },
      );
    }
  }

  const lookItems = report.lookItems as
    | Record<number, ShoppingItem[]>
    | undefined;
  const catalogItems = resolveLookCatalogItems(lookItems, lookIndex);
  const catalogContext = catalogPromptFromItems(catalogItems);
  const catalogImageUrls = catalogImageUrlsFromItems(catalogItems);

  if (kind === "look" && !catalogItems.length) {
    // No catalogue picks → the model can only follow the look description, which
    // reproduces the report's original look. Usually means catalogue matching
    // returned nothing (empty/unseeded catalogue, gender filter, or migration
    // 0005 not applied). Surfaced here to aid debugging.
    console.warn(
      `[tryon] no catalogue items for report ${reportId} lookIndex ${lookIndex} — ` +
        `try-on will fall back to the look description. Verify catalogue seed + match_products RPC.`,
    );
  }

  const admin = createAdminSupabase();

  const photo = await getFullLengthPhotoUrl(admin, user.id);
  if (!photo.ok) {
    return NextResponse.json(
      { error: photo.error, code: photo.code },
      { status: 422 },
    );
  }

  const result = await generateLookImage({
    profile,
    look: { title, description, palette, catalogContext, catalogImageUrls },
    // Identity reference ONLY — the user's own photo, never the report's
    // generated look image (which would copy the original outfit).
    referenceImageUrl: photo.signedUrl,
  });
  if (!result) {
    return NextResponse.json(
      {
        error: "Try-on failed",
        code: "body_pose_failed" as const,
      },
      { status: 502 },
    );
  }

  const ext = result.mediaType.includes("jpeg") ? "jpg" : "png";
  const path = tryonStoragePath(user.id, reportId, lookKey, ext);
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, result.bytes, { contentType: result.mediaType, upsert: true });
  if (upErr) {
    return NextResponse.json(
      { error: "Could not store result" },
      { status: 500 },
    );
  }

  await admin.from("tryons").insert({
    user_id: user.id,
    image_path: path,
    status: "ready",
  });

  // Charge after the render succeeds so failed renders are never billed.
  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason,
        refId: reportId,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits for this render.",
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

  const url = signedAssetProxyUrl(path);

  return NextResponse.json({ url, lookKey, balance }, { status: 201 });
}
