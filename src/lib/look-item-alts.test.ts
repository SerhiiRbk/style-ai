import assert from "node:assert/strict";
import test from "node:test";
import type { ShoppingItem } from "@/lib/report";
import {
  LOOK_ITEM_ALTERNATIVE_LIMIT,
  attachLookItemAlts,
  lookItemKey,
  stripLookItemAlts,
  swapLookItem,
} from "./look-item-alts";

function item(over: Partial<ShoppingItem> & { productId: string }): ShoppingItem {
  return {
    category: "Shirts",
    title: over.title ?? over.productId,
    why: "",
    priceEur: 40,
    retailer: "Fixture",
    url: "https://shop.example/p",
    color: "#ccc",
    ...over,
  };
}

test("attachLookItemAlts keeps three unused neighbours and strips nested alts", () => {
  const winner = item({ productId: "blue", title: "Blue linen" });
  const pool = [
    winner,
    item({
      productId: "grey",
      title: "Grey linen",
      alternatives: [item({ productId: "nested", title: "Nested" })],
    }),
    item({ productId: "navy", title: "Navy linen" }),
    item({ productId: "sage", title: "Sage linen" }),
    item({ productId: "cream", title: "Cream oxford" }),
  ];
  const used = new Set(["blue", "belt-1"]);
  const next = attachLookItemAlts(winner, pool, used);
  assert.equal(next.productId, "blue");
  assert.deepEqual(
    next.alternatives?.map((a) => a.productId),
    ["grey", "navy", "sage"],
  );
  assert.equal(next.alternatives?.length, LOOK_ITEM_ALTERNATIVE_LIMIT);
  assert.equal(next.alternatives?.[0]?.alternatives, undefined);
});

test("swapLookItem promotes the alternative and parks the old pick in the pool", () => {
  const grey = item({ productId: "grey", title: "Grey linen" });
  const navy = item({ productId: "navy", title: "Navy linen" });
  const shirt = item({
    productId: "blue",
    title: "Blue linen",
    alternatives: [grey, navy],
  });
  const trousers = item({ productId: "chino", category: "Trousers", title: "Chinos" });
  const swapped = swapLookItem([shirt, trousers], "blue", grey);
  assert.ok(swapped);
  assert.equal(swapped[0]?.productId, "grey");
  assert.deepEqual(
    swapped[0]?.alternatives?.map((a) => a.productId),
    ["blue", "navy"],
  );
  assert.equal(swapped[1]?.productId, "chino");
  assert.equal(lookItemKey(stripLookItemAlts(swapped[0]!)), "grey");
});

test("swapLookItem returns null when the current piece is missing", () => {
  assert.equal(
    swapLookItem([item({ productId: "blue" })], "missing", item({ productId: "grey" })),
    null,
  );
});
