import assert from "node:assert/strict";
import test from "node:test";
import type { ShoppingItem } from "@/lib/report";
import {
  catalogImageRefsFromItems,
  catalogPromptFromItems,
  MAX_CATALOG_REFERENCE_IMAGES,
  MAX_CATALOG_REFERENCE_IMAGES_WITH_PORTRAIT,
} from "./look-tryon";

function item(
  partial: Pick<ShoppingItem, "category" | "title"> &
    Partial<ShoppingItem>,
): ShoppingItem {
  return {
    why: "",
    priceEur: 0,
    retailer: "Test",
    url: "https://example.com",
    color: "#111111",
    image: `https://cdn.example.com/${partial.title.replace(/\s+/g, "-")}.jpg`,
    ...partial,
  };
}

test("catalog image refs keep all five shop-the-look pieces", () => {
  const refs = catalogImageRefsFromItems([
    item({ category: "Shirts", title: "Dusty rose shirt" }),
    item({ category: "Trousers", title: "Navy trousers" }),
    item({ category: "Footwear", title: "Greige loafers" }),
    item({ category: "Accessories", title: "Sage belt" }),
    item({ category: "Accessories", title: "Greige tote" }),
  ]);
  assert.equal(refs.length, 5);
  assert.equal(refs[0].title, "Dusty rose shirt");
  assert.ok(refs.some((r) => r.title === "Greige tote"));
});

test("when the image budget is exceeded, drop a bag before the shirt", () => {
  assert.ok(MAX_CATALOG_REFERENCE_IMAGES >= 5);
  const extras = Array.from({ length: MAX_CATALOG_REFERENCE_IMAGES }, (_, i) =>
    item({ category: "Accessories", title: `Bag ${i}` }),
  );
  const refs = catalogImageRefsFromItems([
    item({ category: "Shirts", title: "Camp-collar shirt" }),
    item({ category: "Trousers", title: "Linen trousers" }),
    item({ category: "Footwear", title: "Suede loafers" }),
    ...extras,
  ]);
  assert.equal(refs.length, MAX_CATALOG_REFERENCE_IMAGES);
  assert.ok(refs.some((r) => r.title === "Camp-collar shirt"));
  assert.ok(refs.some((r) => r.title === "Linen trousers"));
  assert.ok(refs.some((r) => r.title === "Suede loafers"));
  assert.equal(
    refs.filter((r) => r.category === "Accessories").length,
    MAX_CATALOG_REFERENCE_IMAGES - 3,
  );
});

test("editorial try-on keeps shirt/trousers/shoes and drops extra bags", () => {
  const refs = catalogImageRefsFromItems(
    [
      item({ category: "Shirts", title: "Dusty rose shirt" }),
      item({ category: "Trousers", title: "Navy trousers" }),
      item({ category: "Footwear", title: "Greige loafers" }),
      item({ category: "Accessories", title: "Sage belt" }),
      item({ category: "Accessories", title: "Greige tote" }),
    ],
    { max: MAX_CATALOG_REFERENCE_IMAGES_WITH_PORTRAIT },
  );
  assert.equal(refs.length, 3);
  assert.deepEqual(
    refs.map((r) => r.title),
    ["Dusty rose shirt", "Navy trousers", "Greige loafers"],
  );
});

test("catalog prompt requires every listed garment including the shirt", () => {
  const prompt = catalogPromptFromItems([
    item({ category: "Shirts", title: "Dusty rose shirt" }),
    item({ category: "Trousers", title: "Navy trousers" }),
  ]);
  assert.match(prompt ?? "", /Dusty rose shirt/);
  assert.match(prompt ?? "", /Wear EVERY listed garment/);
});
