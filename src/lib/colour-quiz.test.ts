import assert from "node:assert/strict";
import test from "node:test";
import { quizToResult, type QuizAnswers } from "./colour-quiz";

const base: QuizAnswers = {
  undertone: "cool",
  hair: "black",
  eye: "brown",
  sun: "deep",
  contrast: "low",
  clarity: "unsure",
};

test("cool + deep colouring + low feature-contrast → Deep Winter (inclusivity fix)", () => {
  // Dark hair + dark eyes + deep skin genuinely read as low feature-contrast.
  // Before the fix this misrouted to cool-summer; a cool deep-skinned person is
  // a Deep Winter, not a muted Summer.
  const r = quizToResult(base);
  assert.equal(r.subseason, "deep-winter");
  assert.equal(r.season, "winter");
});

test("warm + deep colouring → Deep Autumn", () => {
  const r = quizToResult({ ...base, undertone: "warm" });
  assert.equal(r.subseason, "deep-autumn");
  assert.equal(r.season, "autumn");
});

test("neutral + deep colouring stays deep (warm-leaning) not muted", () => {
  const r = quizToResult({ ...base, undertone: "neutral" });
  // neutral + tans deeply → warm-leaning → deep-autumn
  assert.equal(r.subseason, "deep-autumn");
});

test("the deep override is narrow — mid brown hair does NOT force deep", () => {
  // Plain "brown" hair (not black/dark-brown) must not trigger the deep path,
  // so a genuinely medium person is still routed by contrast.
  const r = quizToResult({
    undertone: "warm",
    hair: "brown",
    eye: "green",
    sun: "gradual",
    contrast: "low",
    clarity: "unsure",
  });
  assert.notEqual(r.subseason, "deep-autumn");
  assert.notEqual(r.subseason, "deep-winter");
});

test("light colouring still routes light", () => {
  const r = quizToResult({
    undertone: "cool",
    hair: "light-blonde",
    eye: "blue",
    sun: "burn",
    contrast: "low",
    clarity: "unsure",
  });
  assert.equal(r.subseason, "light-summer");
});

test("muted + cool + high-contrast → Summer, not Winter (clarity flip)", () => {
  // High value-contrast (dark hair, fair skin) would route to Winter on contrast
  // alone; a MUTED chroma signal now corrects it to a Summer — matching the
  // photo path's refineSeasonForClarity. This is the parity fix.
  const r = quizToResult({
    undertone: "cool",
    hair: "dark-brown",
    eye: "blue",
    sun: "burn",
    contrast: "high",
    clarity: "muted",
  });
  assert.equal(r.season, "summer");
  assert.equal(r.subseason, "soft-summer");
});

test("clear + cool + high-contrast stays Winter (no flip)", () => {
  const r = quizToResult({
    undertone: "cool",
    hair: "dark-brown",
    eye: "blue",
    sun: "burn",
    contrast: "high",
    clarity: "clear",
  });
  assert.equal(r.season, "winter");
});

test("result always carries a palette and a Carlo note", () => {
  const r = quizToResult(base);
  assert.ok(Array.isArray(r.palette) && r.palette.length > 0);
  assert.ok(typeof r.carloNote === "string" && r.carloNote.length > 0);
});
