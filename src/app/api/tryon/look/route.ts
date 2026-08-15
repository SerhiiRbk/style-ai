import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  generateLookImage,
  generateReportTryOnImage,
} from "@/lib/ai/pipeline";
import { getReportById } from "@/lib/data/reports";
import { lookItemsNeedRefresh, SHORT_SLEEVE_KNIT_RE, TURTLENECK_KNIT_RE } from "@/lib/data/catalog";
import { ensureSetLookItems } from "@/lib/data/look-sets";
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
  paletteFromCapsulePieces,
  resolveCapsuleCatalogItems,
  resolveLookCatalogItems,
  tryonStoragePath,
  isTieTitle,
  type LookTryOnKind,
} from "@/lib/look-tryon";
import type { StyleProfile } from "@/lib/style-profile";
import type { ShoppingItem } from "@/lib/report";
import {
  getReportReferencePhotos,
  resolveLookSetReferencePhotos,
} from "@/lib/photo-tryon";
import { signedAssetProxyUrl } from "@/lib/asset-token";

/** Look rendering + fal polling can exceed the default Vercel function timeout. */
export const maxDuration = 300;
export const runtime = "nodejs";

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

/**
 * Append a cache-busting version so a re-render (which overwrites the SAME
 * storage path) is not masked by the immutable CDN/browser cache on the
 * day-stable signed URL. The version is the render's timestamp; extra params
 * don't affect the signature (path + expiry only), so this is safe.
 */
