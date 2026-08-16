import assert from "node:assert/strict";
import test from "node:test";
import {
  decomposeLook,
  garmentTitleMatchScore,
  isDrawstringTitle,
  prefersDrawstringSilhouette,
  selectLookGarmentSlots,
  silhouetteFitScore,
} from "./style-extras";

test("decomposeLook extracts tote and pocket square from a resort brief", () => {
  const garments = decomposeLook(
    "Riviera Ease, Sage linen short-sleeve shirt, muted navy linen drawstring trousers, mushroom suede loafers, dove grey canvas tote, soft teal linen pocket square.",
  );
  const keys = garments.map((g) => g.garment);
  assert.ok(keys.includes("shirt"), `missing shirt: ${keys.join(",")}`);
  assert.ok(keys.includes("trousers"), `missing trousers: ${keys.join(",")}`);
  assert.ok(keys.includes("loafers"), `missing loafers: ${keys.join(",")}`);
  assert.ok(keys.includes("tote"), `missing tote: ${keys.join(",")}`);
  assert.ok(keys.includes("pocket square"), `missing pocket square: ${keys.join(",")}`);

  const tote = garments.find((g) => g.garment === "tote");
  assert.equal(tote?.category, "Accessories");
  assert.match(tote?.color ?? "", /grey|gray|dove/);

  const square = garments.find((g) => g.garment === "pocket square");
  assert.equal(square?.category, "Accessories");
  assert.match(square?.color ?? "", /teal/);
});

test("decomposeLook keeps belt and tote as separate accessory slots", () => {
  const garments = decomposeLook(
    "Soft teal linen short-sleeve shirt, greige lightweight cotton chinos, dove grey suede loafers, mushroom linen-blend belt, slate blue canvas tote.",
  );
  const accessories = garments.filter((g) => g.category === "Accessories");
  assert.equal(accessories.length, 2);
  assert.ok(accessories.some((g) => g.garment === "belt"));
  assert.ok(accessories.some((g) => g.garment === "tote"));
});

test("garmentTitleMatchScore recognises tote and pocket square titles", () => {
  assert.equal(garmentTitleMatchScore("tote", "Marks & Spencer Canvas Tote Bag"), 1);
  assert.equal(garmentTitleMatchScore("pocket square", "Pure Silk Pocket Square"), 1);
  assert.equal(garmentTitleMatchScore("neckerchief", "Silk Neckerchief"), 1);
  assert.equal(garmentTitleMatchScore("neck scarf", "Printed Silk Neck Scarf"), 1);
  assert.equal(garmentTitleMatchScore("tote", "Zara Leather Belt"), 0);
  assert.equal(garmentTitleMatchScore("pocket square", "Zara Braided Belt"), 0);
});

test("decomposeLook extracts a neckerchief separately from a winter scarf", () => {
  const garments = decomposeLook(
    "Ivory oxford shirt, stone chinos, brown loafers, sage silk neckerchief.",
  );
  const keys = garments.map((g) => g.garment);
  assert.ok(keys.includes("neckerchief"), `missing neckerchief: ${keys.join(",")}`);
  assert.ok(!keys.includes("scarf"), `winter scarf should not steal the neckerchief: ${keys.join(",")}`);
});

test("decomposeLook extracts tailored linen shorts as a Trousers slot", () => {
  const garments = decomposeLook(
    "Terrace at Dusk, Soft teal linen camp-collar shirt, soft charcoal tailored linen shorts, greige suede loafers.",
  );
  const shorts = garments.find((g) => g.garment === "shorts");
  assert.ok(shorts, `missing shorts: ${garments.map((g) => g.garment).join(",")}`);
  assert.equal(shorts?.category, "Trousers");
  assert.match(shorts?.color ?? "", /charcoal/);
});

test("selectLookGarmentSlots keeps multiple accessories", () => {
  const garments = decomposeLook(
    "Sage linen shirt, navy drawstring trousers, mushroom suede loafers, dove grey canvas tote, soft teal linen pocket square.",
  );
  const slots = selectLookGarmentSlots(garments, 6);
  const accessories = slots.filter((g) => g.category === "Accessories").map((g) => g.garment);
  assert.deepEqual(accessories.sort(), ["pocket square", "tote"].sort());
  assert.equal(slots.filter((g) => g.category === "Shirts").length, 1);
});

test("drawstring clause prefers elasticated titles over suit trousers", () => {
  const clause = "greige linen drawstring trousers";
  assert.equal(prefersDrawstringSilhouette("trousers", clause), true);
  assert.equal(prefersDrawstringSilhouette("shirt", clause), false);
  assert.equal(prefersDrawstringSilhouette("trousers", "greige linen suit trousers"), false);

  assert.equal(isDrawstringTitle("Loose Fit Pure Linen Elasticated Waist Trousers"), true);
  assert.equal(isDrawstringTitle("Linen Suit Trousers"), false);

  const elastic = silhouetteFitScore(clause, "M&S Loose Fit Linen Blend Elasticated Waist Trousers");
  const suit = silhouetteFitScore(clause, "Reserved Linen Suit Trousers");
  const plain = silhouetteFitScore("greige linen trousers", "Reserved Linen Suit Trousers");
  assert.ok(elastic > 0);
  assert.ok(suit < 0);
  assert.equal(plain, 0);
});
