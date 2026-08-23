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

test("catalog prompt drops a pocket square when the look has no jacket", () => {
  const prompt = catalogPromptFromItems(
    [
      item({ category: "Shirts", title: "Poplin Shirt" }),
      item({
        category: "Accessories",
        title: "Marks & Spencer 7pk Antibacterial Pure Cotton Handkerchiefs",
      }),
    ],
    "Soft teal poplin shirt, navy trousers, slate blue linen pocket square",
  );
  assert.match(prompt ?? "", /Poplin Shirt/);
  assert.doesNotMatch(prompt ?? "", /Handkerchiefs/i);
  assert.doesNotMatch(prompt ?? "", /wearing a .*: .*(?:pocket square|Handkerchiefs)/i);
  assert.match(prompt ?? "", /Trouser pockets stay empty/);
});

test("catalog prompt keeps a pocket square in the jacket breast pocket", () => {
  const prompt = catalogPromptFromItems(
    [
      item({ category: "Outerwear", title: "Navy Blazer" }),
      item({ category: "Accessories", title: "Silk Pocket Square" }),
    ],
    "Navy blazer, charcoal trousers, teal silk pocket square",
  );
  assert.match(prompt ?? "", /jacket breast pocket/);
  assert.match(prompt ?? "", /Silk Pocket Square/);
});

test("catalog prompt drops tea towels instead of dressing them as knitwear", () => {
  const prompt = catalogPromptFromItems([
    item({ category: "Shirts", title: "Poplin Shirt" }),
    item({
      category: "Knitwear",
      title: "Zara Pack Of Waffle-Knit Tea Towels (pack Of 2)",
    }),
  ]);
  assert.match(prompt ?? "", /Poplin Shirt/);
  assert.doesNotMatch(prompt ?? "", /Tea Towels/i);
});

test("catalog prompt uses the named colour, not a swatch hex", () => {
  const prompt = catalogPromptFromItems([
    item({
      category: "Shirts",
      title: "Reserved Regular Fit Cotton Shirt",
      color: "#2F4B7C",
      colorName: "pale blue",
    }),
    item({
      category: "Footwear",
      title: "Gentleman Shoe Men's Pink Leather Derby Shoes",
      color: "#E1A0A8",
      colorName: "Pink",
    }),
  ]);
  assert.match(prompt ?? "", /pale blue/);
  assert.match(prompt ?? "", /Pink/);
  assert.doesNotMatch(prompt ?? "", /#2F4B7C/i);
  assert.doesNotMatch(prompt ?? "", /#E1A0A8/i);
  assert.match(prompt ?? "", /shirt colour or shoe finish/i);
});

test("catalog prompt requires every listed garment including the shirt", () => {
  const prompt = catalogPromptFromItems([
    item({ category: "Shirts", title: "Dusty rose shirt" }),
    item({ category: "Trousers", title: "Navy trousers" }),
  ]);
  assert.match(prompt ?? "", /Dusty rose shirt/);
  assert.match(prompt ?? "", /Wear EVERY listed garment/);
});

test("catalog prompt fills missing trousers from the look and forbids shorts", () => {
  const prompt = catalogPromptFromItems(
    [
      item({ category: "Knitwear", title: "Fair Isle Sweater" }),
      item({ category: "Footwear", title: "Leather Brogues" }),
    ],
    "Dusty rose Fair Isle crew-neck jumper, muted navy high-waist pleated wool trousers, greige leather brogues",
  );
  assert.match(prompt ?? "", /muted navy high-waist pleated wool trousers/i);
  assert.match(prompt ?? "", /never shorts/i);
});

test("catalog prompt does not invent trousers when the look named shorts", () => {
  const prompt = catalogPromptFromItems(
    [item({ category: "Shirts", title: "Linen camp-collar shirt" })],
    "Soft teal linen camp-collar shirt, charcoal tailored linen shorts",
  );
  assert.match(prompt ?? "", /charcoal tailored linen shorts/i);
  assert.doesNotMatch(prompt ?? "", /never shorts/i);
});
