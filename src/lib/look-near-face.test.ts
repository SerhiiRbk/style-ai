import assert from "node:assert/strict";
import test from "node:test";
import { nearFaceItem, nearFaceSwatchFromItems, swatchForColorWords } from "./look-near-face";
import { SUBSEASON_PALETTES } from "./colour-palette";

const BEST = SUBSEASON_PALETTES["soft-summer"].map((c) => ({ ...c, why: "" }));

test("nearFaceItem picks the outer layer, then the knit, then the shirt", () => {
  const items = [
    { garment: "oxford shirt", color: "dusty rose" },
    { garment: "merino crewneck", color: "soft plum" },
    { garment: "unstructured blazer", color: "muted navy" },
    { garment: "chinos", color: "greige" },
  ];
  assert.equal(nearFaceItem(items)?.garment, "unstructured blazer");
  assert.equal(nearFaceItem(items.slice(0, 2))?.garment, "merino crewneck");
  assert.equal(nearFaceItem(items.slice(0, 1))?.garment, "oxford shirt");
  assert.equal(nearFaceItem([{ garment: "loafers", color: "grey" }]), null);
});

test("colour words resolve to the palette swatch — exact name first, then family, deeper first", () => {
  assert.equal(swatchForColorWords("soft plum", BEST)?.name, "Soft plum");
  assert.equal(swatchForColorWords("dusty rose", BEST)?.name, "Dusty rose");
  // "navy" is not a swatch name here but shares the blue family with Muted navy / Slate blue.
  const navy = swatchForColorWords("navy", BEST);
  assert.ok(navy && /navy|slate|blue/i.test(navy.name), navy?.name);
  assert.equal(swatchForColorWords("", BEST), null);
  assert.equal(swatchForColorWords("neon lime", BEST), null);
});

test("nearFaceSwatchFromItems: the face layer's colour, independent of palette order", () => {
  const sw = nearFaceSwatchFromItems(
    [
      { garment: "shirt", color: "greige" },
      { garment: "crewneck knit", color: "soft plum" },
      { garment: "chinos", color: "mushroom" },
    ],
    BEST,
  );
  assert.equal(sw?.name, "Soft plum");
  assert.equal(nearFaceSwatchFromItems([], BEST), null);
  assert.equal(nearFaceSwatchFromItems(undefined, BEST), null);
});
