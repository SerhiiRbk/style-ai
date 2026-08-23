import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRerankAttrs,
  formatRerankCandidate,
} from "./look-item-rerank-format";

test("rerank candidate line includes typed subtype/material/fit/pattern", () => {
  const line = formatRerankCandidate(0, {
    id: "1",
    brand: "Reserved",
    title: "Slim Fit Linen Shirt",
    color: "green",
    priceEur: 39,
    category: "Shirts",
    subtype: "shirt",
    material: "linen",
    fit: "slim",
    pattern: "solid",
  });
  assert.match(line, /\[0\] Reserved Slim Fit Linen Shirt/);
  assert.match(line, /colour green/);
  assert.match(line, /shirt\/linen\/slim\/solid/);
  assert.match(line, /€39/);
  assert.equal(
    formatRerankAttrs({
      id: "1",
      brand: null,
      title: "Tee",
      color: null,
      priceEur: null,
      category: "Shirts",
      subtype: "tee",
      material: "cotton",
    }),
    "tee/cotton",
  );
});
