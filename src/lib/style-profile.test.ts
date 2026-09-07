import assert from "node:assert/strict";
import test from "node:test";
import { classifySubseason, seasonForCorrectedUndertone, seasonFromColouring } from "./style-profile";

test("deep colouring is Deep Autumn even when the chroma reads muted", () => {
  // Report f4b8e202: near-black hair, brown eyes, light skin — the old rule
  // let a 'muted' clarity demote this to Soft Autumn's dusty mid-tones.
  assert.equal(
    classifySubseason({
      season: "autumn",
      undertone: "warm",
      contrast: "medium",
      clarity: "muted",
      hairColor: "dark brown",
      eyeColor: "brown",
    }),
    "deep-autumn",
  );
  assert.equal(
    classifySubseason({
      season: "autumn",
      undertone: "warm",
      contrast: "high",
      clarity: "muted",
      hairColor: "brown",
      eyeColor: "hazel",
    }),
    "deep-autumn",
  );
  // Genuinely soft colouring keeps Soft Autumn.
  assert.equal(
    classifySubseason({
      season: "autumn",
      undertone: "warm",
      contrast: "medium",
      clarity: "muted",
      hairColor: "dark blonde",
      eyeColor: "hazel",
    }),
    "soft-autumn",
  );
});

test("season family follows a corrected undertone by depth", () => {
  const deep = { contrast: "high" as const, hairColor: "dark brown", eyeColor: "brown" };
  const soft = { contrast: "medium" as const, hairColor: "dark blonde", eyeColor: "hazel" };
  assert.equal(seasonForCorrectedUndertone({ season: "autumn", undertone: "cool", ...deep }), "winter");
  assert.equal(seasonForCorrectedUndertone({ season: "autumn", undertone: "cool", ...soft }), "summer");
  assert.equal(seasonForCorrectedUndertone({ season: "winter", undertone: "warm", ...deep }), "autumn");
  assert.equal(seasonForCorrectedUndertone({ season: "summer", undertone: "warm", contrast: "low", hairColor: "light blonde", eyeColor: "blue" }), "spring");
  // Same temperature or a neutral read: unchanged.
  assert.equal(seasonForCorrectedUndertone({ season: "autumn", undertone: "warm", ...deep }), "autumn");
  assert.equal(seasonForCorrectedUndertone({ season: "autumn", undertone: "neutral", ...deep }), "autumn");
});

test("seasonFromColouring: temperature + depth alone decide the family", () => {
  // Warm, dark brown hair + brown eyes: Autumn whatever the model called it.
  assert.equal(seasonFromColouring({ undertone: "warm", contrast: "medium", hairColor: "dark brown", eyeColor: "brown" }), "autumn");
  assert.equal(seasonFromColouring({ undertone: "warm", contrast: "high", hairColor: "dark brown", eyeColor: "brown" }), "autumn");
  assert.equal(seasonFromColouring({ undertone: "warm", contrast: "low", hairColor: "light blonde", eyeColor: "blue" }), "spring");
  assert.equal(seasonFromColouring({ undertone: "cool", contrast: "high", hairColor: "black", eyeColor: "brown" }), "winter");
  assert.equal(seasonFromColouring({ undertone: "cool", contrast: "medium", hairColor: "dark blonde", eyeColor: "grey" }), "summer");
});
