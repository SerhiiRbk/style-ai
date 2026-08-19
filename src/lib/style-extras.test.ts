import assert from "node:assert/strict";
import test from "node:test";
import {
  colorFamilyNeedles,
  colorMatchScore,
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
  assert.equal(
    garmentTitleMatchScore("pocket square", "Reserved Tie With Pocket Square"),
    0,
  );
  assert.equal(
    garmentTitleMatchScore("pocket square", "Reserved Baseball Cap With Embroidery"),
    0,
  );
});

test("decomposeLook reads dusty rose as a pink-family colour", () => {
  const garments = decomposeLook(
    "Dusty rose linen camp-collar shirt, muted navy cotton drawstring trousers.",
  );
  const shirt = garments.find((g) => g.garment === "shirt");
  assert.ok(shirt, "expected a shirt");
  assert.match(shirt?.color ?? "", /rose|pink/);
});

test("colorMatchScore treats dusty rose as a neighbour of pink and lavender", () => {
  const roseVsPink = colorMatchScore("dusty rose", "pink", "Pink Linen Shirt");
  const roseVsLavender = colorMatchScore(
    "dusty rose",
    "lavender",
    "Lavender Linen Shirt",
  );
  const roseVsNavy = colorMatchScore("dusty rose", "navy", "Navy Linen Shirt");
  const roseVsRose = colorMatchScore("dusty rose", "rose", "Dusty Rose Shirt");
  assert.ok(roseVsRose >= 0.7, `exact rose should be strong, got ${roseVsRose}`);
  assert.ok(roseVsPink >= 0.5, `pink should be a neighbour, got ${roseVsPink}`);
  assert.ok(
    roseVsLavender >= 0.5,
    `lavender should be a neighbour, got ${roseVsLavender}`,
  );
  assert.ok(roseVsNavy < 0.2, `navy must stay rejected, got ${roseVsNavy}`);
  assert.ok(roseVsPink < roseVsRose, "neighbour must score below exact family");
});

test("colorMatchScore finds neighbours for greige, sage, soft plum and mushroom", () => {
  const greigeBeige = colorMatchScore("greige", "beige", "Beige Linen Trousers");
  const greigeDove = colorMatchScore("greige", "dove", "Dove Grey Trousers");
  const greigeNavy = colorMatchScore("greige", "navy", "Navy Trousers");
  assert.ok(greigeBeige >= 0.7, `greige↔beige should be same circle, got ${greigeBeige}`);
  assert.ok(greigeDove >= 0.5, `greige↔dove grey should be a neighbour, got ${greigeDove}`);
  assert.ok(greigeNavy < 0.2, `greige must not match navy, got ${greigeNavy}`);

  const sageKhaki = colorMatchScore("sage", "khaki", "Khaki Canvas Belt");
  const sageOlive = colorMatchScore("sage", "olive", "Olive Belt");
  const sageNavy = colorMatchScore("sage", "navy", "Navy Belt");
  assert.ok(sageKhaki >= 0.5, `sage↔khaki should be a neighbour, got ${sageKhaki}`);
  assert.ok(sageOlive >= 0.3, `sage↔olive is same family, got ${sageOlive}`);
  assert.ok(sageNavy < 0.2, `sage must not match navy, got ${sageNavy}`);

  const plumMauve = colorMatchScore("soft plum", "mauve", "Mauve Knit");
  const plumLilac = colorMatchScore("soft plum", "lilac", "Lilac Knit");
  const plumRose = colorMatchScore("soft plum", "rose", "Dusty Rose Knit");
  const plumNavy = colorMatchScore("soft plum", "navy", "Navy Knit");
  assert.ok(plumMauve >= 0.5, `soft plum↔mauve, got ${plumMauve}`);
  assert.ok(plumLilac >= 0.5, `soft plum↔lilac, got ${plumLilac}`);
  assert.ok(plumRose >= 0.5, `soft plum↔rose should be a neighbour, got ${plumRose}`);
  assert.ok(plumNavy < 0.2, `soft plum must not match navy, got ${plumNavy}`);

  const mushTaupe = colorMatchScore("mushroom", "taupe", "Taupe Suede Loafers");
  const mushGreige = colorMatchScore("mushroom", "greige", "Greige Suede Loafers");
  const mushCharcoal = colorMatchScore("mushroom", "charcoal", "Charcoal Loafers");
  assert.ok(mushTaupe >= 0.7, `mushroom↔taupe should be same circle, got ${mushTaupe}`);
  assert.ok(mushGreige >= 0.7, `mushroom↔greige should be same circle, got ${mushGreige}`);
  assert.ok(mushCharcoal < 0.35, `mushroom must not jump to charcoal, got ${mushCharcoal}`);
});

test("colorMatchScore rejects nude / beige as a dusty-rose stand-in", () => {
  const nude = colorMatchScore("dusty rose", "nude", "Structural Cotton Jumper", {
    productHex: "#D8C4A0",
  });
  const beige = colorMatchScore("dusty rose", "beige", "Beige Cotton Jumper");
  const pink = colorMatchScore("dusty rose", "dusty pink", "Ribbed Textured Jumper", {
    productHex: "#C99BA0",
  });
  assert.ok(nude < 0.2, `nude is warm beige, not dusty rose, got ${nude}`);
  assert.ok(beige < 0.2, `beige must stay rejected, got ${beige}`);
  assert.ok(pink >= 0.7, `dusty pink should be same family, got ${pink}`);
  assert.ok(pink > nude, "a pink knit must beat a nude jumper");
});

test("colorFamilyNeedles pulls pink-family catalogue words for dusty rose", () => {
  const needles = colorFamilyNeedles("dusty rose");
  assert.ok(needles.includes("pink"), `missing pink: ${needles.join(",")}`);
  assert.ok(needles.includes("rose"), `missing rose: ${needles.join(",")}`);
  assert.ok(needles.includes("blush"), `missing blush: ${needles.join(",")}`);
  assert.ok(!needles.includes("dustyrose"), "fused tokens must not be search needles");
  assert.ok(!needles.includes("beige"));
  assert.ok(!needles.includes("nude"));
});

test("colorMatchScore prefers muted pink hex over hot fuchsia for dusty rose", () => {
  const muted = colorMatchScore("dusty rose", "pink", "Pink Shirt", {
    queryHex: "#C29AA0",
    productHex: "#D4A8B0",
  });
  const hot = colorMatchScore("dusty rose", "pink", "Fuchsia Shirt", {
    queryHex: "#C29AA0",
    productHex: "#D1006E",
  });
  assert.ok(muted > hot, `muted ${muted} should beat hot fuchsia ${hot}`);
  assert.ok(hot < 0.5, `hot fuchsia should not count as close, got ${hot}`);
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
