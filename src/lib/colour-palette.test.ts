import assert from "node:assert/strict";
import test from "node:test";
import {
  SUBSEASON_PALETTES,
  bestColorsForSubseason,
  avoidColorsForSubseason,
  reportPalette,
  buildPaletteFromColouring,
  refineSeasonFromSkinHex,
  parseSwatchHex,
  hexToHsl,
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
      undertone: "neutral",
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

test("neutral + medium with no extra signals keeps the curated hexes", () => {
  const best = bestColorsForSubseason("soft-summer", {
    undertone: "neutral",
    contrast: "medium",
  });
  const curated = SUBSEASON_PALETTES["soft-summer"];
  assert.deepEqual(
    best.map((c) => c.hex),
    curated.map((c) => c.hex),
  );
});

test("undertone, contrast and colouring shift hexes inside the same subseason", () => {
  const base = bestColorsForSubseason("soft-summer", {
    undertone: "neutral",
    contrast: "medium",
  });
  const coolHigh = bestColorsForSubseason("soft-summer", {
    undertone: "cool",
    contrast: "high",
    hairColor: "dark brown",
    eyeColor: "blue",
    skinTone: "cool fair",
  });
  const warmLow = bestColorsForSubseason("soft-summer", {
    undertone: "warm",
    contrast: "low",
    hairColor: "light blonde",
    eyeColor: "green",
    skinTone: "warm light",
  });
  assert.notDeepEqual(
    coolHigh.map((c) => c.hex),
    base.map((c) => c.hex),
    "cool/high/dark should not reuse the generic Soft Summer hexes",
  );
  assert.notDeepEqual(
    coolHigh.map((c) => c.hex),
    warmLow.map((c) => c.hex),
    "two Soft Summers with different colouring must not share hexes",
  );
  assert.deepEqual(
    coolHigh.map((c) => c.name),
    base.map((c) => c.name),
    "names stay on the subseason so copy and recipes still match",
  );
  assert.notEqual(base[0]!.why, coolHigh[0]!.why);
});

function hueFamily(h: number, s: number, l = 0.5): string {
  if (s < 0.14 || l >= 0.88) return "neutral";
  if (h >= 185 && h < 262) return "blue";
  if (h >= 148 && h < 185) return "teal";
  if (h >= 70 && h < 148) return "green";
  if (h >= 46 && h < 70) return "olive";
  if (h >= 32 && h < 46) return "gold";
  if (h >= 12 && h < 32) return "orange";
  if (h < 12 || h >= 345) return "red";
  if (h >= 300 && h < 345) return "rose";
  if (h >= 262 && h < 300) return "purple";
  return "other";
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const HOSTILE_FACES = [
  {
    name: "brown-eyes-warm",
    undertone: "warm" as const,
    contrast: "medium" as const,
    skinHex: "#C4A07A",
    hairHex: "#1A1410",
    eyeHex: "#5A3A22",
  },
  {
    name: "green-eyes-fair",
    undertone: "cool" as const,
    contrast: "high" as const,
    skinHex: "#E8C8BE",
    hairHex: "#3A2A22",
    eyeHex: "#3F6B4A",
  },
  {
    name: "blue-eyes-fair",
    undertone: "cool" as const,
    contrast: "medium" as const,
    skinHex: "#F0D4CC",
    hairHex: "#6B5344",
    eyeHex: "#4A6E9A",
  },
  {
    name: "olive-skin-hazel",
    undertone: "neutral" as const,
    contrast: "low" as const,
    skinHex: "#C48A3A",
    hairHex: "#4A3020",
    eyeHex: "#6B6B47",
  },
];

test("named swatches keep their hue family across hostile faces", () => {
  for (const subseason of ALL_SUBSEASONS) {
    const curated = SUBSEASON_PALETTES[subseason];
    for (const face of HOSTILE_FACES) {
      const palette = buildPaletteFromColouring(curated, subseason, face);
      curated.forEach((sw, i) => {
        const from = hexToHsl(sw.hex);
        const to = hexToHsl(palette[i]!.hex);
        const src = hueFamily(from.h, from.s, from.l);
        const dst = hueFamily(to.h, to.s, to.l);
        const adjacent: Record<string, string[]> = {
          gold: ["orange", "olive"],
          orange: ["gold", "red"],
          olive: ["gold", "green"],
          green: ["olive", "teal"],
          teal: ["green", "blue"],
          blue: ["teal", "purple"],
          purple: ["blue", "rose"],
          rose: ["purple", "red"],
          red: ["rose", "orange"],
        };
        const ok =
          src === "neutral" ||
          dst === "neutral" ||
          dst === src ||
          (adjacent[src]?.includes(dst) && hueDist(from.h, to.h) <= 30);
        assert.ok(
          ok,
          `${subseason} ${sw.name} ${face.name}: ${src} → ${dst} (${sw.hex} → ${palette[i]!.hex})`,
        );
      });
    }
  }
});

test("dusty blue stays blue when eyes are brown", () => {
  const curated = SUBSEASON_PALETTES["cool-summer"];
  const palette = buildPaletteFromColouring(curated, "cool-summer", {
    undertone: "cool",
    contrast: "high",
    skinHex: "#E8C8BE",
    hairHex: "#2A2018",
    eyeHex: "#5A3A22",
  });
  const dusty = palette.find((s) => s.name === "Dusty blue");
  assert.ok(dusty, "missing Dusty blue");
  const { h } = hexToHsl(dusty!.hex);
  assert.ok(
    h >= 185 && h <= 250,
    `Dusty blue drifted to green/olive: ${dusty!.hex} hue ${h.toFixed(0)}`,
  );
});

test("face hexes build different palettes inside the same subseason", () => {
  const curated = SUBSEASON_PALETTES["soft-summer"];
  const fairBlue = buildPaletteFromColouring(curated, "soft-summer", {
    undertone: "cool",
    contrast: "medium",
    skinHex: "#E8C8BE",
    hairHex: "#3A2A22",
    eyeHex: "#4A6E9A",
  });
  const oliveBrown = buildPaletteFromColouring(curated, "soft-summer", {
    undertone: "neutral",
    contrast: "medium",
    skinHex: "#C4A07A",
    hairHex: "#1A1410",
    eyeHex: "#5A3A22",
  });
  assert.notDeepEqual(
    fairBlue.map((s) => s.hex),
    oliveBrown.map((s) => s.hex),
  );
  assert.deepEqual(
    fairBlue.map((s) => s.name),
    curated.map((s) => s.name),
  );
  const again = buildPaletteFromColouring(curated, "soft-summer", {
    undertone: "cool",
    contrast: "medium",
    skinHex: "#E8C8BE",
    hairHex: "#3A2A22",
    eyeHex: "#4A6E9A",
  });
  assert.deepEqual(fairBlue, again);
});

test("greige stays a muted neutral, not sage, when skin is olive", () => {
  const curated = SUBSEASON_PALETTES["soft-summer"];
  const palette = buildPaletteFromColouring(curated, "soft-summer", {
    undertone: "neutral",
    contrast: "medium",
    skinHex: "#C48A3A",
    hairHex: "#4A3020",
    eyeHex: "#6B6B47",
  });
  const greige = palette.find((s) => s.name === "Greige");
  assert.ok(greige, "missing Greige");
  const { h, s } = hexToHsl(greige!.hex);
  assert.ok(
    s <= 0.16 || (h >= 25 && h <= 55),
    `Greige became green: ${greige!.hex} hue ${h.toFixed(0)} sat ${s.toFixed(2)}`,
  );
  assert.ok(
    h < 80 || h > 190,
    `Greige snapped to sage/blue: ${greige!.hex} hue ${h.toFixed(0)}`,
  );
});

test("mushroom stays a warm neutral, not teal, on a fair face", () => {
  const curated = SUBSEASON_PALETTES["soft-summer"];
  const palette = buildPaletteFromColouring(curated, "soft-summer", {
    undertone: "cool",
    contrast: "high",
    skinHex: "#E8C8BE",
    hairHex: "#3A2A22",
    eyeHex: "#3F6B4A",
  });
  const mushroom = palette.find((s) => s.name === "Mushroom");
  assert.ok(mushroom, "missing Mushroom");
  const { h } = hexToHsl(mushroom!.hex);
  assert.ok(
    h < 80 || h > 190,
    `Mushroom snapped to teal: ${mushroom!.hex} hue ${h.toFixed(0)}`,
  );
});

test("warm-autumn olive stays olive when hair is brown", () => {
  const curated = SUBSEASON_PALETTES["warm-autumn"];
  const palette = buildPaletteFromColouring(curated, "warm-autumn", {
    undertone: "warm",
    contrast: "medium",
    skinHex: "#C4A07A",
    hairHex: "#1A1410",
    eyeHex: "#5A3A22",
  });
  const olive = palette.find((s) => s.name === "Olive");
  assert.ok(olive, "missing Olive");
  const { h, s } = hexToHsl(olive!.hex);
  assert.ok(
    s < 0.1 || (h >= 46 && h <= 80),
    `Olive drifted to brown: ${olive!.hex} hue ${h.toFixed(0)}`,
  );
});

test("summer gamut strips warm gold pulled from olive skin", () => {
  const curated = SUBSEASON_PALETTES["soft-summer"];
  const palette = buildPaletteFromColouring(curated, "soft-summer", {
    undertone: "neutral",
    contrast: "medium",
    skinHex: "#C48A3A",
  });
  for (const sw of palette) {
    const { h, s } = hexToHsl(sw.hex);
    assert.ok(
      s <= 0.16 || h < 18 || h > 52,
      `${sw.name} ${sw.hex} still reads as warm gold`,
    );
  }
});

test("neutral undertone + warm cheek hex flips summer toward autumn", () => {
  assert.equal(
    refineSeasonFromSkinHex({
      season: "summer",
      undertone: "neutral",
      skinHex: "#C4A06A",
    }),
    "autumn",
  );
  assert.equal(
    refineSeasonFromSkinHex({
      season: "summer",
      undertone: "cool",
      skinHex: "#C4A06A",
    }),
    "summer",
  );
});

test("parseSwatchHex accepts #rgb and bare rrggbb", () => {
  assert.equal(parseSwatchHex("#ABC"), "#aabbcc");
  assert.equal(parseSwatchHex("4A6E9A"), "#4a6e9a");
  assert.equal(parseSwatchHex("n/a"), null);
});
