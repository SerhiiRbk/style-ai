import { NextResponse } from "next/server";
import { assertPhotoUsable } from "@/lib/ai/photo-gate";
import { logEvent } from "@/lib/events";
import type { PhotoGatePurpose } from "@/lib/photo-gate-types";

export const runtime = "nodejs";
export const maxDuration = 30;

const PURPOSES = new Set<PhotoGatePurpose>([
  "shop_a_look",
  "report_face",
  "report_full",
  "report_profile",
  "tryon_full",
]);

/** ~6 MB of base64 ≈ 4.5 MB image — client downscales well below this. */
const MAX_DATA_URL_CHARS = 6_000_000;

/**
 * Pre-flight photo gate for client upload flows (report wizard, catalog
 * try-on). Shop a Look gates in-process on its own route. Rejects fail closed
 * (422); flag-off / no-AI / provider errors fail open (200) — and every
 * fail-open emits `photo_gate_failopen` so a dead gate is visible (plan §8).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const image = typeof body?.image === "string" ? body.image : "";
  const purpose = body?.purpose as PhotoGatePurpose;
  const anonId =
    typeof body?.anonId === "string" && body.anonId
      ? body.anonId.slice(0, 64)
      : null;

  if (!image.startsWith("data:") || !PURPOSES.has(purpose)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (image.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const result = await assertPhotoUsable({ imageDataUrl: image, purpose });

  if ("skipped" in result) {
    // flag_off is expected and quiet; provider_error / no_ai mean the gate did
    // not actually run — surface it so a silently-dead gate is measurable.
    if (result.reason !== "flag_off") {
      await logEvent({
        name: "photo_gate_failopen",
        anonId,
        props: { purpose, reason: result.reason },
      });
    }
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!result.ok) {
    await logEvent({
      name: "photo_gate_reject",
      anonId,
      props: { purpose },
    });
    return NextResponse.json(
      { ok: false, code: "rejected", error: result.rejectReason },
      { status: 422 },
    );
  }

  await logEvent({
    name: "photo_gate_pass",
    anonId,
    props: { purpose, ...(result.kind ? { kind: result.kind } : {}) },
  });
  return NextResponse.json({ ok: true });
}
