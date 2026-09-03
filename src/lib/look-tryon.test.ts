import assert from "node:assert/strict";
import test from "node:test";
import type { ShoppingItem } from "@/lib/report";
import {
  catalogImageRefsFromItems,
  catalogPromptFromItems,
  catalogTryOnGarmentsText,
  footwearTryOnHint,
  mergeSelectedLookItems,
  pickTryOnGarments,
  selectLookCatalogItems,
  upgradeCatalogImageUrl,
  MAX_CATALOG_REFERENCE_IMAGES,
  MAX_CATALOG_REFERENCE_IMAGES_WITH_PORTRAIT,
  MAX_TRYON_GARMENTS,
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

test("try-on generation accepts six garments and keeps footwear", () => {
  assert.equal(MAX_TRYON_GARMENTS, 6);
  const picked = pickTryOnGarments(
    [
      item({ category: "Outerwear", title: "Moto jacket" }),
      item({ category: "Knitwear", title: "Cashmere jumper" }),
      item({ category: "Trousers", title: "Chinos" }),
      item({ category: "Accessories", title: "Leather belt" }),
      item({ category: "Footwear", title: "Montejunto Boots" }),
      item({ category: "Accessories", title: "Tote" }),
    ],
    MAX_TRYON_GARMENTS,
  );
  assert.equal(picked.length, 6);
  assert.ok(picked.some((g) => g.category === "Footwear"));
});

test("when over the try-on budget, drop a bag before the boots", () => {
  const picked = pickTryOnGarments(
    [
      item({ category: "Shirts", title: "Oxford" }),
      item({ category: "Knitwear", title: "Jumper" }),
      item({ category: "Outerwear", title: "Blazer" }),
      item({ category: "Trousers", title: "Trousers" }),
      item({ category: "Footwear", title: "Montejunto Boots" }),
      item({ category: "Accessories", title: "Belt" }),
      item({ category: "Accessories", title: "Tote" }),
    ],
    MAX_TRYON_GARMENTS,
  );
  assert.equal(picked.length, 6);
  assert.ok(picked.some((g) => g.title === "Montejunto Boots"));
  assert.ok(!picked.some((g) => g.title === "Tote"));
});

test("footwear hint and try-on text lock unnamed boots to the product photo", () => {
  assert.match(footwearTryOnHint("Montejunto Boots"), /product photo/i);
  assert.match(footwearTryOnHint("Montejunto Boots"), /Chelsea/i);
  const text = catalogTryOnGarmentsText([
    { title: "Moto jacket", category: "Outerwear", color: "Brown" },
    { title: "Montejunto Boots", category: "Footwear", color: "Brown" },
  ]);
  assert.match(text, /Montejunto Boots/);
  assert.match(text, /Do not substitute tan or camel suede Chelsea boots/);
});

test("http catalogue image URLs upgrade to https", () => {
  assert.equal(
    upgradeCatalogImageUrl("http://oldmulla.com/boot.jpg"),
    "https://oldmulla.com/boot.jpg",
  );
});

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

test("work catalog prompt tucks the shirt into the trousers", () => {
  const work = catalogPromptFromItems(
    [
      item({ category: "Shirts", title: "Reserved Slim Fit Linen Shirt" }),
      item({ category: "Trousers", title: "Reserved Chino Slim Fit Trousers" }),
    ],
    "Sage linen shirt, warm grey cotton chinos",
    "work",
  );
  assert.match(work ?? "", /tucked into the trousers/);
  const weekend = catalogPromptFromItems(
    [item({ category: "Shirts", title: "Camp-collar shirt" })],
    "Soft teal linen camp-collar shirt",
    "weekend",
  );
  assert.doesNotMatch(weekend ?? "", /tucked into the trousers/);
  const explicitOut = catalogPromptFromItems(
    [item({ category: "Shirts", title: "Linen Shirt" })],
    "Sage linen shirt worn untucked, grey chinos",
    "work",
  );
  assert.doesNotMatch(explicitOut ?? "", /tucked into the trousers/);
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

test("selectLookCatalogItems keeps ticked IDs and does not fill rematched SKUs", () => {
  const blue = item({
    category: "Shirts",
    title: "Reserved Regular Fit Linen Shirt",
    productId: "blue-shirt",
  });
  const beige = item({
    category: "Shirts",
    title: "Reserved Slim Fit Linen Shirt",
    productId: "beige-shirt",
  });
  const wool = item({
    category: "Trousers",
    title: "Aaron Levine Wool Suit Trousers",
    productId: "wool",
  });
  const picked = selectLookCatalogItems([beige, wool], [
    "blue-shirt",
    "buff-chinos",
  ]);
  assert.deepEqual(picked.selected, []);
  assert.deepEqual(picked.missingIds, ["blue-shirt", "buff-chinos"]);
  const hydrated = [
    blue,
    item({
      category: "Trousers",
      title: "Light Buff Stretch Chinos",
      productId: "buff-chinos",
    }),
  ];
  const merged = mergeSelectedLookItems(picked.selected, hydrated);
  assert.equal(merged[0]?.productId, "blue-shirt");
  assert.equal(merged[1]?.productId, "buff-chinos");
  assert.ok(!merged.some((i) => i.productId === "beige-shirt"));
  assert.ok(!merged.some((i) => i.productId === "wool"));
});
