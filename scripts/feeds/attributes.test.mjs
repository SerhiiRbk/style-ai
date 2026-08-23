import assert from "node:assert/strict";
import test from "node:test";
import {
  parseProductAttributes,
  normFit,
  normMaterial,
  normSubtype,
} from "./attributes.mjs";

test("Reserved attrs are harvested, filler → null", () => {
  const r = parseProductAttributes({
    title: "Regular Fit Linen Rich Shirt",
    description: "Regular fit shirt made of linen rich fabric with cotton blend.",
    category: "Shirts",
    attrs: { fit: "regular", pattern: "plain design", material: "cotton, linen", season: "AW 2024" },
  });
  assert.deepEqual(r, {
    garment_subtype: "shirt", material_family: "linen", fit: "regular",
    pattern: "solid", season: "winter",
  });
  // "combined materials" is filler, not a fiber → null (no guessing)
  assert.equal(normMaterial("combined materials"), null);
});

test("ZARA bare title → subtype + partial material, no guessing", () => {
  const r = parseProductAttributes({
    title: "Regular Fit Textured Shirt", description: "REGULAR FIT TEXTURED SHIRT",
    category: "Shirts", attrs: { material: null },
  });
  assert.equal(r.garment_subtype, "shirt");
  assert.equal(r.material_family, null);   // never guess cotton from "shirt"
  assert.equal(r.fit, "regular");
  assert.equal(r.pattern, "textured");
});

test("subtype from title nouns — longest match, garment-level", () => {
  assert.equal(normSubtype("Relaxed Fit Double-Breasted Blazer"), "blazer");
  assert.equal(normSubtype("100% Linen Cargo Bermuda Shorts"), "shorts");
  assert.equal(normSubtype("Relaxed Fit Overshirt"), "overshirt");
  assert.equal(normSubtype("Cotton Shirt Jacket"), "jacket");
  assert.equal(normSubtype("Leather Crossbody Bag"), "crossbody");
});

test("ambiguous tokens are not guessed", () => {
  // flannel is a weave, not a fiber — cotton flannel must not become wool
  assert.equal(normMaterial("Cotton Flannel Shirt"), "cotton");
  assert.equal(normMaterial("Wool Flannel Suit"), "wool");
  assert.equal(normMaterial("Flannel Shirt"), null);
  // structured describes fabric body, not cut — must not beat Regular Fit
  assert.equal(normFit("Regular Fit Lightweight Structured T-Shirt"), "regular");
  assert.equal(normFit("Lightweight Structured Running T-Shirt"), null);
  // plural oxfords / "oxford shoes" are footwear; shirts still match via "shirt"
  assert.equal(normSubtype("Leather Oxfords"), "oxfords");
  assert.equal(normSubtype("Brown Oxford Shoes"), "oxfords");
  assert.equal(normSubtype("Oxford Shirt"), "shirt");
  assert.equal(normSubtype("COS Oxford Button-Down Shirt"), "shirt");
  assert.equal(normSubtype("Textured Oxford"), null);
});

test("extended fibre vocab — cellulosics/synthetics/bast; hardware stays null", () => {
  assert.equal(normMaterial("lyocell"), "viscose");
  assert.equal(normMaterial("modal"), "viscose");
  assert.equal(normMaterial("cellulose diacetate"), "viscose");
  assert.equal(normMaterial("polyurethane"), "technical");
  assert.equal(normMaterial("polyurethane thermoplastic"), "technical");
  // "ethylene vinyl acetate" must be technical, not viscose via the "acetate" alias
  assert.equal(normMaterial("ethylene vinyl acetate"), "technical");
  assert.equal(normMaterial("acrylic"), "technical");
  assert.equal(normMaterial("hemp"), "linen");
  assert.equal(normMaterial("ramie"), "linen");
  // hardware / trims are not fabrics → null (no fake family on jewelry/watches/buckles)
  assert.equal(normMaterial("brass"), null);
  assert.equal(normMaterial("stainless steel"), null);
  assert.equal(normMaterial("fresh water pearl"), null);
});
