import assert from "node:assert/strict";
import test from "node:test";
import {
  faceReattachRole,
  shouldReattachFacePortrait,
} from "./identity-refs";

test("reattach the face when anything follows the first portrait", () => {
  assert.equal(shouldReattachFacePortrait(true, 1), true);
  assert.equal(shouldReattachFacePortrait(true, 2), true);
  assert.equal(shouldReattachFacePortrait(true, 0), false);
  assert.equal(shouldReattachFacePortrait(false, 2), false);
});

test("reattach role names the same close-up, not a new person", () => {
  const role = faceReattachRole("FOURTH");
  assert.match(role, /FOURTH image is the SAME close-up front portrait again/);
  assert.match(role, /lock the face/);
});
