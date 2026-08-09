import assert from "node:assert/strict";
import test from "node:test";
import {
  SUBSEASON_PALETTES,
  bestColorsForSubseason,
  avoidColorsForSubseason,
  reportPalette,
} from "./colour-palette";
import { Subseason, type SubseasonId } from "./style-profile";

const ALL_SUBSEASONS = Subseason.options as SubseasonId[];
const HEX = /^#[0-9a-fA-F]{6}$/;

test("reportPalette is deterministic — same input yields identical output", () => {
  for (const subseason of ALL_SUBSEASONS) {
    const a = reportPalette({ subseason, undertone: "cool", contrast: "medium" });
    const b = reportPalette({ subseason, undertone: "cool", contrast: "medium" });
    assert.deepEqual(a, b, `palette drifted for ${subseason}`);
  }
});

test("best colours mirror the curated subseason palette (hex + name)", () => {
  for (const subseason of ALL_SUBSEASONS) {
    const best = bestColorsForSubseason(subseason, {
      undertone: "cool",
      contrast: "medium",
    });
    const curated = SUBSEASON_PALETTES[subseason];
    assert.equal(best.length, curated.length);
    best.forEach((c, i) => {
      assert.equal(c.hex, curated[i]!.hex);
      assert.equal(c.name, curated[i]!.name);
      assert.match(c.hex, HEX);
      assert.ok(c.why.length > 0, `empty why for ${subseason} / ${c.name}`);
    });
  }
});

test("avoid colours exist, are valid, and carry a rationale", () => {
  for (const subseason of ALL_SUBSEASONS) {
    const avoid = avoidColorsForSubseason(subseason);
    assert.ok(avoid.length >= 3, `too few avoid colours for ${subseason}`);
    for (const c of avoid) {
      assert.match(c.hex, HEX);
      assert.ok(c.name.length > 0);
      assert.ok(c.why.length > 0);
    }
  }
});

test("undertone changes the rationale copy but not the hexes", () => {
  const cool = bestColorsForSubseason("cool-summer", {
    undertone: "cool",
    contrast: "medium",
  });
  const warm = bestColorsForSubseason("cool-summer", {
    undertone: "warm",
    contrast: "medium",
  });
  assert.deepEqual(
    cool.map((c) => c.hex),
    warm.map((c) => c.hex),
  );
  assert.notEqual(cool[0]!.why, warm[0]!.why);
});
