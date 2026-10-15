import assert from "node:assert/strict";
import test from "node:test";
import { bodyTypeLock, bodyTypeSubjectClause } from "./body-lock";

test("rectangle lock forbids an athletic V-taper", () => {
  const lock = bodyTypeLock("rectangle");
  assert.match(lock, /rectangle \(straight\)/);
  assert.match(lock, /shoulders and hips the same width/);
  assert.match(lock, /V-taper/);
  assert.match(lock, /full-length reference photo/);
  assert.match(lock, /never copy the model's physique/);
  const subject = bodyTypeSubjectClause("rectangle");
  assert.match(subject, /not an athletic V-taper/);
});

test("inverted-triangle lock keeps wider shoulders", () => {
  const lock = bodyTypeLock("inverted-triangle");
  assert.match(lock, /shoulders clearly wider than the hips/);
  assert.doesNotMatch(lock, /do not invent a V-taper/);
});

test("unknown body type still asks to keep the photo", () => {
  const lock = bodyTypeLock("average");
  assert.match(lock, /average build/);
  assert.match(lock, /full-length reference photo/);
});

test("lock names height and weight so the frame stays real", () => {
  const lock = bodyTypeLock("rectangle", { heightCm: 177, weightKg: 79 });
  assert.match(lock, /177cm and 79kg/);
  assert.match(lock, /not a gym-built/);
});
