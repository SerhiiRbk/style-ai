import assert from "node:assert/strict";
import test from "node:test";
import {
  flagDefaultTrue,
  resolvePhotoGateFlags,
  isPhotoGateActive,
} from "./photo-gate-flags";

test("flagDefaultTrue is true when unset", () => {
  assert.equal(flagDefaultTrue(undefined), true);
  assert.equal(flagDefaultTrue(""), true);
});

test("flagDefaultTrue respects falsey tokens", () => {
  assert.equal(flagDefaultTrue("false"), false);
  assert.equal(flagDefaultTrue("0"), false);
  assert.equal(flagDefaultTrue("no"), false);
  assert.equal(flagDefaultTrue("FALSE"), false);
  assert.equal(flagDefaultTrue(" no "), false);
  assert.equal(flagDefaultTrue("true"), true);
  assert.equal(flagDefaultTrue("yes"), true);
});

test("master off disables every gate", () => {
  const f = resolvePhotoGateFlags({
    PHOTO_GATE_ENABLED: "false",
    PHOTO_GATE_SHOP_A_LOOK_ENABLED: "true",
    PHOTO_GATE_REPORT_PHOTOS_ENABLED: "true",
    PHOTO_GATE_TRYON_ENABLED: "true",
    NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED: "true",
  });
  assert.equal(isPhotoGateActive(f, "shopALook"), false);
  assert.equal(isPhotoGateActive(f, "reportPhotos"), false);
  assert.equal(isPhotoGateActive(f, "tryon"), false);
  assert.equal(isPhotoGateActive(f, "colours"), false);
});

test("per-flag off leaves others on", () => {
  const f = resolvePhotoGateFlags({
    PHOTO_GATE_SHOP_A_LOOK_ENABLED: "false",
  });
  assert.equal(isPhotoGateActive(f, "shopALook"), false);
  assert.equal(isPhotoGateActive(f, "reportPhotos"), true);
  assert.equal(isPhotoGateActive(f, "colours"), true);
  assert.equal(isPhotoGateActive(f, "tryon"), true);
});

test("all-unset defaults every gate on", () => {
  const f = resolvePhotoGateFlags({});
  assert.equal(f.master, true);
  assert.equal(isPhotoGateActive(f, "colours"), true);
  assert.equal(isPhotoGateActive(f, "shopALook"), true);
});

test("NEXT_PUBLIC master twin also disables when server var unset", () => {
  const f = resolvePhotoGateFlags({
    NEXT_PUBLIC_PHOTO_GATE_ENABLED: "false",
  });
  assert.equal(isPhotoGateActive(f, "colours"), false);
});
