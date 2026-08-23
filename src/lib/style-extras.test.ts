import assert from "node:assert/strict";
import test from "node:test";
import {
  lookGarmentsFromItems,
  lookItemsFromCell,
  resolveLookGarments,
  colorFamilyNeedles,
  colorMatchScore,
  colorShade,
  lookAsksTeal,
  lookAsksPlum,
  lookAsksCharcoal,
  decomposeLook,
  garmentTitleMatchScore,
  leatherToneFamily,
  lookColorCue,
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

test("decomposeLook keeps a messenger bag as its own accessory slot", () => {
  const garments = decomposeLook(
    "Slate blue linen blazer, sage suede loafers, greige leather messenger bag.",
  );
  const bag = garments.find((g) => g.garment.includes("messenger"));
  assert.ok(bag, `missing messenger: ${garments.map((g) => g.garment).join(",")}`);
  assert.equal(bag?.garment, "messenger bag");
  assert.equal(bag?.category, "Accessories");
});

test("decomposeLook reads a knitted tie as a necktie, not knitwear", () => {
  const garments = decomposeLook(
    "Slate blue poplin shirt, soft charcoal worsted trousers, soft teal knitted tie, greige leather briefcase",
  );
  assert.ok(
    garments.some((g) => g.garment === "tie" && g.category === "Accessories"),
    `expected a tie: ${garments.map((g) => `${g.category}:${g.garment}`).join(", ")}`,
  );
  assert.ok(
    !garments.some((g) => g.category === "Knitwear"),
    `knitted tie must not open a Knitwear slot: ${garments.map((g) => g.garment).join(", ")}`,
  );
});

test("garmentTitleMatchScore rejects tea towels for a knit slot", () => {
  assert.equal(
    garmentTitleMatchScore("knit", "Zara Pack Of Waffle-Knit Tea Towels (pack Of 2)"),
    0,
  );
  assert.equal(garmentTitleMatchScore("sweater", "Merino Crewneck Sweater"), 1);
});

test("garmentTitleMatchScore rejects shorts for a trousers slot", () => {
  assert.equal(
    garmentTitleMatchScore("trousers", "Regular Fit Wool Blend Trousers"),
    1,
  );
  assert.equal(
    garmentTitleMatchScore("trousers", "Denim Chino Bermuda Shorts"),
    0,
  );
});

test("garmentTitleMatchScore rejects a travel bag for a messenger slot", () => {
  assert.equal(
    garmentTitleMatchScore("messenger", "Leather Messenger Bag"),
    1,
  );
  assert.equal(
    garmentTitleMatchScore("messenger bag", "Nappa Leather Detail Travel Bag"),
    0,
  );
  assert.equal(garmentTitleMatchScore("tote", "Weekender Holdall"), 0);
  assert.equal(garmentTitleMatchScore("bag", "Cabin Travel Bag"), 0);
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
  assert.equal(
    garmentTitleMatchScore(
      "pocket square",
      "Marks & Spencer 7pk Antibacterial Pure Cotton Handkerchiefs With Sanitized Finish®",
    ),
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

test("colorMatchScore rejects a white hex against teal or sage", () => {
  const tealWhite = colorMatchScore(
    "muted teal",
    "#FFFFFF",
    "Cotton Rich Oxford Shirt",
  );
  const sageWhite = colorMatchScore(
    "sage",
    "#FFFFFF",
    "Cotton Rich Oxford Shirt",
  );
  const oatmealCream = colorMatchScore(
    "oatmeal",
    "cream",
    "Slim Oxford Shirt",
  );
  assert.ok(tealWhite < 0.25, `teal vs white must lose, got ${tealWhite}`);
  assert.ok(sageWhite < 0.25, `sage vs white must lose, got ${sageWhite}`);
  assert.ok(
    oatmealCream > tealWhite,
    "cream may still sit next to oatmeal",
  );
  const tealBlue = colorMatchScore(
    "muted teal",
    "light blue",
    "Reserved Regular Fit Linen Shirt",
  );
  const tealGrey = colorMatchScore(
    "muted teal",
    "grey",
    "Reserved Slim Fit Linen Shirt",
  );
  const tealSage = colorMatchScore(
    "muted teal",
    "sage",
    "Reserved Slim Fit Linen Shirt",
  );
  const tealCream = colorMatchScore(
    "muted teal",
    "cream",
    "Reserved Slim Fit Linen Shirt",
  );
  assert.ok(tealBlue >= 0.45, `muted teal vs light blue must stay, got ${tealBlue}`);
  assert.ok(tealGrey >= 0.45, `muted teal vs grey must stay, got ${tealGrey}`);
  assert.ok(tealBlue > tealSage, "blue must beat sage for a teal shirt");
  assert.ok(tealBlue > tealCream, "blue must beat cream for a teal shirt");
  assert.equal(lookAsksTeal("muted teal linen shirt"), true);
  assert.equal(lookAsksTeal("sage linen shirt"), false);
  const tealSky = colorMatchScore("muted teal", "sky blue", "Linen Shirt", {
    productHex: "#8FB6D6",
  });
  const tealFaded = colorMatchScore(
    "muted teal",
    "Faded sky blue",
    "Linen Shirt",
    { productHex: "#e6e6df" },
  );
  assert.ok(
    tealSky > tealFaded,
    `real sky blue must beat washed-out faded sky (${tealSky} vs ${tealFaded})`,
  );
  assert.equal(colorShade("oatmeal cotton chinos"), "light");
  assert.equal(colorShade("coffee worsted trousers"), "dark");
  assert.equal(colorShade("Light Buff Stretch Chinos"), "light");
  assert.ok(
    colorMatchScore("oatmeal", "beige", "Reserved Chino Slim Fit Trousers") >=
      0.7,
    "oatmeal should land on beige chinos",
  );
  const oatmealCreamShirt = colorMatchScore(
    "oatmeal",
    "cream",
    "ASOS Design Slim Oxford Shirt",
  );
  const oatmealChambray = colorMatchScore(
    "oatmeal",
    "Chambray",
    "Marks & Spencer Cotton Rich Oxford Shirt",
    { productHex: "#8CA3BE" },
  );
  assert.ok(
    oatmealCreamShirt > oatmealChambray,
    `oatmeal shirt must prefer cream over chambray (${oatmealCreamShirt} vs ${oatmealChambray})`,
  );
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
  assert.ok(plumRose < 0.25, `soft plum must not fall to rose, got ${plumRose}`);
  assert.ok(plumNavy >= 0.45, `soft plum falls to navy, got ${plumNavy}`);
  assert.ok(plumNavy > plumRose, "navy must beat rose when plum is missing");
  assert.ok(plumMauve > plumNavy, "same-family purple still beats the navy fallback");

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

test("coffee trousers parse as dark brown, not a missing colour", () => {
  const garments = decomposeLook(
    "Camel poplin shirt, coffee worsted trousers, warm grey leather belt, oatmeal leather messenger bag, warm grey suede derbies",
  );
  const trousers = garments.find((g) => g.garment === "trousers");
  const belt = garments.find((g) => g.garment === "belt");
  assert.equal(trousers?.color, "coffee");
  assert.equal(belt?.color, "warmgrey");
  const coffeeBrown = colorMatchScore("coffee", "brown", "Wool Suit Trousers");
  const coffeeBlack = colorMatchScore("coffee", "black", "Pure Wool Suit Trousers");
  assert.ok(coffeeBrown >= 0.7, `coffee↔brown should be strong, got ${coffeeBrown}`);
  assert.ok(coffeeBlack < 0.3, `coffee must not match black, got ${coffeeBlack}`);
  const needles = colorFamilyNeedles("coffee");
  assert.ok(needles.includes("brown"), `missing brown: ${needles.join(",")}`);
  assert.ok(needles.includes("coffee"), `missing coffee: ${needles.join(",")}`);
  assert.ok(!needles.includes("black"));
  assert.equal(lookColorCue(null, "coffee worsted trousers"), "coffee worsted trousers");
  assert.equal(leatherToneFamily("Black Slim Fit Wool Trousers"), "black");
  assert.equal(leatherToneFamily("Brown leather derby"), "brown");
});

test("messenger titles do not match a crossbody bag", () => {
  assert.equal(
    garmentTitleMatchScore("messenger", "Zara Leather Crossbody Bag"),
    0,
  );
  assert.equal(
    garmentTitleMatchScore("messenger", "Zara Leather Messenger Bag"),
    1,
  );
});

test("colorMatchScore falls plum back to navy, not pastel pink", () => {
  const plumNavy = colorMatchScore("soft plum", "navy", "Navy Blazer");
  const plumSlate = colorMatchScore("soft plum", "slate blue", "Slate Blazer");
  const plumPink = colorMatchScore("soft plum", "pastel pink", "Pink Blazer");
  const plumPinkHex = colorMatchScore("soft plum", "#E1A0A8", "Slim Fit Blazer", {
    productHex: "#E1A0A8",
  });
  const plumNavyHex = colorMatchScore(
    "soft plum",
    "#28324A",
    "Unstructured Blazer",
    { productHex: "#28324A" },
  );
  const plumMauve = colorMatchScore("soft plum", "mauve", "Mauve Blazer");
  assert.ok(plumNavy >= 0.45, `plum↔navy should stay, got ${plumNavy}`);
  assert.ok(plumSlate >= 0.45, `plum↔slate should stay, got ${plumSlate}`);
  assert.ok(plumPink < 0.25, `pastel pink is not a plum stand-in, got ${plumPink}`);
  assert.ok(plumNavy > plumPink, "navy must beat pastel pink for plum");
  assert.ok(
    plumPinkHex < 0.25,
    `hex-only pastel pink is not a plum stand-in, got ${plumPinkHex}`,
  );
  assert.ok(
    plumNavyHex >= 0.45,
    `hex-only navy should stay for plum, got ${plumNavyHex}`,
  );
  assert.ok(plumNavyHex > plumPinkHex, "hex navy must beat hex pink for plum");
  assert.ok(plumMauve > plumNavy, "catalogue purple still beats the navy fallback");
  assert.equal(lookAsksPlum("soft plum unstructured blazer"), true);
  assert.equal(lookAsksPlum("softplum unstructured blazer"), true);
  assert.equal(lookAsksPlum("aubergine knit"), true);
  assert.equal(lookAsksPlum("dusty rose knit"), false);
  assert.equal(lookAsksPlum("mauve blazer"), false);
});

test("colorMatchScore does not treat blue-green as charcoal", () => {
  const grey = colorMatchScore("soft charcoal", "Grey", "Suede Loafers");
  const green = colorMatchScore("soft charcoal", "Blue Green", "Suede Loafers", {
    productHex: "#2F4B7C",
  });
  assert.ok(grey >= 0.3, `charcoal↔grey should stay, got ${grey}`);
  assert.ok(green < 0.2, `blue-green is not charcoal, got ${green}`);
  assert.ok(grey > green, "grey must beat blue-green for charcoal");
  assert.equal(lookAsksCharcoal("soft charcoal suede loafers"), true);
  assert.equal(lookAsksCharcoal("soft teal sneakers"), false);
});

test("colorFamilyNeedles puts charcoal before other greys", () => {
  const needles = colorFamilyNeedles("soft charcoal");
  assert.ok(needles.includes("charcoal"), `missing charcoal: ${needles.join(",")}`);
  assert.ok(
    needles.indexOf("charcoal") < needles.indexOf("dove"),
    `charcoal should be first among greys: ${needles.join(",")}`,
  );
});

test("colorFamilyNeedles pulls navy for a plum cue", () => {
  const needles = colorFamilyNeedles("soft plum");
  assert.ok(needles.includes("plum"), `missing plum: ${needles.join(",")}`);
  assert.ok(needles.includes("navy"), `missing navy fallback: ${needles.join(",")}`);
  assert.ok(needles.includes("blue"), `missing blue fallback: ${needles.join(",")}`);
  assert.ok(!needles.includes("pink"), "pink must not be a plum search needle");
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

test("colorMatchScore falls teal back to blue or grey, not sage", () => {
  const tealBlue = colorMatchScore("teal", "light blue", "Light Blue Shirt");
  const tealGrey = colorMatchScore("teal", "grey", "Grey Shirt");
  const tealSage = colorMatchScore("teal", "sage", "Sage Shirt");
  const tealGreen = colorMatchScore("teal", "green", "Green Shirt");
  assert.ok(tealBlue >= 0.45, `teal↔light blue should stay, got ${tealBlue}`);
  assert.ok(tealGrey >= 0.45, `teal↔grey should stay, got ${tealGrey}`);
  assert.ok(tealBlue > tealSage, `teal must prefer blue over sage, ${tealBlue} vs ${tealSage}`);
  assert.ok(tealBlue > tealGreen, `teal must prefer blue over green, ${tealBlue} vs ${tealGreen}`);

  const mutedBlue = colorMatchScore("muted teal", "light blue", "Light Blue Shirt");
  const mutedNavy = colorMatchScore("muted teal", "navy", "Navy Shirt");
  assert.ok(
    mutedBlue > mutedNavy,
    `muted teal should prefer light blue over navy, ${mutedBlue} vs ${mutedNavy}`,
  );

  const needles = colorFamilyNeedles("teal");
  assert.ok(needles.includes("teal"), `missing teal: ${needles.join(",")}`);
  assert.ok(needles.includes("blue"), `missing blue: ${needles.join(",")}`);
  assert.ok(!needles.includes("sage"), "teal must not pull sage into the pool");
  assert.ok(!needles.includes("olive"), "teal must not pull olive into the pool");
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
  assert.deepEqual(accessories.sort(), ["tote"].sort());
  assert.equal(slots.filter((g) => g.category === "Shirts").length, 1);
});

test("drawstring clause prefers elasticated titles over suit trousers", () => {
  const clause = "greige linen drawstring trousers";
  assert.equal(prefersDrawstringSilhouette("trousers", clause), true);
  assert.equal(prefersDrawstringSilhouette("shirt", clause), false);
  assert.equal(prefersDrawstringSilhouette("trousers", "greige linen suit trousers"), false);

  assert.equal(isDrawstringTitle("Loose Fit Pure Linen Elasticated Waist Trousers"), true);
  assert.equal(isDrawstringTitle("Linen Suit Trousers"), false);
  assert.equal(
    isDrawstringTitle("Linen Trousers", {
      description: "Elasticated waist with drawstring",
    }),
    true,
  );

  const elastic = silhouetteFitScore(clause, "M&S Loose Fit Linen Blend Elasticated Waist Trousers");
  const suit = silhouetteFitScore(clause, "Reserved Linen Suit Trousers");
  const plain = silhouetteFitScore("greige linen trousers", "Reserved Linen Suit Trousers");
  assert.ok(elastic > 0);
  assert.ok(suit < 0);
  assert.equal(plain, 0);
});

test("lookGarmentsFromItems maps structured items via the shared garment vocabulary", () => {
  const garments = lookGarmentsFromItems([
    { garment: "crewneck knit", color: "powder blue" },
    { garment: "chinos", color: "grey-blue" },
    { garment: "loafers", color: "soft denim" },
    { garment: "tote bag", color: null },
  ]);
  assert.deepEqual(
    garments.map((g) => g.category),
    ["Knitwear", "Trousers", "Footwear", "Accessories"],
  );
  // The clause carries the model's colour words for downstream colour matching.
  assert.ok(garments[0]!.clause.includes("powder"));
  assert.ok(garments[1]!.clause.includes("grey"));
});

test("lookGarmentsFromItems: knitted tie is an accessory, not Knitwear", () => {
  const garments = lookGarmentsFromItems([
    { garment: "knitted tie", color: "navy" },
  ]);
  assert.equal(garments.length, 1);
  assert.equal(garments[0]!.category, "Accessories");
});

test("lookGarmentsFromItems drops unknown garments and dedupes; empty stays empty", () => {
  const garments = lookGarmentsFromItems([
    { garment: "vibe", color: "warm" },
    { garment: "chinos", color: "stone" },
    { garment: "chinos", color: "stone" },
  ]);
  assert.equal(garments.length, 1);
  assert.equal(garments[0]!.category, "Trousers");
  assert.deepEqual(lookGarmentsFromItems([]), []);
  assert.deepEqual(lookGarmentsFromItems(undefined), []);
});

test("resolveLookGarments falls back to prose when structured slots are thinner", () => {
  const description =
    "Camel poplin shirt, coffee worsted trousers, oatmeal leather messenger bag, warm grey suede derbies";
  const complete = [
    { garment: "shirt", color: "camel" },
    { garment: "trousers", color: "coffee" },
    { garment: "messenger bag", color: "oatmeal" },
    { garment: "derbies", color: "warm grey" },
  ];
  const fromItems = resolveLookGarments(complete, description);
  assert.equal(fromItems.length, 4);
  assert.ok(fromItems.some((g) => g.garment.includes("derby") || g.category === "Footwear"));

  const missingShoe = complete.slice(0, 3);
  const fallback = resolveLookGarments(missingShoe, description);
  const prose = decomposeLook(description);
  assert.deepEqual(
    fallback.map((g) => g.category),
    prose.map((g) => g.category),
  );
  assert.ok(prose.length > missingShoe.length);

  assert.deepEqual(
    resolveLookGarments(undefined, description).map((g) => g.category),
    prose.map((g) => g.category),
  );
});

test("lookItemsFromCell accepts jsonb slots and ignores garbage", () => {
  assert.deepEqual(
    lookItemsFromCell([
      { garment: "chinos", color: "stone" },
      { garment: 1 },
      null,
    ]),
    [{ garment: "chinos", color: "stone" }],
  );
  assert.equal(lookItemsFromCell(null), null);
  assert.equal(lookItemsFromCell({ garment: "chinos" }), null);
});
