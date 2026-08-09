/**
 * Pure gate types + copy helpers (plan 2026-08-05). **Not `server-only`** — the
 * browser client helper imports these, so keeping them here avoids pulling the
 * server gate (`ai/photo-gate.ts`) into the client bundle.
 */
import type { PhotoGateKey } from "@/lib/photo-gate-flags";

export type PhotoGatePurpose =
  | "shop_a_look"
  | "report_face"
  | "report_full"
  | "report_profile"
  | "tryon_full";

/** Which kill-switch governs a given purpose. */
export function purposeToFlagKey(purpose: PhotoGatePurpose): PhotoGateKey {
  switch (purpose) {
    case "shop_a_look":
      return "shopALook";
    case "tryon_full":
      return "tryon";
    default:
      return "reportPhotos";
  }
}

/** Purpose-specific, user-facing reject copy. */
export function userMessageForReject(purpose: PhotoGatePurpose): string {
  switch (purpose) {
    case "shop_a_look":
      return "We couldn't find clothing to match. Try a full-outfit photo, flat-lay, hanger, or mannequin shot.";
    case "report_face":
      return "We need a clear front-facing face photo for this slot.";
    case "report_profile":
      return "We need a side-profile photo for this slot.";
    case "report_full":
    case "tryon_full":
      return "We need a clear full-length (head-to-toe) photo for this slot.";
  }
}
