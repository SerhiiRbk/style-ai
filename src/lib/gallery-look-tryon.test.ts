import assert from "node:assert/strict";
import test from "node:test";
import { lookTryonLabel, parseLookTryonPath } from "./gallery-look-tryon";

const SET = "0acdbfc3-f284-4c9f-87d2-d6f594f189d4";

test("parseLookTryonPath reads set and report look try-ons", () => {
  const setLook = parseLookTryonPath(
    `06951a9c-849b-450a-b03b-c143809c5f05/tryon/look-${SET}-look-1.jpg`,
  );
  assert.deepEqual(setLook, { storageId: SET, lookKey: "look-1" });

  const capsule = parseLookTryonPath(
    `u/tryon/look-${SET}-capsule-0.png`,
  );
  assert.equal(capsule?.lookKey, "capsule-0");

  assert.equal(parseLookTryonPath("u/tryon/catalog-abc.jpg"), null);
  assert.equal(parseLookTryonPath("u/looksets/x/1.jpg"), null);
});

test("lookTryonLabel prefers the look title", () => {
  assert.equal(
    lookTryonLabel("look-1", [{ idx: 1, title: "Soft Plum Layers" }]),
    "Try-on · Soft Plum Layers",
  );
  assert.equal(lookTryonLabel("look-0"), "Try-on · look 1");
  assert.equal(lookTryonLabel("capsule-2"), "Try-on · capsule");
});
