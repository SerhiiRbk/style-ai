import assert from "node:assert/strict";
import test from "node:test";
import { SUBSEASON_PALETTES } from "./colour-palette";
import { avoidColorsForSubseason } from "./colour-palette";
import type { ColorRec } from "./report";
import {
  capsuleLookLine,
  capsuleWardrobeSlots,
  leatherFallbacks,
  type CapsuleWardrobeSlot,
} from "./capsule-wardrobe";
import { chromaticHeroClash, hitsAvoidPalette } from "./style-extras";

const SUMMER_BEST: ColorRec[] = SUBSEASON_PALETTES["soft-summer"].map((c) => ({
  ...c,
  why: "",
}));
const SUMMER_AVOID = avoidColorsForSubseason("soft-summer");

function byRole(slots: CapsuleWardrobeSlot[], role: CapsuleWardrobeSlot["role"]) {
  return slots.find((s) => s.role === role);
}

test("soft-summer wardrobe requires a dark trouser that is not the jacket", () => {
  const slots = capsuleWardrobeSlots(SUMMER_BEST, SUMMER_AVOID, {
    outdoorJeans: false,
    polished: true,
  });
  const jacket = byRole(slots, "jacket");
  const dark = byRole(slots, "darkTrouser");
  assert.ok(jacket, "missing jacket slot");
  assert.ok(dark, "missing dark trouser slot");
  assert.equal(dark!.category, "Trousers");
  assert.ok(
    !hitsAvoidPalette(`${dark!.color.name}`, dark!.color.hex, SUMMER_AVOID),
    `dark trouser ${dark!.color.name} hits avoid`,
  );
  assert.equal(
    chromaticHeroClash(
      "jacket",
      "trousers",
      new Map([
        ["jacket", jacket!.color.hex],
        ["trousers", dark!.color.hex],
      ]),
    ),
    false,
    `jacket ${jacket!.color.name} clones dark trouser ${dark!.color.name}`,
  );
  assert.match(dark!.query, /navy|charcoal/i);
  assert.match(dark!.query, /not drawstring/i);
});

test("soft-summer shirts are neutrals, not light green or yellow", () => {
  const slots = capsuleWardrobeSlots(SUMMER_BEST, SUMMER_AVOID, {
    polished: true,
  });
  const shirts = slots.filter((s) => s.role === "shirt");
  assert.ok(shirts.length >= 2, `expected two shirts, got ${shirts.length}`);
  for (const s of shirts) {
    assert.equal(
      hitsAvoidPalette(`${s.color.name} shirt`, s.color.hex, SUMMER_AVOID),
      false,
      `shirt ${s.color.name} hits avoid`,
    );
    assert.equal(
      /\b(yellow|lime|pistachio|mint|light green|olive|mustard|cream|ivory|maize)\b/i.test(
        s.color.name,
      ),
      false,
      `shirt colour ${s.color.name} is yellow-green`,
    );
    assert.match(s.query, /oxford|poplin|shirt/i);
  }
});

test("cool wardrobe prefers a white shirt; dress leather may stay black or brown", () => {
  const slots = capsuleWardrobeSlots(SUMMER_BEST, SUMMER_AVOID, {
    polished: true,
    cool: true,
  });
  const shirts = slots.filter((s) => s.role === "shirt");
  assert.ok(
    shirts.some((s) => /white|dove|grey|gray/i.test(s.color.name)),
    `expected a cool shirt, got ${shirts.map((s) => s.color.name).join(", ")}`,
  );
  assert.equal(
    shirts.some((s) => /cream|ivory|greige|beige/i.test(s.color.name)),
    false,
    `cream slipped onto a cool shirt: ${shirts.map((s) => s.color.name).join(", ")}`,
  );
  for (const role of ["dressShoe", "loafer"] as const) {
    const shoe = byRole(slots, role);
    assert.ok(shoe, `missing ${role}`);
    assert.equal(
      /not brown|not cognac/i.test(shoe!.query),
      false,
      `${role} query banned classic leather: ${shoe!.query}`,
    );
  }
});

test("leather opts lock dress, loafer, sneaker and belt to the footwear system", () => {
  const leather = {
    dress: { name: "Burgundy", hex: "#5A2A2E" },
    smart: { name: "Muted navy", hex: "#3E4C63" },
    everyday: { name: "Soft white", hex: "#F5F5F5" },
  };
  const slots = capsuleWardrobeSlots(SUMMER_BEST, SUMMER_AVOID, {
    polished: true,
    cool: true,
    leather,
  });
  const dress = byRole(slots, "dressShoe")!;
  const loafer = byRole(slots, "loafer")!;
  const sneaker = byRole(slots, "sneaker")!;
  const belt = byRole(slots, "belt")!;
  assert.equal(dress.color.hex.toLowerCase(), "#5a2a2e");
  assert.match(dress.query, /burgundy/i);
  assert.equal(loafer.color.hex.toLowerCase(), "#3e4c63");
  assert.equal(sneaker.color.hex.toLowerCase(), "#f5f5f5");
  assert.equal(belt.color.hex.toLowerCase(), "#5a2a2e");
  assert.match(belt.query, /burgundy/i);
});

test("leatherFallbacks keep classic dress leather and never jet-black sneakers", () => {
  const dress = leatherFallbacks("dress", { name: "Burgundy", hex: "#5A2A2E" });
  assert.equal(dress[0]!.name, "Burgundy");
  assert.ok(
    dress.some((c) => /brown/i.test(c.name)),
    `dress fallbacks missed brown: ${dress.map((c) => c.name).join(", ")}`,
  );
  assert.ok(
    dress.some((c) => /^black$/i.test(c.name)),
    `dress fallbacks missed black etiquette: ${dress.map((c) => c.name).join(", ")}`,
  );

  const sneakers = leatherFallbacks(
    "everyday",
    { name: "Greige", hex: "#DAD3C6" },
    { avoidJetBlackSneakers: true },
  );
  assert.equal(sneakers[0]!.name, "Greige");
  assert.equal(
    sneakers.some((c) => /^black$/i.test(c.name)),
    false,
    `jet-black sneaker slipped in: ${sneakers.map((c) => c.name).join(", ")}`,
  );
});

