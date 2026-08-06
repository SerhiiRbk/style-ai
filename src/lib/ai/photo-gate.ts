import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import { isPhotoGateActive } from "@/lib/photo-gate-flags";
import {
  purposeToFlagKey,
  userMessageForReject,
  type PhotoGatePurpose,
} from "@/lib/photo-gate-types";
// NOTE: createAdminSupabase, if ever needed, lives in "@/lib/supabase/server"
// (there is no "@/lib/supabase/admin"). Not needed here — the gate holds no
// cache: Flash-Lite is too cheap to justify a third orphan-blob source (spec §3.2).

/** Whether the gate for this purpose is switched on (master + per-flag). */
export function purposeEnabled(purpose: PhotoGatePurpose): boolean {
  return isPhotoGateActive(env.photoGate, purposeToFlagKey(purpose));
}

const shopSchema = z.object({
  ok: z.boolean(),
  kind: z.enum(["on_body", "flat_lay", "hanger", "mannequin", "none"]),
  rejectReason: z.string().optional(),
});

const roleSchema = z.object({
  ok: z.boolean(),
  rejectReason: z.string().optional(),
});

const PROMPTS: Record<PhotoGatePurpose, string> = {
  shop_a_look:
    "Does this image show wearable clothing to shop (on a person, flat-lay, hanger, or mannequin)? A visible face is optional. Set kind=none and ok=false if there are no garments to match.",
  report_face:
    "Is there a clear, readable human face suitable for colour/style analysis (preferably front-facing, not heavily obscured or blurred)? Answer ok=false if no usable face.",
  report_full:
    "Is this a full-length (head-to-toe) photo of a single person, usable for reading fit and proportions? Answer ok=false if it is a face-only crop or the body is cut off.",
  report_profile:
    "Is this a side-profile photo of a person's head and shoulders? Answer ok=false if it is front-facing only or no head is visible.",
  tryon_full:
    "Is this a full-length (head-to-toe) photo of a single person, usable for a virtual clothing try-on? Answer ok=false if it is a face-only crop or the body is cut off.",
};

export type PhotoGateResult =
  | { ok: true; kind?: string }
  | { ok: true; skipped: true; reason: "flag_off" | "no_ai" | "provider_error" }
  | { ok: false; rejectReason: string; code: "rejected" };

/**
 * Cheap pre-flight check that a photo is usable for `purpose`, run *before* the
 * expensive Sonnet / try-on call. Uses `env.modelVisionGate` (Flash-Lite).
 *
 * Contract: explicit model rejects fail **closed** ({ ok:false }); provider /
 * timeout / parse errors and a missing key fail **open** ({ ok:true, skipped })
 * so gate flakiness never blocks a real user. Callers MUST emit
 * `photo_gate_failopen` on `skipped: true` with `reason` in ("provider_error",
 * "no_ai") so a silently-dead gate is visible (plan §8).
 */
export async function assertPhotoUsable(args: {
  imageDataUrl: string;
  purpose: PhotoGatePurpose;
}): Promise<PhotoGateResult> {
  if (!purposeEnabled(args.purpose)) {
    return { ok: true, skipped: true, reason: "flag_off" };
  }
  if (!hasAI) {
    return { ok: true, skipped: true, reason: "no_ai" };
  }

  const isShop = args.purpose === "shop_a_look";
  try {
    const { output } = await generateText({
      model: env.modelVisionGate,
      output: Output.object({ schema: isShop ? shopSchema : roleSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPTS[args.purpose] },
            { type: "image", image: args.imageDataUrl },
          ],
        },
      ],
    });

    if (output.ok) {
      return isShop
        ? { ok: true, kind: (output as z.infer<typeof shopSchema>).kind }
        : { ok: true };
    }
    return {
      ok: false,
      code: "rejected",
      rejectReason: userMessageForReject(args.purpose),
    };
  } catch (err) {
    // Fail OPEN — do not block the user on gate flakiness. The caller emits
    // photo_gate_failopen so this is never silent.
    console.error("[photo-gate] provider error", args.purpose, err);
    return { ok: true, skipped: true, reason: "provider_error" };
  }
}
