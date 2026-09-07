import assert from "node:assert/strict";
import test from "node:test";
import {
  avoidPaletteVerdict,
  hitsAvoidPalette,
  nearFaceVerdict,
  slotColourAdmitted,
  titleColourOverridesHex,
  isOvercoatSafeName,
  isPinkFamilyName,
  isTailoredJacketSafeName,
} from "./colour-rules";

const COOL_AVOID = [
  { name: "Pure Black", hex: "#000000" },
  { name: "Bright Orange", hex: "#FF6B35" },
  { name: "Golden Yellow", hex: "#F4C430" },
  { name: "Rust", hex: "#B7410E" },
];
const WARM_AVOID = [
  { name: "Pure Black", hex: "#000000" },
  { name: "Icy Pink", hex: "#F2C6D2" },
  { name: "Fuchsia", hex: "#B01455" },
  { name: "Cool Cobalt", hex: "#0E63C4" },
];

const rule = (v: ReturnType<typeof avoidPaletteVerdict>) => (v.ok ? null : v.rule);

test("avoidPaletteVerdict names the rule that fired", () => {
  assert.equal(rule(avoidPaletteVerdict("Black Cotton Tee", "#0a0a0a", COOL_AVOID, { category: "Knitwear" })), "black-listed");
  assert.equal(rule(avoidPaletteVerdict("Terracotta Chinos", "#c5643f", COOL_AVOID)), "hue-neighbour-hex");
  // The first rule in avoid-list order wins: Bright Orange's hex neighbourhood catches rust before the rust word does.
  assert.equal(rule(avoidPaletteVerdict("Rust Merino Jumper", "#b7410e", COOL_AVOID)), "hue-neighbour-hex");
  assert.equal(rule(avoidPaletteVerdict("Rust Merino Jumper", "#b7410e", [{ name: "Rust", hex: "#B7410E" }])), "rust-title");
  assert.equal(rule(avoidPaletteVerdict("Mustard Crewneck", "#c9a24b", COOL_AVOID)), "hue-neighbour-hex");
  assert.equal(rule(avoidPaletteVerdict("Mustard Crewneck", "#c9a24b", [{ name: "Golden Yellow", hex: "#F4C430" }])), "yellow-title");
  assert.equal(rule(avoidPaletteVerdict("Light Blue Oxford Shirt", "#a9c4de", WARM_AVOID)), "cool-family-hex");
  assert.equal(rule(avoidPaletteVerdict("Pink Linen Shirt", "#d9a3b5", WARM_AVOID)), "cool-family-hex");
  assert.equal(rule(avoidPaletteVerdict("Pink Linen Shirt", "#d9a3b5", [{ name: "Fuchsia" }])), "pink-title");
});

test("avoidPaletteVerdict: a muted palette neighbour of a vivid avoid passes, dress leather is etiquette", () => {
  assert.equal(rule(avoidPaletteVerdict("Dusty Rose Chinos", "#d4c2c0", COOL_AVOID)), null);
  assert.equal(
    rule(avoidPaletteVerdict("Tan Leather Derbies", "#a56a3a", [{ name: "Tan", hex: "#C69B6D" }], { category: "Footwear", role: "dressShoe" })),
    null,
  );
  assert.equal(hitsAvoidPalette("Dusty Rose Chinos", "#d4c2c0", COOL_AVOID), false);
  assert.equal(hitsAvoidPalette("Terracotta Chinos", "#c5643f", COOL_AVOID), true);
});

test("slotColourAdmitted: oatmeal polo cannot fill a cool-white shirt (64510d11)", () => {
  assert.equal(
    slotColourAdmitted("cool-white", "Zara Regular Fit Textured Knit Polo Shirt", {
      productHex: "#D8CFB8",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("cool-white", "COS Oxford Button-Down Shirt", {
      productHex: "#FFFFFF",
      productColor: "White",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("mauve", "Marks & Spencer Pure Silk Pocket Square", {
      productHex: "#111111",
    }),
    false,
  );
  assert.equal(slotColourAdmitted(null, "Anything", { productHex: "#D8CFB8" }), true);
  // A placeholder swatch and no feed colour: "Cario Grey" in the title is a model name, not a colour.
  assert.equal(
    slotColourAdmitted("navy-grey", "Wam Denim Belt 30005 Cario Grey", { productHex: "#CCCCCC", productColor: null }),
    false,
  );
  assert.equal(
    slotColourAdmitted("navy-grey", "Wam Denim Belt 30005 Cario Grey", { productHex: "#CCCCCC", productColor: "Grey" }),
    true,
  );
});

test("titleColourOverridesHex: a Baby Blue name beats a navy feed hex", () => {
  assert.equal(
    titleColourOverridesHex(
      "Luciénte Pure Extra-Fine Merino Wool Two Tone Crewneck",
      "#2F4B7C",
      "Baby Blue",
    ),
    "#AEC7DE",
  );
  assert.equal(
    titleColourOverridesHex("Navy Blue Chinos", "#28324a", "Navy Blue"),
    null,
  );
});

test("mauve is a knit colour, not a blazer or overcoat colour", () => {
  assert.equal(isPinkFamilyName("Mauve"), true);
  assert.equal(isPinkFamilyName("Cool rose"), true);
  assert.equal(isPinkFamilyName("Dusty blue"), false);
  assert.equal(isTailoredJacketSafeName("Mauve"), false);
  assert.equal(isTailoredJacketSafeName("Dusty blue"), true);
  assert.equal(isTailoredJacketSafeName("Spruce"), true);
  assert.equal(isOvercoatSafeName("Navy grey"), true);
  assert.equal(isOvercoatSafeName("Charcoal grey"), true);
  assert.equal(isOvercoatSafeName("Camel"), true);
  assert.equal(isOvercoatSafeName("Greige"), true);
  assert.equal(isOvercoatSafeName("Dusty blue"), false);
  assert.equal(isOvercoatSafeName("Mauve"), false);
});

test("nearFaceVerdict: one vocabulary for the three near-face heuristics", () => {
  assert.equal(rule(nearFaceVerdict("Light Blue Merino Jumper", "#a9c4de", { undertone: "warm" })), "cool-pastel-on-warm");
  assert.equal(rule(nearFaceVerdict("Light Blue Merino Jumper", "#a9c4de", { undertone: "cool" })), null);
  assert.equal(rule(nearFaceVerdict("Cream Oxford Shirt", "#f1e6cf", { undertone: "cool", role: "shirt" })), "warm-cream-on-cool");
  assert.equal(rule(nearFaceVerdict("Cream Oxford Shirt", "#f1e6cf", { undertone: "warm", role: "shirt" })), null);
  assert.equal(rule(nearFaceVerdict("Saffron Knit", "#e0a52b", { undertone: "neutral" })), "warm-yellow");
});
