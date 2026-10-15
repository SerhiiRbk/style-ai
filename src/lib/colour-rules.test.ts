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
  // A placeholder swatch and no feed colour: a title with no colour word is not evidence.
  assert.equal(
    slotColourAdmitted("navy-grey", "Wam Belt 30005 Cario", { productHex: "#CCCCCC", productColor: null }),
    false,
  );
  assert.equal(
    slotColourAdmitted("navy-grey", "Wam Denim Belt 30005 Cario Grey", { productHex: "#CCCCCC", productColor: "Grey" }),
    true,
  );
});

test("slotColourAdmitted: same-family neutrals fill the slot (bdfc2d44 look 5)", () => {
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Reserved Slim Fit Chinos", {
      productColor: "Grey",
      productHex: "#6B6B6B",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Grey Slim Fit Chinos", {
      productHex: "#CCCCCC",
      productColor: null,
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Zara Regular Fit Textured Oxford Shirt", {
      productHex: "#bcc4e0",
      productColor: null,
      category: "Shirts",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Light Grey Oxford Shirt", {
      productHex: "#CCCCCC",
      productColor: "Grey",
      category: "Shirts",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Charcoal Oxford Shirt", {
      productHex: "#3A3A3A",
      productColor: "Charcoal",
      category: "Shirts",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Grey Oxford Shirt", {
      productHex: "#6B6B6B",
      productColor: "Grey",
      category: "Shirts",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("muted-navy", "Leather Belt With Buckle", {
      productColor: "Navy",
      productHex: "#1A2332",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("slate-blue", "Merino Crewneck Knit", {
      productColor: "Navy",
      productHex: "#2F4B7C",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("greige", "Dove Grey Leather Backpack", {
      productColor: "Dove",
      productHex: "#C5C1B8",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("greige", "Navy Wool Overcoat", {
      productColor: "Navy",
      productHex: "#1A2332",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Oatmeal Chinos", {
      productColor: "Beige",
      productHex: "#D8CFB8",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("soft-charcoal", "Valmonti Leather Derby Shoes", {
      productColor: "Brown",
      productHex: "#6F4E37",
      category: "Footwear",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("greige", "Zara Textured Briefcase", {
      productColor: "Brown",
      productHex: "#6F4E37",
      category: "Accessories",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("muted-navy", "Black Leather Belt", {
      productColor: "Black",
      productHex: "#111111",
      category: "Accessories",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("greige", "Mango Leather Shopper Tote", {
      productColor: "Brown",
      productHex: "#6F4E37",
      category: "Accessories",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("soft-teal", "ZARA Regular Fit Denim Overshirt", {
      productColor: "Pastel blue",
      productHex: "#2F4B7C",
      category: "Outerwear",
    }),
    true,
  );
});

test("slotColourAdmitted: dusty chroma is not a pastel stand-in (f36900f9)", () => {
  assert.equal(
    slotColourAdmitted("dusty-blue", "Zara Comfort Textured Suit Blazer", {
      productColor: "Sky blue",
      productHex: "#8FB6D6",
      category: "Outerwear",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("cool-rose", "Valmonti Men’s Suede Penny Loafers", {
      productColor: "Pink",
      productHex: "#E1A0A8",
      category: "Footwear",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("mauve", "Marks & Spencer Slim Fit Stretch Ultimate Suit Trousers", {
      productColor: "Lilac",
      productHex: "#C0AED4",
      category: "Trousers",
    }),
    false,
  );
  assert.equal(
    slotColourAdmitted("dusty-blue", "Navy Wool Blazer", {
      productColor: "Navy",
      productHex: "#2F4B7C",
      category: "Outerwear",
    }),
    true,
  );
  assert.equal(
    slotColourAdmitted("dusty-blue", "Wam Denim The Zarek White Blue Blazer", {
      productHex: "#CCCCCC",
      productColor: null,
      category: "Outerwear",
    }),
    false,
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
  assert.equal(isTailoredJacketSafeName("Soft teal"), false);
  assert.equal(isTailoredJacketSafeName("Teal"), false);
  assert.equal(isTailoredJacketSafeName("Dusty blue"), true);
  assert.equal(isTailoredJacketSafeName("Spruce"), true);
  assert.equal(isOvercoatSafeName("Navy grey"), true);
  assert.equal(isOvercoatSafeName("Charcoal grey"), true);
  assert.equal(isOvercoatSafeName("Camel"), true);
  assert.equal(isOvercoatSafeName("Greige"), true);
  assert.equal(isOvercoatSafeName("Dusty blue"), false);
  assert.equal(isOvercoatSafeName("Mauve"), false);
});

test("tailored jackets allow a buyable whitelist only", () => {
  for (const name of [
    "Navy",
    "Charcoal",
    "Mid grey",
    "Black",
    "Dusty blue",
    "Slate",
    "Camel",
    "Beige",
    "Cream",
    "Ivory",
    "Brown",
    "Olive",
    "Hunter",
    "White",
    "Navy check",
  ]) {
    assert.equal(isTailoredJacketSafeName(name), true, name);
  }
  for (const name of [
    "Sage",
    "Mint",
    "Turquoise",
    "Powder blue",
    "Baby blue",
    "Light blue",
    "Mustard",
    "Gold",
    "Soft teal",
  ]) {
    assert.equal(isTailoredJacketSafeName(name), false, name);
  }
  assert.equal(isTailoredJacketSafeName("Burgundy"), true);
  assert.equal(isTailoredJacketSafeName("Burgundy", "dinner"), true);
  assert.equal(isTailoredJacketSafeName("Oxblood", "party"), true);
  assert.equal(isTailoredJacketSafeName("Burgundy", "work"), false);
  assert.equal(isTailoredJacketSafeName("Wine", "business_social"), false);
  assert.equal(isTailoredJacketSafeName("Plum"), false);
  assert.equal(isTailoredJacketSafeName("Plum", "party"), false);
  assert.equal(isTailoredJacketSafeName("Plum", "party", "moderate"), false);
  assert.equal(isTailoredJacketSafeName("Plum", "dinner", "statement"), false);
  assert.equal(isTailoredJacketSafeName("Plum", "work", "statement"), false);
  assert.equal(isTailoredJacketSafeName("Soft plum", "party", "statement"), false);
  assert.equal(isTailoredJacketSafeName("Mauve", "party", "statement"), false);
  assert.equal(isTailoredJacketSafeName("Plum", "party", "statement"), true);
  assert.equal(isTailoredJacketSafeName("Aubergine", "party", "experimental"), true);
});

test("nearFaceVerdict: one vocabulary for the three near-face heuristics", () => {
  assert.equal(rule(nearFaceVerdict("Light Blue Merino Jumper", "#a9c4de", { undertone: "warm" })), "cool-pastel-on-warm");
  assert.equal(rule(nearFaceVerdict("Light Blue Merino Jumper", "#a9c4de", { undertone: "cool" })), null);
  assert.equal(rule(nearFaceVerdict("Cream Oxford Shirt", "#f1e6cf", { undertone: "cool", role: "shirt" })), "warm-cream-on-cool");
  assert.equal(rule(nearFaceVerdict("Cream Oxford Shirt", "#f1e6cf", { undertone: "warm", role: "shirt" })), null);
  assert.equal(rule(nearFaceVerdict("Saffron Knit", "#e0a52b", { undertone: "neutral" })), "warm-yellow");
});