function withVersion(url: string, version: number | string): string {
  const v =
    typeof version === "string" ? Date.parse(version) || Date.now() : version;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${v}`;
}

/**
 * Apply the user's Shop-the-look selection. After a catalogue rematch, stored
 * productIds can point at replaced items (e.g. olive trousers swapped for teal);
 * keep the hits that still exist and fill any category whose previous product
 * disappeared, so the try-on doesn't drop trousers entirely.
 */
function selectLookCatalogItems(
  all: ShoppingItem[],
  productIds: string[] | null,
): ShoppingItem[] {
  if (!productIds?.length) return all;
  const idSet = new Set(productIds);
  const selected = all.filter((i) => idSet.has(i.productId ?? i.title));
  if (!selected.length) return all;
  const stale = productIds.some(
    (id) => !all.some((i) => (i.productId ?? i.title) === id),
  );
  if (!stale) return selected;
  const cats = new Set(selected.map((i) => i.category));
  const filled = [...selected];
  for (const item of all) {
    if (cats.has(item.category)) continue;
    filled.push(item);
    cats.add(item.category);
  }
  return filled;
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
  const setId = searchParams.get("setId");
  // A try-on belongs to either a Style Report or a Create-a-Look set; `id`
  // namespaces its storage path either way.
  const id = setId ?? reportId;
  if (!id || (reportId != null && isDemoReportId(reportId))) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const lookIndex = parseLookIndex(searchParams.get("lookIndex"));
  const kind = parseKind(searchParams.get("kind"));
  const title = searchParams.get("title") ?? undefined;
  const lookKey = formatLookKey({ kind, lookIndex, title });

  const admin = createAdminSupabase();

  // Prefer the latest DB row — its created_at is the cache-busting version, so
  // a page reload shows the most recent render rather than a stale immutable
  // copy of the (fixed, overwritten) storage path.
  const like = `%/tryon/look-${id}-${lookKey}.%`;
  const { data: row } = await admin
    .from("tryons")
    .select("image_path, created_at")
    .eq("user_id", user.id)
    .like("image_path", like)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (row?.image_path) {
    const url = withVersion(
      signedAssetProxyUrl(row.image_path as string),
      (row.created_at as string) ?? Date.now(),
    );
    return NextResponse.json({ url, lookKey });
  }

  // Legacy fallback: a stored file exists without a matching tryons row.
  for (const ext of ["png", "jpg"] as const) {
    const path = tryonStoragePath(user.id, id, lookKey, ext);
    const { data: blob, error } = await admin.storage.from("assets").download(path);
    if (!error && blob) {
      return NextResponse.json({ url: signedAssetProxyUrl(path), lookKey });
    }
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
  const pieces: string[] = Array.isArray(body?.pieces)
    ? body.pieces.filter((p: unknown): p is string => typeof p === "string")
    : [];
  const outfitReferenceUrl =
    typeof body?.outfitReferenceUrl === "string"
      ? body.outfitReferenceUrl
      : undefined;
  const lookIndex = parseLookIndex(body?.lookIndex);
  const kind = parseKind(body?.kind);
  const isRegen = body?.regen === true;
  // "editorial" (default) = render a fresh styled scene; "studio" = edit the
  // user's own photo in place (studio backdrop, face/pose preserved).
  const tryOnStyle: "editorial" | "studio" =
    body?.style === "studio" ? "studio" : "editorial";
  // Looks only: user-selected "Shop a look" item keys (productId ?? title).
  // Absent/empty = try on ALL of the look's items (default).
  const productIds: string[] | null = Array.isArray(body?.productIds)
    ? body.productIds.filter((p: unknown): p is string => typeof p === "string")
    : null;

  const setId: string | undefined =
    typeof body?.setId === "string" && body.setId ? body.setId : undefined;

  if (!description) {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }
  if (!setId && (!reportId || isDemoReportId(reportId))) {
    return NextResponse.json(
      { error: "Missing reportId or setId" },
      { status: 400 },
    );
  }

  const lookKey = formatLookKey({ kind, lookIndex, title });
  const admin = createAdminSupabase();

  // Resolve the try-on context from EITHER a Style Report or a Create-a-Look
  // set. `storageId` namespaces the render's storage path + credit refId (both
  // report id and set id are UUIDs); `reportIdForRow` is null for sets — their
  // try-ons aren't report-scoped and surface as standalone in the gallery.
  let profile: StyleProfile;
  let shopping: ShoppingItem[] = [];
  let lookItems: Record<number, ShoppingItem[]> | undefined;
  let refCreatedAt: string;
  let storageId: string;
  let reportIdForRow: string | null;
  // For sets: the reference photo the set was rendered on (persisted on newer
  // sets). Report-mirrored sets fall back to that report's photos; standalone
  // sets fall back to the catalog default — never a later report's photo.
  let setFacePath: string | null = null;
  let setFullPath: string | null = null;
  let setReportId: string | null = null;

  if (setId) {
    const { data: setRow } = await admin
      .from("look_sets")
      .select("id, created_at, look_items, report_id")
      .eq("id", setId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: profRow } = await admin
      .from("look_set_profiles")
      .select("profile")
      .eq("set_id", setId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!setRow || !profRow?.profile) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 });
    }
    profile = profRow.profile as StyleProfile;
    lookItems =
      (setRow.look_items as Record<number, ShoppingItem[]> | null) ?? undefined;
    if (lookItemsNeedRefresh(lookItems)) {
      lookItems =
        (await ensureSetLookItems(admin, user.id, setId, lookItems)) ??
        undefined;
    }
    refCreatedAt = setRow.created_at as string;
    storageId = setId;
    reportIdForRow = null;
    setReportId = (setRow.report_id as string | null) ?? null;
    // Best-effort (pre-0041-safe): the exact reference photo paths stored on the
    // set at generation, if the columns exist.
    const { data: rp, error: rpErr } = await admin
      .from("look_set_profiles")
      .select("face_ref_path, full_ref_path")
      .eq("set_id", setId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!rpErr) {
      setFacePath = (rp?.face_ref_path as string | null) ?? null;
      setFullPath = (rp?.full_ref_path as string | null) ?? null;
    }
  } else {
    // getReportById refreshes look_items via on-the-fly catalogue matching when
    // they are missing/stale and enriches each item with its product image URL —
    // so the try-on always sees the freshest "Shop a look like this" picks.
    const report = await getReportById(reportId!);
    const p = report?.profile as StyleProfile | undefined;
    if (!report || !p) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    profile = p;
    shopping = report.shopping as ShoppingItem[];
    lookItems = report.lookItems as
      | Record<number, ShoppingItem[]>
      | undefined;
    refCreatedAt = report.createdAt;
    storageId = reportId!;
    reportIdForRow = reportId!;
  }

  // Charge credits (try-on or re-render). Verify the balance up front so we
  // never run an expensive render the user can't pay for.
  const cost = isRegen ? CREDIT_COSTS.regen : CREDIT_COSTS.tryon;
  const reason = isRegen ? "regen" : "tryon";
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(admin, user.id);
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

  const capsulePieces =
    pieces.length > 0
      ? pieces
      : kind === "capsule"
        ? description.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

  const allResolvedItems =
    kind === "capsule"
      ? resolveCapsuleCatalogItems(capsulePieces, shopping)
      : resolveLookCatalogItems(lookItems, lookIndex);

  // Item selection (looks only): keep only the "Shop a look" items the user left
  // enabled. Empty/absent selection falls back to ALL items (current default).
  const selectedItems =
    kind === "look"
      ? selectLookCatalogItems(allResolvedItems, productIds)
      : allResolvedItems;

  // A tie can't be worn without a shirt. If the user deselected the shirt but
  // kept a tie, the image model has to fabricate a base layer — and defaults to
  // a low-contrast white shirt under the (often light) tie. Re-add the look's
  // own shirt so the outfit stays coherent and contrast-correct. Only fires when
  // the look actually offers a shirt; otherwise the prompt-side contrast rule
  // (catalogPromptFromItems) guides the fabricated shirt instead.
  const resolvedItems = ((): ShoppingItem[] => {
    const hasTie = selectedItems.some(
      (i) => i.category === "Accessories" && isTieTitle(i.title),
    );
    if (!hasTie) return selectedItems;
    if (selectedItems.some((i) => i.category === "Shirts")) return selectedItems;
    const shirt = allResolvedItems.find((i) => i.category === "Shirts");
    return shirt ? [...selectedItems, shirt] : selectedItems;
  })();

  // Never layer a short-sleeve knit over a long-sleeve shirt in try-on: if the
  // picks include BOTH a shirt and a short-sleeve knit, drop the short-sleeve
  // knit (stale look_items from before the knit filter can still carry one). A
  // short-sleeve knit worn on its own (no shirt in the set) is left untouched.
  const hasShirt = resolvedItems.some((i) => i.category === "Shirts");
  let catalogItems = hasShirt
    ? resolvedItems.filter(
        (i) =>
          !(i.category === "Knitwear" && SHORT_SLEEVE_KNIT_RE.test(i.title)),
      )
    : resolvedItems;
  // A roll-neck / turtleneck replaces the shirt. Keeping both makes the model
  // paint a collar ON TOP of the roll-neck and the jumper body over the shirt.
  const hasTurtleneck = catalogItems.some(
    (i) => i.category === "Knitwear" && TURTLENECK_KNIT_RE.test(i.title),
  );
  if (hasTurtleneck) {
    catalogItems = catalogItems.filter((i) => i.category !== "Shirts");
  }

  const effectivePalette =
    palette.length > 0
      ? palette
      : kind === "capsule"
        ? paletteFromCapsulePieces(capsulePieces, shopping)
        : [];

  const catalogContext = catalogPromptFromItems(catalogItems);
  const catalogImageUrls = catalogImageUrlsFromItems(catalogItems);

  if (kind === "look" && !catalogItems.length) {
    // No catalogue picks → the model can only follow the look description, which
    // reproduces the report's original look. Usually means catalogue matching
    // returned nothing (empty/unseeded catalogue, gender filter, or migration
    // 0005 not applied). Surfaced here to aid debugging.
    console.warn(
      `[tryon] no catalogue items for ${storageId} lookIndex ${lookIndex} — ` +
        `try-on will fall back to the look description. Verify catalogue seed + match_products RPC.`,
    );
  }

  // Reference photos. Report page: that report's stored photos. Set: stored
  // ref paths, else the parent report's photos when mirrored, else catalog
  // default for standalone Create-a-Look sets.
  let fullUrl: string | undefined;
  let faceUrl: string | undefined;
  let profileUrl: string | undefined;
  if (setId) {
    const refs = await resolveLookSetReferencePhotos(admin, {
      userId: user.id,
      setId,
      facePath: setFacePath,
      fullPath: setFullPath,
      reportId: setReportId,
      reportCreatedAt: refCreatedAt,
    });
    faceUrl = refs.faceUrl ?? undefined;
    fullUrl = refs.fullUrl ?? undefined;
    profileUrl = refs.profileUrl ?? undefined;
  } else {
    const photo = await getReportReferencePhotos(
      admin,
      user.id,
      refCreatedAt,
      reportIdForRow ?? undefined,
    );
    if (!photo.ok) {
      return NextResponse.json(
        { error: photo.error, code: photo.code },
        { status: 422 },
      );
    }
    fullUrl = photo.fullUrl;
    faceUrl = photo.faceUrl;
    profileUrl = photo.profileUrl;
  }
  if (!fullUrl) {
    return NextResponse.json(
      {
        error: "Upload a full-length photo (head to toe) to try looks on you.",
        code: "needs_full_photo",
      },
      { status: 422 },
    );
  }

  const result =
    tryOnStyle === "studio"
      ? // Conservative: edit the user's OWN photo in place — swap only the
        // clothing and background (neutral studio), copying the face/hair/pose
        // verbatim so identity holds (no editorial re-synthesis of the face).
        await generateReportTryOnImage({
          personImageUrl: fullUrl,
          garmentsText:
            catalogContext ?? `Dress the person in this outfit: ${description}. `,
          garmentImageUrls: catalogImageUrls,
        })
      : await generateLookImage({
          profile,
          look: {
            title,
            description,
            palette: effectivePalette,
            catalogContext,
            catalogImageUrls,
          },
          // Identity reference ONLY — the user's own photo, never the report's
          // generated look image (which would copy the original outfit).
          referenceImageUrl: fullUrl,
          faceReferenceImageUrl: faceUrl,
          profileReferenceImageUrl: profileUrl,
          // Capsule combo photo defines the exact outfit to replicate on the user.
          outfitReferenceImageUrl:
            kind === "capsule" ? outfitReferenceUrl : undefined,
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
  const path = tryonStoragePath(user.id, storageId, lookKey, ext);
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, result.bytes, {
      contentType: result.mediaType,
      upsert: true,
    });
  if (upErr) {
    return NextResponse.json(
      { error: "Could not store result" },
      { status: 500 },
    );
  }

  // Persist the row tied to its report (and with garment metadata) so it shows
  // up in the user's gallery grouped under this report. Look/capsule try-ons are
  // excluded from the report's "saved outfit try-ons" list by their storage path
  // (they already render inline under each look), so this won't duplicate them.
  const garmentsMeta = catalogItems.map((it) => ({
    productId: it.productId ?? null,
    title: it.title,
    category: it.category,
    imageUrl: it.image ?? null,
  }));

  const tryonRow = {
    user_id: user.id,
    report_id: reportIdForRow,
    image_path: path,
    status: "ready",
    kind,
    garments: garmentsMeta,
  };
  // Audit trail: record exactly what the user submitted to try on (looks only —
  // the "Shop a look" selection). This is deliberately distinct from `garments`
  // above, which is the outfit that actually went into the render AFTER the
  // slot-dependency fix-ups (e.g. a tie silently re-adds its shirt). Keeping the
  // raw request makes any future item-vs-render mismatch diagnosable: you can
  // see what the user picked vs what got rendered. Best-effort: tolerate DBs
  // where migration 0042 (tryons.selected_product_ids) hasn't run yet by
  // retrying the insert without the column.
  const selectedProductIds = kind === "look" ? productIds : null;
  let inserted = await admin
    .from("tryons")
    .insert({ ...tryonRow, selected_product_ids: selectedProductIds })
    .select("created_at")
    .single();
  if (inserted.error && /selected_product_ids/.test(inserted.error.message)) {
    inserted = await admin
      .from("tryons")
      .insert(tryonRow)
      .select("created_at")
      .single();
  }
  const insertedTryon = inserted.data;
  const version = insertedTryon?.created_at
    ? Date.parse(insertedTryon.created_at as string) || Date.now()
    : Date.now();

  // Charge after the render succeeds so failed renders are never billed.
  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason,
        refId: storageId,
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

  const url = withVersion(signedAssetProxyUrl(path), version);

  return NextResponse.json({ url, lookKey, balance }, { status: 201 });
}
