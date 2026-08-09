import assert from "node:assert/strict";
import test from "node:test";
import {
  purposeToFlagKey,
  userMessageForReject,
  type PhotoGatePurpose,
} from "./photo-gate-types";

test("purpose maps to flag keys", () => {
  assert.equal(purposeToFlagKey("shop_a_look"), "shopALook");
  assert.equal(purposeToFlagKey("report_face"), "reportPhotos");
  assert.equal(purposeToFlagKey("report_full"), "reportPhotos");
  assert.equal(purposeToFlagKey("report_profile"), "reportPhotos");
  assert.equal(purposeToFlagKey("tryon_full"), "tryon");
});

test("reject messages are purpose-specific", () => {
  assert.match(
    userMessageForReject("shop_a_look"),
    /outfit|flat-lay|hanger|mannequin/i,
  );
  assert.match(userMessageForReject("report_face"), /face/i);
  assert.match(userMessageForReject("report_profile"), /side-profile/i);
  assert.match(userMessageForReject("report_full"), /full-length|head-to-toe/i);
  assert.match(userMessageForReject("tryon_full"), /full-length|head-to-toe/i);
});

test("every purpose has non-empty copy", () => {
  const purposes: PhotoGatePurpose[] = [
    "shop_a_look",
    "report_face",
    "report_full",
    "report_profile",
    "tryon_full",
  ];
  for (const p of purposes) {
    assert.ok(userMessageForReject(p).length > 10, `copy missing for ${p}`);
  }
});
