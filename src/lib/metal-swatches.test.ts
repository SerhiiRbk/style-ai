import assert from "node:assert/strict";
import test from "node:test";
import {
  METAL_SWATCH_SRC,
  metalAvoidSwatchSrc,
  metalSwatchSrc,
} from "./metal-swatches";

test("every metalsFor recommend name has an SVG swatch", () => {
  const names = [
    "Silver",
    "Brushed steel",
    "White gold / platinum",
    "Yellow gold",
    "Brass / bronze",
    "Cognac leather",
    "Soft gold",
    "Steel",
    "Two-tone",
  ];
  for (const name of names) {
    const src = metalSwatchSrc(name);
    assert.ok(src, `missing swatch for ${name}`);
    assert.match(src!, /^\/images\/metals\/valetti-.+\.svg$/);
  }
  assert.equal(Object.keys(METAL_SWATCH_SRC).length, names.length);
});

test("avoid icons follow undertone via recommend names", () => {
  assert.match(
    metalAvoidSwatchSrc(["Silver", "Brushed steel", "White gold / platinum"]) ??
      "",
    /avoid-bright-yellow-gold-v2/,
  );
  assert.match(
    metalAvoidSwatchSrc([
      "Yellow gold",
      "Brass / bronze",
      "Cognac leather",
    ]) ?? "",
    /avoid-cool-chrome-v2/,
  );
  assert.equal(
    metalAvoidSwatchSrc(["Soft gold", "Steel", "Two-tone"]),
    undefined,
  );
});
