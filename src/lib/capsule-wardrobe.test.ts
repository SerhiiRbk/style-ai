import assert from "node:assert/strict";
import test from "node:test";
import { SUBSEASON_PALETTES } from "./colour-palette";
import { avoidColorsForSubseason } from "./colour-palette";
import type { ColorRec } from "./report";
import {
  capsuleLookLine,
  capsuleWardrobeSlots,
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

test("cool wardrobe prefers a white shirt and cool leather, not cream or brown", () => {
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
    assert.match(shoe!.query, /not brown/i);
    assert.match(shoe!.query, /not cognac/i);
  }
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
