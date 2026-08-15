import assert from "node:assert/strict";
import test from "node:test";
import {
  bundleFor, priceForBundle, isLoyalty, setName, buildLookIntake,
} from "./look-sets";
import { intakeSchema } from "@/lib/style-profile";

test("bundles are 3/6/9 only", () => {
  assert.deepEqual(bundleFor(3), { looks: 3, credits: 12 });
  assert.deepEqual(bundleFor(9), { looks: 9, credits: 22 });
  assert.equal(bundleFor(4), null);
});

test("loyalty is a flat −2 per bundle for ≥20 purchased", () => {
  assert.equal(priceForBundle(3, false), 12);
  assert.equal(priceForBundle(3, true), 10);
  assert.equal(priceForBundle(6, true), 16);
  assert.equal(priceForBundle(9, true), 20);
  assert.equal(priceForBundle(4, true), null);
});

test("loyalty threshold is purchased ≥20 credits", () => {
  assert.equal(isLoyalty(19), false);
  assert.equal(isLoyalty(20), true);
  assert.equal(isLoyalty(100), true);
});

test("set name = occasion · date; collision appends time not a counter", () => {
  assert.equal(setName("Wedding", "2026-08-12"), "Wedding · 12 Aug 2026");
  assert.equal(setName("Wedding", "2026-08-12", "14:30"), "Wedding · 12 Aug 2026 · 14:30");
});

test("mini-intake maps to a valid Intake with male + sensible defaults", () => {
  const intake = buildLookIntake({ age: 32, bodyType: "trapezoid" });
  assert.equal(intake.genderPresentation, "male");
  assert.equal(intake.age, 32);
  assert.equal(intake.bodyType, "trapezoid");
  assert.ok(intake.goals.length >= 1); // required by downstream; defaulted
  assert.ok(intake.occupation.length >= 1);
  assert.ok(intake.heightCm >= 120);
  assert.ok(
    intakeSchema.safeParse(intake).success,
    "buildLookIntake must produce a schema-valid Intake",
  );
});
