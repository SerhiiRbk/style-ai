import { NextResponse } from "next/server";
import { hasSupabase, hasVTON, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { runTryOn } from "@/lib/ai/tryon";
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
  if (!product?.image_url) {
    return NextResponse.json(
      { error: "Garment image unavailable for this product" },
      { status: 422 },
    );
  }

  // Most recent full-length (fallback: any) photo for the user.
  const { data: photo } = await admin
    .from("photos")
    .select("storage_path, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const chosen =
    photo?.find((p) => p.role === "full") ?? photo?.[0] ?? null;
  if (!chosen) {
    return NextResponse.json({ error: "No photo on file" }, { status: 422 });
  }

  const { data: signed } = await admin.storage
    .from("photos")
    .createSignedUrl(chosen.storage_path, 600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not read photo" }, { status: 500 });
  }

  const result = await runTryOn({
    personImageUrl: signed.signedUrl,
    garmentImageUrl: product.image_url,
  });
  if (!result) {
    return NextResponse.json({ error: "Try-on failed" }, { status: 502 });
  }

  const ext = result.mediaType.includes("jpeg") ? "jpg" : "png";
  const path = `${user.id}/tryon/${productId}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("assets")
    .upload(path, result.bytes, { contentType: result.mediaType, upsert: true });
  if (upErr) {
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

  const { data: out } = await admin.storage
    .from("assets")
    .createSignedUrl(path, 600);

  return NextResponse.json({ url: out?.signedUrl ?? null, balance }, { status: 201 });
}
