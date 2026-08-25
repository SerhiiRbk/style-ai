import assert from "node:assert/strict";
import test from "node:test";
import { CREDIT_COSTS } from "./credit-costs";
import {
  MAX_COMPLETE_LOOK_ANCHORS,
  completeLookFills,
  completeLookHasFills,
  completeLookSlot,
  composeCompleteLookDescription,
  findCompleteLookConflict,
  orderCompleteLookItems,
  parseCompleteLookProductIds,
  restoreLockedAnchors,
} from "./complete-look";
import type { ShoppingItem } from "./report";

function item(
  category: string,
  title: string,
  extra: Partial<ShoppingItem> = {},
): ShoppingItem {
  return {
    category,
    title,
    why: "",
    priceEur: 0,
    retailer: "X",
    url: "#",
    color: "#111111",
    ...extra,
  };
}

test("completeLookSlot splits accessory kinds", () => {
  assert.equal(completeLookSlot(item("Shirts", "Oxford Shirt")), "shirt");
  assert.equal(completeLookSlot(item("Accessories", "Leather Belt")), "belt");
  assert.equal(
    completeLookSlot(item("Accessories", "Zara Textured Briefcase")),
    "bag",
  );
  assert.equal(completeLookSlot(item("Bags", "Canvas Tote")), "bag");
  assert.equal(completeLookSlot(item("Accessories", "Zara Belt Bag")), "bag");
  assert.equal(completeLookSlot(item("Accessories", "Cashmere Scarf")), "other:scarf");
  assert.equal(completeLookSlot(item("Accessories", "Leather Gloves")), "other:gloves");
  assert.equal(completeLookSlot(item("Knitwear", "Merino Crew")), "knit");
});

test("shirt plus belt is not a conflict; two belts are", () => {
  assert.equal(
    findCompleteLookConflict([
      item("Trousers", "Coffee Chinos"),
      item("Accessories", "Olive Belt"),
    ]),
    null,
  );
  const clash = findCompleteLookConflict([
    item("Accessories", "Olive Belt"),
    item("Accessories", "Black Belt"),
  ]);
  assert.equal(clash?.slot, "belt");
  assert.equal(clash?.titles.length, 2);
});

test("scarf plus gloves is not a same-role conflict", () => {
  assert.equal(
    findCompleteLookConflict([
      item("Accessories", "Cashmere Scarf"),
      item("Accessories", "Leather Gloves"),
    ]),
    null,
  );
  assert.equal(
    findCompleteLookConflict([
      item("Accessories", "Navy Scarf"),
      item("Accessories", "Wool Cap"),
    ]),
    null,
  );
});

test("two shirts conflict; shirt plus knit does not", () => {
  assert.ok(
    findCompleteLookConflict([
      item("Shirts", "White Oxford"),
      item("Shirts", "Blue Oxford"),
    ]),
  );
  assert.equal(
    findCompleteLookConflict([
      item("Shirts", "White Oxford"),
      item("Knitwear", "Navy Crew"),
    ]),
    null,
  );
});

test("fills core holes around a belt and loafers", () => {
  const fills = completeLookFills(
    [
      item("Accessories", "Olive Belt", { colorName: "Olive" }),
      item("Footwear", "Chestnut Loafers", { colorName: "Chestnut" }),
    ],
    "smart_casual",
  );
  const garments = fills.map((g) => g.garment);
  assert.ok(garments.includes("shirt"));
  assert.ok(garments.includes("chinos"));
  assert.ok(!garments.includes("belt"));
  assert.ok(!garments.includes("loafers"));
  assert.ok(fills.length <= 4);
});

test("work shirt color uses trouser hex when the name is missing", () => {
  const fills = completeLookFills(
    [item("Trousers", "Slim Trousers", { color: "#453529" })],
    "work",
  );
  const shirt = fills.find((g) => g.category === "Shirts");
  assert.equal(shirt?.color, "white");
});

test("work fills a tucked oxford, leather shoes, blazer and briefcase", () => {
  const fills = completeLookFills(
    [item("Trousers", "Coffee Chinos", { colorName: "coffee" })],
    "work",
  );
  const garments = fills.map((g) => `${g.category}:${g.garment}`);
  assert.ok(garments.some((g) => g.startsWith("Shirts:")));
  assert.ok(garments.includes("Footwear:leather shoes"));
  assert.ok(garments.includes("Outerwear:blazer"));
  assert.ok(garments.includes("Accessories:belt"));
  assert.ok(garments.includes("Accessories:briefcase"));
  assert.ok(!garments.some((g) => g.startsWith("Trousers:")));
});

test("weekend does not add a blazer or briefcase", () => {
  const fills = completeLookFills(
    [item("Shirts", "Linen Shirt")],
    "weekend",
  );
  assert.ok(!fills.some((g) => g.category === "Outerwear"));
  assert.ok(!fills.some((g) => g.garment === "briefcase" || g.garment === "tote"));
});

test("restoreLockedAnchors never drops or substitutes the locked SKU", () => {
  const locked = [
    item("Footwear", "Chestnut Loafers", { productId: "shoe-1" }),
  ];
  const next = [
    item("Footwear", "Black Oxfords", { productId: "shoe-2" }),
    item("Shirts", "White Oxford", { productId: "shirt-1" }),
  ];
  const restored = restoreLockedAnchors(locked, next);
  assert.ok(restored.some((i) => i.productId === "shoe-1"));
  assert.ok(!restored.some((i) => i.productId === "shoe-2"));
  assert.ok(restored.some((i) => i.productId === "shirt-1"));
});

test("orderCompleteLookItems is layer / shirt / trousers / belt / shoes", () => {
  const ordered = orderCompleteLookItems([
    item("Footwear", "Loafers"),
    item("Outerwear", "Blazer"),
    item("Accessories", "Belt"),
    item("Shirts", "Oxford"),
    item("Trousers", "Chinos"),
  ]);
  assert.deepEqual(
    ordered.map((i) => completeLookSlot(i)),
    ["outerwear", "shirt", "trousers", "belt", "footwear"],
  );
});

test("description names the shop pieces, not the planned fill clauses", () => {
  const text = composeCompleteLookDescription([
    item("Trousers", "Reserved Chino Slim Trousers", { colorName: "coffee" }),
    item("Shirts", "White Oxford Shirt", { colorName: "white" }),
  ]);
  assert.match(text, /coffee/i);
  assert.match(text, /chinos/i);
  assert.match(text, /oxford/i);
  assert.doesNotMatch(text, /tucked/i);
});

test("anchor cap is three", () => {
  assert.equal(MAX_COMPLETE_LOOK_ANCHORS, 3);
});

test("complete the look costs one credit", () => {
  assert.equal(CREDIT_COSTS.complete_look, 1);
});

test("completeLookHasFills rejects a cache that only echoed the anchors", () => {
  assert.equal(completeLookHasFills({ length: 1 }, { length: 1 }), false);
  assert.equal(completeLookHasFills({ length: 4 }, { length: 1 }), true);
});

test("parseCompleteLookProductIds drops empties and keeps string[]", () => {
  assert.deepEqual(
    parseCompleteLookProductIds(["a", "", 1, "a", "b", null]),
    ["a", "b"],
  );
});
