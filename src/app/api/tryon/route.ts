import { NextResponse } from "next/server";
import { hasSupabase, hasVTON, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { runTryOn } from "@/lib/ai/tryon";
import { getFullLengthPhotoUrl, tryOnErrorCode } from "@/lib/photo-tryon";

/** fal queue polling can exceed the default Vercel function timeout. */
export const maxDuration = 120;
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";

export async function POST(request: Request) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Try-on requires live mode" }, { status: 501 });
  }
  if (!hasVTON) {
    return NextResponse.json(
      { error: "Virtual try-on is not configured (set FAL_KEY)" },
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
  const productId: string | undefined = body?.productId;
  const fallbackImageUrl: string | undefined =
    typeof body?.imageUrl === "string" && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : undefined;
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }
  const reportId: string | undefined =
    typeof body?.reportId === "string" && body.reportId !== "demo"
      ? body.reportId
      : undefined;

  const admin = createAdminSupabase();

  // Verify credit balance before running the (paid) render.
  const cost = CREDIT_COSTS.tryon;
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(admin, user.id);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: "Not enough credits for this try-on.",
          code: "insufficient_credits",
          balance,
          needed: cost,
        },
        { status: 402 },
      );
    }
  }

  const { data: product } = await admin
    .from("products")
    .select("image_url")
    .eq("id", productId)
    .single();
  const garmentImageUrl = product?.image_url ?? fallbackImageUrl;
  if (!garmentImageUrl) {
    return NextResponse.json(
      { error: "Garment image unavailable for this product" },
      { status: 422 },
    );
  }

  const photo = await getFullLengthPhotoUrl(admin, user.id);
  if (!photo.ok) {
    return NextResponse.json(
      { error: photo.error, code: photo.code },
      { status: 422 },
    );
  }

  const result = await runTryOn({
    personImageUrl: photo.signedUrl,
    garmentImageUrl,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: tryOnErrorCode(result.error) },
      { status: 502 },
    );
  }

  const ext = result.mediaType.includes("jpeg") ? "jpg" : "png";
  const path = `${user.id}/tryon/${productId}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, result.bytes, { contentType: result.mediaType, upsert: true });
  if (upErr) {
    console.error("[tryon] storage upload failed", upErr);
    return NextResponse.json({ error: "Could not store result" }, { status: 500 });
  }

  await admin.from("tryons").insert({
    user_id: user.id,
    product_id: productId,
    image_path: path,
    status: "ready",
  });

  // Charge after success so failed renders are never billed.
  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "tryon",
        refId: reportId,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits for this try-on.",
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

  const { data: out, error: signErr } = await admin.storage
    .from("assets")
    .createSignedUrl(path, 600);
  if (signErr || !out?.signedUrl) {
    console.error("[tryon] signed URL failed", signErr);
    return NextResponse.json(
      { error: "Try-on saved but preview URL failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: out.signedUrl, balance }, { status: 201 });
}