test("casual trouser is not the same hex as the jacket", () => {
  const slots = capsuleWardrobeSlots(SUMMER_BEST, SUMMER_AVOID, {
    outdoorJeans: true,
  });
  const jacket = byRole(slots, "jacket")!;
  const casual = byRole(slots, "casualTrouser")!;
  assert.notEqual(casual.color.hex.toLowerCase(), jacket.color.hex.toLowerCase());
});

test("capsuleLookLine is a look brief, not a catalogue SEO title", () => {
  const line = capsuleLookLine(
    [
      "Valmonti Men’s Smart Casual Jacket – Lightweight Slim Blazer For Summer Days And Evenings",
      "Valmonti Men’s Lightweight Summer Shirt With Ribbed Texture – Slim Button-Up For Dates And City Wear",
      "Valmonti Men’s Double Pleat Straight Leg Lightweight Tailored Trousers",
      "Gentleman Shoe Casual Flat Shoes",
    ],
    new Map([
      [
        "Valmonti Men’s Smart Casual Jacket – Lightweight Slim Blazer For Summer Days And Evenings",
        "#9AA588",
      ],
      [
        "Valmonti Men’s Lightweight Summer Shirt With Ribbed Texture – Slim Button-Up For Dates And City Wear",
        "#8B8B8B",
      ],
      [
        "Valmonti Men’s Double Pleat Straight Leg Lightweight Tailored Trousers",
        "#3E4C63",
      ],
      ["Gentleman Shoe Casual Flat Shoes", "#4C4C4C"],
    ]),
    new Map([
      [
        "Valmonti Men’s Smart Casual Jacket – Lightweight Slim Blazer For Summer Days And Evenings",
        "Sage Green",
      ],
      [
        "Valmonti Men’s Lightweight Summer Shirt With Ribbed Texture – Slim Button-Up For Dates And City Wear",
        "Grey",
      ],
      [
        "Valmonti Men’s Double Pleat Straight Leg Lightweight Tailored Trousers",
        "Muted navy",
      ],
      ["Gentleman Shoe Casual Flat Shoes", "Dark Grey"],
    ]),
  );
  assert.equal(/valmonti|dates and city|lightweight slim/i.test(line), false, line);
  assert.match(line, /sage/i);
  assert.match(line, /blazer/i);
  assert.match(line, /grey/i);
  assert.match(line, /shirt/i);
  assert.match(line, /navy/i);
  assert.match(line, /trousers/i);
});

test("a mauve-first Cool Summer still puts dusty-blue on the jacket; mauve may be the knit", () => {
  const best: ColorRec[] = [
    { name: "Mauve", hex: "#9C6B84", why: "" },
    { name: "Dusty blue", hex: "#6E8CA6", why: "" },
    { name: "Navy grey", hex: "#2B3A4E", why: "" },
    { name: "Cool white", hex: "#F1F1EF", why: "" },
    { name: "Charcoal grey", hex: "#3A4048", why: "" },
  ];
  const slots = capsuleWardrobeSlots(best, [], { polished: true, cool: true });
  const jacket = byRole(slots, "jacket")!;
  const knit = byRole(slots, "knit")!;
  assert.equal(/\b(mauve|rose|pink|blush|lilac|lavender)\b/i.test(jacket.color.name), false, jacket.color.name);
  assert.match(jacket.color.name, /dusty blue|navy|charcoal|slate/i);
  assert.match(knit.color.name, /mauve/i);
});

test("knit slot is a second palette hero, not another grey, when the palette has two heroes", () => {
  const slots = capsuleWardrobeSlots(SUMMER_BEST, SUMMER_AVOID, { polished: true, cool: true });
  const jacket = byRole(slots, "jacket")!;
  const knit = byRole(slots, "knit")!;
  const heroes = SUMMER_BEST.filter((c) => {
    const hex = c.hex.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    return s >= 0.16;
  });
  assert.ok(heroes.length >= 2, "fixture needs two heroes");
  assert.notEqual(knit.color.hex.toLowerCase(), jacket.color.hex.toLowerCase());
  assert.ok(
    heroes.some((h) => h.hex.toLowerCase() === knit.color.hex.toLowerCase()),
    `knit ${knit.color.name} is not a hero colour`,
  );
});

test("warm wardrobe shirts welcome cream and refuse optic white; cool wardrobe still refuses cream", () => {
  const AUTUMN_BEST: ColorRec[] = SUBSEASON_PALETTES["deep-autumn"].map((c) => ({ ...c, why: "" }));
  const AUTUMN_AVOID = avoidColorsForSubseason("deep-autumn");
  const warm = capsuleWardrobeSlots(AUTUMN_BEST, AUTUMN_AVOID, { polished: true, warm: true });
  for (const s of warm.filter((x) => x.role === "shirt")) {
    assert.match(s.query, /cream, ecru or off-white welcome, not optic white/);
    assert.doesNotMatch(s.query, /not cream/);
  }
  const cool = capsuleWardrobeSlots(SUMMER_BEST, SUMMER_AVOID, { polished: true, cool: true });
  for (const s of cool.filter((x) => x.role === "shirt")) {
    assert.match(s.query, /not cream, not ivory/);
  }
});
