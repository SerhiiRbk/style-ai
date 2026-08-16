import assert from "node:assert/strict";
import test from "node:test";
import { attrFitScore } from "./catalog-attrfit";

test("subtype + material match add, nulls add 0", () => {
  const base = {
    id: "1",
    title: "t",
    color: null,
    price_eur: null,
    deeplink: null,
    image_url: null,
    garment_subtype: null,
    material_family: null,
  };
  const slot = { subtype: "blazer", material: "wool" };
  // Weak title match → subtype bonus applies (avoids double-counting garmentTitleMatchScore).
  assert.ok(attrFitScore({ ...base, garment_subtype: "blazer", material_family: "wool" }, slot, 0) > 0);
  assert.equal(attrFitScore({ ...base }, slot, 0), 0); // row untyped → 0
  assert.equal(attrFitScore({ ...base, garment_subtype: "blazer" }, { subtype: null, material: null }, 0), 0);
  assert.ok(
    attrFitScore({ ...base, garment_subtype: "hoodie", material_family: "cotton" }, slot, 0) <
    attrFitScore({ ...base, garment_subtype: "blazer", material_family: "wool" }, slot, 0),
  );
});

test("subtype bonus is skipped when the title already matched the garment", () => {
  const row = {
    id: "1", title: "Wool Blazer", color: null, price_eur: null, deeplink: null, image_url: null,
    garment_subtype: "blazer", material_family: "wool",
  };
  const slot = { subtype: "blazer", material: "wool" };
  const weak = attrFitScore(row, slot, 0);
  const strong = attrFitScore(row, slot, 1);
  assert.ok(weak > strong);          // 0.10 subtype + 0.06 material vs material only
  assert.equal(strong, 0.06);        // title already paid for subtype via garmentScore
});
