import assert from "node:assert/strict";
import test from "node:test";
import { toRow } from "./upsert.mjs";
import { ATTR_TYPING_VERSION } from "./attributes.mjs";

test("toRow stamps typed attributes", () => {
  const row = toRow(
    { source: "s", externalId: "x", title: "Relaxed Fit Double-Breasted Blazer",
      category: "Outerwear", color: "beige", attrs: { material: "wool" }, deeplink: "d" },
    undefined, "feed", false,
  );
  assert.equal(row.garment_subtype, "blazer");
  assert.equal(row.material_family, "wool");
  assert.equal(row.fit, "relaxed");
  assert.equal(row.attr_typing_v, ATTR_TYPING_VERSION);
});
