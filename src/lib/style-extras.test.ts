import assert from "node:assert/strict";
import test from "node:test";
import {
  lookGarmentsFromItems,
  lookItemsFromCell,
  resolveLookGarments,
  colorFamilyNeedles,
  colorMatchScore,
  bestPaletteFitScore,
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
  capsuleMatrix,
  pickHero,
  isShortsTitle,
  isBottomTitle,
  isClassicShoeWithShorts,
  isWarmLayerWithShorts,
  sanitizeShortsOutfit,
  capsuleColorWord,
  capsuleColumnBlends,
  capsuleOutfitDescription,
  jacketClonesShoes,
  chromaticHeroClash,
  isMidNeutralPiece,
  isDarkAnchorPiece,
  isShoeTitle,
  sanitizeLookHarmony,
  hitsAvoidPalette,
  isWarmYellowNearFace,
  isWarmCreamNearFace,
  isBeltTitle,
  isUnreliableColorBlockKnit,
  FORMAL_CONTEXTS,
  CASUAL_FOOTWEAR_RE,
  wantsPolishedFootwear,
  isHeavyWinterKnit,
  pickShoppingRolePair,
  trousersCloneShoes,
  capsuleImageDirectives,
  isCasualSummerShirtTitle,
  wantsOutdoorJeans,
  capsuleFrom,
  isJeanTitle,
  isLoaferTitle,
  accessoryPicksFor,
  accessoryExtraPicksFor,
  headwearPicksFor,
  headwearExtraPicksFor,
  premiumEyewearPicks,
  beltGuideFor,
  shoeGuideFor,
  shoeGuideCards,
} from "./style-extras";
import { styleProfileSchema } from "./style-profile";
import type { ShoppingItem } from "./report";

function testProfile(
  over: Partial<{
    goals: string[];
    lifestyle: string[];
    boldness: "conservative" | "moderate" | "experimental" | "statement";
    colorSeason: "spring" | "summer" | "autumn" | "winter";
    climate: string;
    faceShape: string;
  }> = {},
) {
  return styleProfileSchema.parse({
    version: "1.0",
    demographics: {
      age: 40,
      genderPresentation: "male",
      climate: over.climate ?? "",
    },
    physical: {
      skinTone: "fair",
      undertone: "cool",
      contrast: "medium",
      faceShape: over.faceShape ?? "oval",
      bodyType: "average",
      heightCm: 180,
    },
    colorSeason: over.colorSeason ?? "summer",
    goals: over.goals ?? ["Look more professional"],
    lifestyle: over.lifestyle ?? ["Public speaking"],
    occupation: "Software / IT",
    boldness: over.boldness ?? "moderate",
    budgetEur: { min: 50, max: 200 },
  });
}

function item(category: string, title: string, color = "#647a93"): ShoppingItem {
  return {
    category,
    title,
    why: "",
    priceEur: 80,
    retailer: "Test",
    url: "https://example.com",
    color,
  };
}

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

test("isShortsTitle matches shorts, not a short-sleeve shirt", () => {
  assert.equal(isShortsTitle("Tailored Linen Blend Shorts"), true);
  assert.equal(isShortsTitle("Denim Chino Bermuda"), true);
  assert.equal(isShortsTitle("Short Sleeve V-Neck Shirt"), false);
  assert.equal(isShortsTitle("Lightweight Summer Trousers"), false);
  assert.equal(isBottomTitle("Short Sleeve V-Neck Tailored Casual Summer Shirt"), false);
  assert.equal(isBottomTitle("Lightweight Summer Trousers"), true);
});

test("capsule matrix never puts shorts under a blazer", () => {
  const shopping = [
    item("Outerwear", "Valmonti Men’s Smart Casual Jacket – Lightweight Slim Blazer"),
    item("Knitwear", "Geometric Colour Block Ribbed Knit High Neck Jumper"),
    item("Shirts", "Textured Summer Shirt Long Sleeve"),
    item("Trousers", "Valmonti Men’s Tailored Summer Shorts Smart Casual Twill Design"),
    item("Trousers", "Valmonti Men’s Tailored Linen Blend Shorts Smart Summer Style"),
    item("Footwear", "Classic Blue Leather Derbies"),
  ];
  const combos = capsuleMatrix(shopping, testProfile());
  assert.ok(combos.length >= 3);
  for (const combo of combos) {
    const hasJacket = combo.pieces.some((p) => /blazer|jacket/i.test(p));
    const hasShorts = combo.pieces.some(isShortsTitle);
    assert.equal(
      hasJacket && hasShorts,
      false,
      `${combo.context}: ${combo.pieces.join(" + ")}`,
    );
  }
  const jacketLooks = combos.filter((c) =>
    c.pieces.some((p) => /blazer|jacket/i.test(p)),
  );
  assert.ok(jacketLooks.length >= 1, "expected at least one jacket look");
  assert.ok(
    jacketLooks.every((c) => c.pieces.some((p) => /chinos?|jeans?/i.test(p))),
    "jacket looks should fall back to full-length assumed bottoms",
  );
});

test("classic shoes and warm layers are illegal with shorts", () => {
  assert.equal(isClassicShoeWithShorts("Classic Blue Leather Derbies"), true);
  assert.equal(isClassicShoeWithShorts("Cap-toe oxfords"), true);
  assert.equal(isClassicShoeWithShorts("Wingtip brogues"), true);
  assert.equal(isClassicShoeWithShorts("Chelsea boots"), true);
  assert.equal(isClassicShoeWithShorts("White leather sneakers"), false);
  assert.equal(isClassicShoeWithShorts("Suede loafers"), false);
  assert.equal(isWarmLayerWithShorts("Navy blazer"), true);
  assert.equal(isWarmLayerWithShorts("Merino crewneck jumper"), true);
  assert.equal(isWarmLayerWithShorts("Zip hoodie"), true);
  assert.equal(isWarmLayerWithShorts("Field jacket"), true);
  assert.equal(isWarmLayerWithShorts("Linen camp collar shirt"), false);
  assert.equal(isWarmLayerWithShorts("Knitted polo"), false);
});

test("capsule matrix may use shorts only on a jacket-free casual look", () => {
  const shopping = [
    item("Shirts", "Linen Camp Collar Shirt"),
    item("Trousers", "Tailored Linen Blend Shorts"),
    item("Footwear", "White leather sneakers"),
  ];
  const combos = capsuleMatrix(
    shopping,
    testProfile({
      goals: ["Casual weekend"],
      lifestyle: ["Active / outdoors"],
    }),
  );
  const withShorts = combos.filter((c) => c.pieces.some(isShortsTitle));
  assert.ok(withShorts.length >= 1, "expected shorts on a casual no-jacket look");
  assert.ok(withShorts.every((c) => !c.pieces.some(isWarmLayerWithShorts)));
  assert.ok(withShorts.every((c) => !c.pieces.some(isClassicShoeWithShorts)));
});

test("sanitizeShortsOutfit drops a jumper and derby from a shorts look", () => {
  const cleaned = sanitizeShortsOutfit(
    [
      "Unstructured navy blazer",
      "Camel merino crewneck jumper",
      "Tailored linen shorts",
      "Brown leather derbies",
    ],
    {
      shirts: ["Linen camp collar shirt"],
      casualShoes: ["White leather sneakers"],
      assumedSneaker: "White leather sneakers",
    },
  );
  assert.ok(cleaned.some(isShortsTitle));
  assert.ok(cleaned.includes("Linen camp collar shirt"));
  assert.ok(cleaned.includes("White leather sneakers"));
  assert.equal(cleaned.some(isWarmLayerWithShorts), false);
  assert.equal(cleaned.some(isClassicShoeWithShorts), false);
});

test("capsule color words distinguish navy trousers from a mid-grey shirt", () => {
  assert.equal(capsuleColorWord("Linen trousers", "#28324A"), "navy");
  assert.equal(capsuleColorWord("Textured shirt", "#8B8B8B"), "mid grey");
  const desc = capsuleOutfitDescription(
    ["Textured Summer Shirt", "Linen Blend Tailored Trousers"],
    new Map([
      ["Textured Summer Shirt", "#8B8B8B"],
      ["Linen Blend Tailored Trousers", "#28324A"],
    ]),
  );
  assert.match(desc, /mid grey shirt/);
  assert.match(desc, /navy trousers/);
});

test("capsule column blends two mid-greys and not grey-on-navy", () => {
  const colors = new Map([
    ["Grey Shirt", "#8B8B8B"],
    ["Grey Trousers", "#9A9A9A"],
    ["Navy Trousers", "#28324A"],
  ]);
  assert.equal(capsuleColumnBlends("Grey Shirt", "Grey Trousers", colors), true);
  assert.equal(capsuleColumnBlends("Grey Shirt", "Navy Trousers", colors), false);
});

test("capsule matrix breaks a grey shirt on grey trousers when a navy bottom exists", () => {
  const shopping = [
    item("Outerwear", "Navy blazer", "#28324A"),
    item("Shirts", "Mid grey oxford", "#8B8B8B"),
    item("Trousers", "Mid grey wool trousers", "#9A9A9A"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Footwear", "Black leather derbies", "#1a1a1a"),
  ];
  const combos = capsuleMatrix(shopping, testProfile());
  const catalog = new Set(shopping.map((s) => s.title));
  for (const combo of combos) {
    const top = combo.pieces.find((p) => /oxford|shirt|knit|jumper/i.test(p));
    const bottom = combo.pieces.find((p) => /trousers|chinos|jeans/i.test(p));
    if (!top || !bottom) continue;
    // Assumed jeans have no swatch — skip them. The failure mode is two
    // catalogue greys (shirt + wool trousers) reading as one column.
    if (!catalog.has(top) || !catalog.has(bottom)) continue;
    const colors = new Map(shopping.map((s) => [s.title, s.color]));
    assert.equal(
      capsuleColumnBlends(top, bottom, colors),
      false,
      `${combo.context}: ${top} + ${bottom}`,
    );
  }
});

test("CASUAL_FOOTWEAR_RE matches plural espadrilles", () => {
  assert.equal(CASUAL_FOOTWEAR_RE.test("Massimo Dutti Leather Espadrilles"), true);
  assert.equal(CASUAL_FOOTWEAR_RE.test("Navy leather derbies"), false);
});

test("isShoeTitle does not treat an oxford shirt as footwear", () => {
  assert.equal(isShoeTitle("Light blue oxford"), false);
  assert.equal(isShoeTitle("Teal loafers"), true);
  assert.equal(isShoeTitle("Cap-toe oxfords"), true);
  assert.equal(isShoeTitle("Brown leather derbies"), true);
  assert.equal(isShoeTitle("Minimal Lace Up Casual Oxford Sneakers"), true);
});

test("jacketClonesShoes catches teal-on-teal and allows a navy suit", () => {
  const colors = new Map([
    ["Teal blazer", "#5f8c86"],
    ["Teal loafers", "#2C6E6A"],
    ["Brown derbies", "#5A3D2B"],
    ["Navy blazer", "#28324A"],
    ["Navy derbies", "#1e2a3a"],
  ]);
  assert.equal(jacketClonesShoes("Teal blazer", "Teal loafers", colors), true);
  assert.equal(jacketClonesShoes("Teal blazer", "Brown derbies", colors), false);
  assert.equal(jacketClonesShoes("Navy blazer", "Navy derbies", colors), false);
});

test("chromaticHeroClash is true for two teals, false for teal plus navy", () => {
  const colors = new Map([
    ["Teal jumper", "#5f8c86"],
    ["Teal trousers", "#3d7a74"],
    ["Navy trousers", "#28324A"],
  ]);
  assert.equal(chromaticHeroClash("Teal jumper", "Teal trousers", colors), true);
  assert.equal(chromaticHeroClash("Teal jumper", "Navy trousers", colors), false);
});

test("mid-neutral pieces need a dark anchor", () => {
  const colors = new Map([
    ["Greige shirt", "#dcd8d3"],
    ["Mushroom trousers", "#b9aea1"],
    ["Navy derbies", "#28324A"],
  ]);
  assert.equal(isMidNeutralPiece("Greige shirt", colors), true);
  assert.equal(isMidNeutralPiece("Mushroom trousers", colors), true);
  assert.equal(isDarkAnchorPiece("Navy derbies", colors), true);
  assert.equal(isDarkAnchorPiece("Greige shirt", colors), false);
});

test("capsule matrix swaps teal loafers off a teal jacket", () => {
  const shopping = [
    item("Outerwear", "Teal blazer", "#5f8c86"),
    item("Shirts", "Light blue oxford", "#c5d4e0"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Footwear", "Teal loafers", "#2C6E6A"),
    item("Footwear", "Brown derbies", "#5A3D2B"),
  ];
  const colors = new Map(shopping.map((s) => [s.title, s.color]));
  const combos = capsuleMatrix(shopping, testProfile());
  for (const combo of combos) {
    const jacket = combo.pieces.find((p) => /blazer|jacket/i.test(p));
    const shoe = combo.pieces.find((p) => /loafer|derby|sneaker|shoe/i.test(p));
    if (!jacket || !shoe) continue;
    assert.equal(
      jacketClonesShoes(jacket, shoe, colors),
      false,
      `${combo.context}: ${combo.pieces.join(" + ")}`,
    );
  }
});

test("sanitizeLookHarmony breaks teal shoes on a teal jacket and a greige column", () => {
  const colors = new Map([
    ["Teal blazer", "#5f8c86"],
    ["Light blue oxford", "#c5d4e0"],
    ["Greige trousers", "#dcd8d3"],
    ["Teal loafers", "#2C6E6A"],
    ["Brown derbies", "#5A3D2B"],
    ["Navy trousers", "#28324A"],
  ]);
  const matchy = sanitizeLookHarmony(
    ["Teal blazer", "Light blue oxford", "Greige trousers", "Teal loafers"],
    colors,
    { shoes: ["Brown derbies"], assumedDarkShoe: "Brown derbies" },
  );
  assert.equal(jacketClonesShoes("Teal blazer", matchy.find((p) => /derby|loafer/i.test(p)) ?? "", colors), false);

  const flat = sanitizeLookHarmony(
    ["Greige shirt", "Mushroom trousers", "Greige loafers"],
    new Map([
      ["Greige shirt", "#dcd8d3"],
      ["Mushroom trousers", "#b9aea1"],
      ["Greige loafers", "#cfc6b8"],
      ["Navy derbies", "#28324A"],
    ]),
    { shoes: ["Navy derbies"], assumedDarkShoe: "Navy derbies" },
  );
  assert.ok(flat.some((p) => isDarkAnchorPiece(p, new Map([
    ["Greige shirt", "#dcd8d3"],
    ["Mushroom trousers", "#b9aea1"],
    ["Greige loafers", "#cfc6b8"],
    ["Navy derbies", "#28324A"],
  ]))));
});

const SUMMER_AVOID = [
  { name: "Pure Black", hex: "#000000" },
  { name: "Bright Orange", hex: "#FF6B35" },
  { name: "Golden Yellow", hex: "#F4C430" },
  { name: "Rust", hex: "#B7410E" },
];

test("hitsAvoidPalette catches golden yellow knits, not navy", () => {
  assert.equal(
    hitsAvoidPalette("Geometric ribbed jumper", "#E8C84A", SUMMER_AVOID),
    true,
  );
  assert.equal(
    hitsAvoidPalette("Mustard colour-block knit", "#C9A84A", SUMMER_AVOID),
    true,
  );
  assert.equal(
    hitsAvoidPalette("Navy merino crewneck", "#28324A", SUMMER_AVOID),
    false,
  );
  assert.equal(
    hitsAvoidPalette("Charcoal roll-neck", "#3A4048", SUMMER_AVOID),
    false,
  );
});

test("hitsAvoidPalette catches a light-green shirt when yellow is avoided", () => {
  assert.equal(
    hitsAvoidPalette(
      "Lightweight Summer Shirt Light Green",
      "#9AA588",
      SUMMER_AVOID,
    ),
    true,
  );
  assert.equal(
    hitsAvoidPalette("Sage linen shirt Sage Green", "#9AA588", SUMMER_AVOID),
    false,
  );
});

test("chromaticHeroClash catches a sage jacket on sage trousers", () => {
  const colors = new Map([
    ["Sage blazer", "#9AA588"],
    ["Sage drawstring trousers", "#9AA588"],
    ["Navy trousers", "#28324A"],
  ]);
  assert.equal(
    chromaticHeroClash("Sage blazer", "Sage drawstring trousers", colors),
    true,
  );
  assert.equal(chromaticHeroClash("Sage blazer", "Navy trousers", colors), false);
});

test("smart casual keeps chinos and does not clone on stage", () => {
  const shopping = [
    item("Outerwear", "Navy tailored suit jacket", "#28324A"),
    item("Outerwear", "Light grey shacket", "#C3C3C3"),
    item("Trousers", "Dark navy suit trousers", "#28324A"),
    item("Trousers", "Light grey slim chinos", "#C3C3C3"),
    item("Shirts", "White oxford shirt", "#FFFFFF"),
    item("Shirts", "Cream oxford shirt", "#F3EAD3"),
    item("Knitwear", "Light gray merino crewneck", "#C3C3C3"),
    item("Footwear", "Grey suede loafers", "#8B8B8B"),
    item("Footwear", "Black leather oxfords", "#1a1a1a"),
    item("Footwear", "Grey leather sneakers", "#8B8B8B"),
  ];
  const combos = capsuleMatrix(
    shopping,
    testProfile({
      goals: ["Dating & social", "Look modern but natural"],
      lifestyle: ["Public speaking", "Creator / blog"],
      boldness: "experimental",
    }),
  );
  const onStage = combos.find((c) => c.context === "On stage");
  const smart = combos.find((c) => c.context === "Smart casual");
  const dump = combos.map((c) => `${c.context}: ${c.pieces.join(" + ")}`).join(" | ");
  assert.ok(onStage && smart, `missing looks: ${dump}`);
  assert.ok(
    smart!.pieces.some((p) => /chino/i.test(p)),
    `Smart casual lost its chinos: ${dump}`,
  );
  assert.ok(
    !onStage!.pieces.some((p) => /chino/i.test(p)),
    `On stage should stay on dress trousers: ${dump}`,
  );
  assert.notEqual(
    onStage!.pieces.filter((p) => !isShoeTitle(p)).join("|").toLowerCase(),
    smart!.pieces.filter((p) => !isShoeTitle(p)).join("|").toLowerCase(),
    `On stage cloned Smart casual: ${dump}`,
  );
});

test("smart casual does not put dress oxfords on chinos when loafers exist", () => {
  const shopping = [
    item("Outerwear", "Navy tailored suit jacket", "#28324A"),
    item("Trousers", "Dark navy suit trousers", "#28324A"),
    item("Trousers", "Light grey slim chinos", "#AEB3B6"),
    item("Shirts", "White oxford shirt", "#FFFFFF"),
    item("Shirts", "Dove grey oxford shirt", "#AEB3B6"),
    item("Knitwear", "Light gray merino crewneck", "#C3C3C3"),
    item("Footwear", "Grey suede loafers", "#8B8B8B"),
    item("Footwear", "Black leather oxfords", "#1a1a1a"),
    item("Footwear", "Grey leather sneakers", "#8B8B8B"),
    item("Accessories", "Black leather belt", "#111111"),
  ];
  const combos = capsuleMatrix(
    shopping,
    testProfile({
      goals: ["Dating & social", "Look modern but natural"],
      lifestyle: ["Public speaking", "Creator / blog"],
      boldness: "experimental",
    }),
  );
  const smart = combos.find((c) => c.context === "Smart casual");
  const dump = combos.map((c) => `${c.context}: ${c.pieces.join(" + ")}`).join(" | ");
  assert.ok(smart, `missing Smart casual: ${dump}`);
  assert.ok(
    smart!.pieces.some((p) => /chino/i.test(p)),
    `Smart casual lost chinos: ${dump}`,
  );
  assert.ok(
    smart!.pieces.some((p) => /loafer/i.test(p)),
    `Smart casual should wear loafers, not a half-suit derby: ${dump}`,
  );
  assert.equal(
    smart!.pieces.some((p) => /oxfords?|derb/i.test(p) && isShoeTitle(p)),
    false,
    `dress shoes on chinos: ${dump}`,
  );
  assert.ok(
    smart!.pieces.some(isBeltTitle),
    `Smart casual should wear the belt: ${dump}`,
  );
  assert.equal(
    smart!.pieces.some(
      (p) => /shirt|oxford/i.test(p) && isWarmCreamNearFace(p),
    ),
    false,
    `cream shirt on Smart casual: ${dump}`,
  );
});

test("capsule matrix keeps dinner distinct when only one navy suit exists", () => {
  const shopping = [
    item("Outerwear", "Navy tailored suit jacket", "#2C3A55"),
    item("Outerwear", "Light grey shacket", "#C3C3C3"),
    item("Trousers", "Dark navy suit trousers", "#28324A"),
    item("Trousers", "Light grey slim chinos", "#AEB3B6"),
    item("Shirts", "White oxford shirt", "#F5F5F5"),
    item("Shirts", "Cream oxford shirt", "#E8DCC8"),
    item("Knitwear", "Light gray merino crewneck", "#B8B8B8"),
    item("Footwear", "Greyish blue tassel loafers", "#6B7C8A"),
    item("Footwear", "Grey suede loafers", "#8B8B8B"),
    item("Footwear", "Grey leather sneakers", "#8B8B8B"),
  ];
  const combos = capsuleMatrix(
    shopping,
    testProfile({
      goals: ["Look more professional", "Dating / social"],
      lifestyle: ["Office & remote", "Public speaking"],
      boldness: "experimental",
    }),
  );
  const contexts = combos.map((c) => c.context);
  assert.ok(
    combos.length >= 5,
    `collapsed to ${combos.length}: ${contexts.join(", ")}`,
  );
  const dinner = combos.find((c) => c.context === "Dinner");
  const client = combos.find((c) => c.context === "Client meeting");
  const boardroom = combos.find((c) => c.context === "Boardroom");
  assert.ok(dinner, `missing Dinner: ${contexts.join(", ")}`);
  assert.ok(client, `missing Client meeting: ${contexts.join(", ")}`);
  assert.ok(boardroom, `missing Boardroom: ${contexts.join(", ")}`);
  assert.notEqual(
    dinner!.pieces.join("|").toLowerCase(),
    client!.pieces.join("|").toLowerCase(),
    `Dinner cloned Client: ${dinner!.pieces.join(" + ")}`,
  );
  assert.notEqual(
    client!.pieces.join("|").toLowerCase(),
    boardroom!.pieces.join("|").toLowerCase(),
    `Client cloned Boardroom: ${client!.pieces.join(" + ")}`,
  );
  assert.ok(
    dinner!.pieces.some((p) => /merino|crewneck|knit/i.test(p)),
    `Dinner should wear the knit: ${dinner!.pieces.join(" + ")}`,
  );
  assert.ok(
    client!.pieces.some((p) => /oxford|shirt/i.test(p)),
    `Client should wear a shirt: ${client!.pieces.join(" + ")}`,
  );
  assert.ok(
    client!.pieces.some((p) => /derb/i.test(p)),
    `Client should wear derbies, not a second loafer: ${client!.pieces.join(" + ")}`,
  );
});

test("capsule matrix does not make a sage drawstring dinner suit", () => {
  const shopping = [
    item("Outerwear", "Sage blazer", "#9AA588"),
    item("Shirts", "Grey oxford", "#8B8B8B"),
    item("Trousers", "Sage drawstring trousers", "#9AA588"),
    item("Trousers", "Sage wide-leg drawstring trousers", "#9AA588"),
    item("Footwear", "Charcoal derbies", "#4C4C4C"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const dinner = combos.find((c) => c.context === "Dinner");
  assert.ok(dinner, `contexts: ${combos.map((c) => c.context).join(", ")}`);
  assert.ok(
    !dinner!.pieces.some((p) => /drawstring/i.test(p)),
    `dinner was ${dinner!.pieces.join(" + ")}`,
  );
  assert.ok(
    dinner!.pieces.some((p) => /chinos|navy trousers/i.test(p)),
    `dinner was ${dinner!.pieces.join(" + ")}`,
  );
});

test("hitsAvoidPalette catches olive trousers that render as mustard", () => {
  assert.equal(
    hitsAvoidPalette(
      "Double Pleat Straight Leg Trousers Olive Green",
      "#6B6B47",
      SUMMER_AVOID,
    ),
    true,
  );
  assert.equal(
    hitsAvoidPalette("Double Pleat Straight Leg Trousers", "#6B6B47", SUMMER_AVOID),
    true,
  );
  assert.equal(
    hitsAvoidPalette("Sage linen shirt", "#9AA588", SUMMER_AVOID),
    false,
  );
});

test("colour-block knits without a palette colour word are unreliable near the face", () => {
  assert.equal(
    isUnreliableColorBlockKnit(
      "Valmonti Men’s Geometric Colour Block Ribbed Knit High Neck Jumper",
    ),
    true,
  );
  assert.equal(
    isUnreliableColorBlockKnit("Navy geometric colour-block crewneck"),
    false,
  );
  assert.equal(isUnreliableColorBlockKnit("Slate merino crewneck"), false);
});

test("warm cream near the face catches a maize oxford, not a white one", () => {
  assert.equal(
    isWarmCreamNearFace("ASOS Design Slim Oxford Shirt Cream", "#F3EAD3"),
    true,
  );
  assert.equal(isWarmCreamNearFace("COS Oxford Button-Down Shirt", "#FFFFFF"), false);
  assert.equal(isWarmCreamNearFace("Dove grey oxford", "#AEB3B6"), false);
  assert.equal(isWarmYellowNearFace("ASOS Design Slim Oxford Shirt Cream", "#F3EAD3"), false);
});

test("warm yellow near the face is illegal even when the title says beige", () => {
  assert.equal(isWarmYellowNearFace("Beige geometric jumper", "#E6C84A"), true);
  assert.equal(isWarmYellowNearFace("Mustard high neck jumper"), true);
  assert.equal(isWarmYellowNearFace("Slate merino crewneck", "#54606E"), false);
  assert.equal(isWarmYellowNearFace("Oatmeal knit", "#E4D8C2"), false);
});

function varietyProfile() {
  return testProfile({
    goals: ["Look more professional", "Dating / social"],
    lifestyle: ["Old money", "Public speaking", "Active / outdoors"],
  });
}

test("capsule matrix rotates two bottoms and keeps dinner off cream trousers", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Outerwear", "Navy technical windbreaker", "#28324A"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Shirts", "Charcoal textured shirt", "#8B8B8B"),
    item("Trousers", "Cream lightweight summer trousers", "#F5F0E6"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const creamLooks = combos.filter((c) =>
    c.pieces.some((p) => /cream|lightweight summer/i.test(p)),
  );
  const navyLooks = combos.filter((c) =>
    c.pieces.some((p) => /navy linen/i.test(p)),
  );
  assert.ok(creamLooks.length <= 2, `cream trousers in ${creamLooks.length} looks`);
  assert.ok(navyLooks.length >= 2, `navy linen only in ${navyLooks.length} looks`);
  const dinner = combos.find((c) => c.context === "Dinner");
  assert.ok(dinner, "expected a Dinner look");
  assert.ok(
    dinner!.pieces.some((p) => /navy linen/i.test(p)),
    `Dinner should wear the dark trousers: ${dinner!.pieces.join(" + ")}`,
  );
  const onStage = combos.find((c) => c.context === "On stage");
  if (onStage) {
    assert.ok(
      onStage.pieces.some((p) => /navy linen/i.test(p)),
      `On stage should wear the dark trousers: ${onStage.pieces.join(" + ")}`,
    );
  }
});

test("capsule matrix does not put dress shoes on every look when sneakers exist", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Cream summer trousers", "#F5F0E6"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const derbyLooks = combos.filter((c) =>
    c.pieces.some((p) => /derb/i.test(p)),
  );
  const sneakerLooks = combos.filter((c) =>
    c.pieces.some((p) => /sneaker/i.test(p)),
  );
  assert.ok(sneakerLooks.length >= 2, `sneakers only in ${sneakerLooks.length} looks`);
  assert.ok(
    derbyLooks.length <= combos.length - 2,
    `derbies in ${derbyLooks.length}/${combos.length} looks`,
  );
});

test("formal looks keep dress shoes when the same derby is already used twice", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Cream summer trousers", "#F5F0E6"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const formal = combos.filter((c) => FORMAL_CONTEXTS.has(c.context));
  assert.ok(
    formal.length >= 1,
    `expected a formal look, got ${combos.map((c) => c.context).join(", ")}`,
  );
  for (const look of formal) {
    assert.ok(
      look.pieces.some((p) => /derb/i.test(p)),
      `${look.context} should keep dress shoes: ${look.pieces.join(" + ")}`,
    );
    assert.ok(
      !look.pieces.some((p) => /sneaker/i.test(p)),
      `${look.context} must not fall back to sneakers: ${look.pieces.join(" + ")}`,
    );
  }
});

test("pickHero prefers a tailored jacket over a technical windbreaker", () => {
  const shopping = [
    item("Outerwear", "Navy technical windbreaker", "#28324A"),
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
  ];
  shopping[0]!.priceEur = 229;
  shopping[1]!.priceEur = 59;
  const hero = pickHero(shopping, "experimental");
  assert.ok(hero, "expected a hero");
  assert.match(hero!.title, /tweed/i);
});

test("capsule matrix uses the same knit in at most two looks", () => {
  const shopping = [
    item("Outerwear", "Navy blazer", "#28324A"),
    item("Knitwear", "Geometric Colour Block Ribbed Knit High Neck Jumper", "#E8C84A"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Footwear", "Black leather derbies", "#1a1a1a"),
  ];
  const combos = capsuleMatrix(
    shopping,
    testProfile({
      goals: ["Look more professional"],
      lifestyle: ["Public speaking", "Active / outdoors"],
    }),
  );
  const knitLooks = combos.filter((c) =>
    c.pieces.some((p) => /geometric colour block/i.test(p)),
  );
  assert.ok(combos.length >= 4, `expected a full capsule, got ${combos.length}`);
  assert.ok(
    knitLooks.length <= 2,
    `same knit in ${knitLooks.length} looks: ${knitLooks.map((c) => c.context).join(", ")}`,
  );
  assert.ok(
    combos.some((c) => c.pieces.some((p) => /oxford|shirt/i.test(p))),
    "later knit slots should fall back to a shirt",
  );
});

test("capsule matrix uses a cool knit from shopping instead of going shirt-only", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Knitwear", "Slate merino crewneck", "#54606E"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  assert.ok(
    combos.some((c) => c.pieces.some((p) => /slate merino/i.test(p))),
    `expected the cool knit in a look: ${combos.map((c) => `${c.context}: ${c.pieces.join(" + ")}`).join(" | ")}`,
  );
});

test("wantsPolishedFootwear is true for professional or speaking briefs", () => {
  assert.equal(
    wantsPolishedFootwear(
      testProfile({
        goals: ["Look more professional"],
        lifestyle: ["Public speaking"],
      }),
    ),
    true,
  );
  assert.equal(
    wantsPolishedFootwear(
      testProfile({
        goals: ["Casual weekend"],
        lifestyle: ["Active / outdoors"],
      }),
    ),
    false,
  );
});

test("isHeavyWinterKnit catches elbow-patch winter jumpers, not a merino crew", () => {
  assert.equal(
    isHeavyWinterKnit(
      "Warm Crew-Neck Jumper With Elbow Patches – Relaxed Winter Knit",
    ),
    true,
  );
  assert.equal(isHeavyWinterKnit("Slate merino crewneck"), false);
  assert.equal(isHeavyWinterKnit("Navy cashmere crew neck sweater"), false);
});

test("pickShoppingRolePair takes dress plus sneakers and drops sandals when polished", () => {
  const picked = pickShoppingRolePair(
    "Footwear",
    [
      { title: "Colorblock Platform Sandals", color: "#C3C3C3" },
      { title: "Navy leather derbies", color: "#28324A" },
      { title: "White leather sneakers", color: "#F5F5F5" },
    ],
    { polishedFootwear: true },
  );
  assert.ok(picked.some((p) => /derb/i.test(p.title)));
  assert.ok(picked.some((p) => /sneaker/i.test(p.title)));
  assert.ok(!picked.some((p) => /sandal/i.test(p.title)));
});

test("pickShoppingRolePair takes derby, loafer and sneaker when all three exist", () => {
  const picked = pickShoppingRolePair(
    "Footwear",
    [
      { title: "Navy leather derbies", color: "#28324A" },
      { title: "Taupe suede loafers", color: "#8B7355" },
      { title: "White leather sneakers", color: "#F5F5F5" },
      { title: "Colorblock Platform Sandals", color: "#C3C3C3" },
    ],
    { polishedFootwear: true },
  );
  assert.equal(isLoaferTitle("Taupe suede loafers"), true);
  assert.ok(picked.some((p) => /derb/i.test(p.title)));
  assert.ok(picked.some((p) => /loafer/i.test(p.title)));
  assert.ok(picked.some((p) => /sneaker/i.test(p.title)));
  assert.equal(picked.length, 3);
});

test("capsule matrix does not wear the same shoe on more than two looks when three pairs exist", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Outerwear", "Navy technical windbreaker", "#28324A"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Blue-grey jeans", "#6B7C8A"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
    item("Footwear", "Taupe suede loafers", "#8B7355"),
    item("Footwear", "White leather sneakers", "#FFFFFF"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const counts = new Map<string, number>();
  for (const look of combos) {
    for (const p of look.pieces) {
      if (!isShoeTitle(p)) continue;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
  }
  for (const [title, n] of counts) {
    assert.ok(
      n <= 2,
      `${title} in ${n} looks: ${combos
        .filter((c) => c.pieces.includes(title))
        .map((c) => c.context)
        .join(", ")}`,
    );
  }
  assert.ok(
    combos.some((c) => c.pieces.some((p) => /loafer/i.test(p))),
    `expected loafers in the capsule: ${combos.map((c) => `${c.context}: ${c.pieces.join(" + ")}`).join(" | ")}`,
  );
});

test("capsule matrix assigns derbies, loafers and sneakers to the matching contexts", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Outerwear", "Navy technical windbreaker", "#28324A"),
    item("Knitwear", "Slate merino crewneck", "#54606E"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Shirts", "Charcoal poplin shirt", "#8B8B8B"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Blue-grey jeans", "#6B7C8A"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
    item("Footwear", "Taupe suede loafers", "#8B7355"),
    item("Footwear", "White leather sneakers", "#FFFFFF"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const shoeOf = (ctx: string) =>
    combos.find((c) => c.context === ctx)?.pieces.find(isShoeTitle) ?? "";
  const dump = () =>
    combos.map((c) => `${c.context} [${c.pieces.join(" + ")}]`).join(" | ");
  const expectShoe = (ctx: string, re: RegExp) => {
    const look = combos.find((c) => c.context === ctx);
    if (!look) return;
    assert.match(shoeOf(ctx), re, dump());
  };
  expectShoe("Dinner", /derb/i);
  expectShoe("Client meeting", /derb/i);
  expectShoe("Smart casual", /loafer/i);
  expectShoe("On stage", /loafer/i);
  expectShoe("Country weekend", /sneaker/i);
  expectShoe("Outdoors", /sneaker/i);
  assert.ok(combos.some((c) => c.pieces.some((p) => /derb/i.test(p))), dump());
  assert.ok(combos.some((c) => c.pieces.some((p) => /loafer/i.test(p))), dump());
  assert.ok(combos.some((c) => c.pieces.some((p) => /sneaker/i.test(p))), dump());
});

test("summer professional finishing does not lead with a wool scarf", () => {
  const profile = varietyProfile();
  const picks = accessoryPicksFor(
    testProfile({
      goals: profile.goals,
      lifestyle: profile.lifestyle,
      colorSeason: "summer",
      climate: "temperate",
      boldness: "experimental",
    }),
  );
  assert.ok(picks.some((p) => p.kind === "tie"), `expected a tie: ${picks.map((p) => p.name).join(", ")}`);
  assert.ok(
    !picks.some((p) => /wool/i.test(p.name)),
    `wool scarf on a summer brief: ${picks.map((p) => p.name).join(", ")}`,
  );
  assert.ok(
    picks.filter((p) => p.kind === "scarf").length <= 1,
    `too many scarves: ${picks.map((p) => p.name).join(", ")}`,
  );
});

test("old-money extras do not add a second scarf or a bandana", () => {
  const profile = testProfile({
    goals: ["Look more professional"],
    lifestyle: ["Old money", "Public speaking"],
    colorSeason: "summer",
    climate: "temperate",
  });
  const extras = accessoryExtraPicksFor(profile);
  assert.ok(
    !extras.some((p) => p.kind === "scarf"),
    `extra scarf: ${extras.map((p) => p.name).join(", ")}`,
  );
  const hats = [...headwearPicksFor(profile), ...headwearExtraPicksFor(profile)];
  assert.ok(
    !hats.some((h) => /bandana/i.test(h.name) || h.kind === "bandana"),
    `bandana leaked: ${hats.map((h) => h.name).join(", ")}`,
  );
  assert.ok(
    hats.some((h) => /flat cap/i.test(h.name)),
    `expected a flat cap: ${hats.map((h) => h.name).join(", ")}`,
  );
  assert.ok(
    !hats.some((h) => /beanie/i.test(h.name)),
    `beanie on a summer brief: ${hats.map((h) => h.name).join(", ")}`,
  );
});

test("premium eyewear does not clone optical shapes as sunglasses", () => {
  const picks = premiumEyewearPicks(
    testProfile({ faceShape: "square", lifestyle: ["Old money"] }),
  );
  const optical = picks.filter((p) => p.kind === "optical").map((p) => p.shape);
  const sun = picks.filter((p) => p.kind === "sun").map((p) => p.shape);
  assert.ok(sun.some((s) => !optical.includes(s)), `sun clones optical: ${[...optical, ...sun].join(", ")}`);
});

test("pickShoppingRolePair takes a belt and a bag, not sunglasses, when polished", () => {
  const picked = pickShoppingRolePair(
    "Accessories",
    [
      { title: "Reserved Sunglasses" },
      { title: "Reserved Linen-Blend Tie" },
      { title: "Leather belt" },
      { title: "Leather messenger bag" },
    ],
    { polishedFootwear: true },
  );
  assert.ok(picked.some((p) => /belt/i.test(p.title)));
  assert.ok(picked.some((p) => /messenger|briefcase|bag/i.test(p.title)));
  assert.ok(!picked.some((p) => /sunglass/i.test(p.title)));
});

const SHOE_GUIDE_BEST: { name: string; hex: string; why: string }[] = [
  { name: "Dove grey", hex: "#AEB3B6", why: "" },
  { name: "Muted navy", hex: "#3E4C63", why: "" },
  { name: "Soft white", hex: "#F5F5F5", why: "" },
];

test("shoe guide cards match the footwear system, not stock cream sneakers", () => {
  const guide = shoeGuideFor(
    testProfile({
      goals: ["Dating & social", "Look modern but natural"],
      lifestyle: ["Public speaking", "Creator / blog"],
      boldness: "experimental",
    }),
    SHOE_GUIDE_BEST,
    [{ name: "Golden Yellow", hex: "#E8B84A", why: "" }],
  );
  const cards = shoeGuideCards(guide);
  assert.equal(cards.length, guide.variants.length);
  for (const [i, v] of guide.variants.entries()) {
    assert.equal(cards[i]!.name, `${v.color} ${v.style}`);
    assert.equal(cards[i]!.colorHex, v.colorHex);
  }
  const dump = cards.map((c) => c.name).join(" | ");
  assert.equal(
    cards.some((c) => /chelsea/i.test(c.name)),
    false,
    `chelsea slipped in for a non-active client: ${dump}`,
  );
  assert.equal(
    cards.some((c) => /^Cream sneakers$/i.test(c.name)),
    false,
    dump,
  );
});

test("shoe guide cards attach shopping photos to the matching system role", () => {
  const guide = shoeGuideFor(testProfile(), SHOE_GUIDE_BEST, []);
  const derby = item("Footwear", "Black leather derbies", "#111111");
  derby.image = "/derbies.jpg";
  const loafer = item("Footwear", "Grey suede loafers", "#8B8B8B");
  loafer.image = "/loafers.jpg";
  const sneaker = item("Footwear", "Grey leather sneakers", "#8B8B8B");
  sneaker.image = "/sneakers.jpg";
  const cards = shoeGuideCards(guide, [derby, loafer, sneaker]);
  const dress = cards.find((c) => /derb|oxford/i.test(c.name));
  const everyday = cards.find((c) => /trainer|sneaker/i.test(c.name));
  assert.equal(dress?.image, "/derbies.jpg");
  assert.ok(
    cards.some((c) => c.image === "/loafers.jpg"),
    `loafer photo not attached: ${cards.map((c) => `${c.name}=${c.image ?? "-"}`).join(" | ")}`,
  );
  assert.equal(everyday?.image, "/sneakers.jpg");
});

test("beltGuideFor matches a navy dress shoe from shopping", () => {
  const guide = beltGuideFor(
    varietyProfile(),
    [{ name: "Navy grey", hex: "#283039", why: "" }],
    [],
    [item("Footwear", "Navy leather derbies", "#1e2a3a")],
  );
  const formal = guide.variants.find((v) => /business|formal/i.test(v.context));
  assert.ok(formal, "expected a formal belt");
  assert.ok(
    !/burgundy/i.test(formal!.strap),
    `formal belt still burgundy against navy shoes: ${formal!.strap}`,
  );
  assert.match(formal!.strap, /navy|slate|charcoal|blue/i);
});

test("pickShoppingRolePair pairs a tailored jacket with casual outerwear", () => {
  const picked = pickShoppingRolePair("Outerwear", [
    { title: "Navy technical windbreaker", color: "#CCCCCC" },
    { title: "Grey tweed jacket", color: "#8B8B8B" },
    { title: "Black hoodie", color: "#1a1a1a" },
  ]);
  assert.ok(picked.some((p) => /tweed/i.test(p.title)));
  assert.ok(picked.some((p) => /windbreaker/i.test(p.title)));
  assert.equal(picked.length, 2);
});

test("pickShoppingRolePair takes one dark and one light trouser", () => {
  const picked = pickShoppingRolePair("Trousers", [
    { title: "Cream lightweight summer trousers", color: "#F5F0E6" },
    { title: "Ivory holiday trousers", color: "#FFFFF0" },
    { title: "Navy linen trousers", color: "#28324A" },
  ]);
  assert.ok(picked.some((p) => /navy/i.test(p.title)));
  assert.ok(picked.some((p) => /cream|ivory/i.test(p.title)));
  assert.equal(picked.length, 2);
});

test("pickShoppingRolePair prefers a fine knit over a winter elbow-patch jumper", () => {
  const picked = pickShoppingRolePair("Knitwear", [
    { title: "Warm Crew-Neck Jumper With Elbow Patches Winter Knit", color: "#8B8B8B" },
    { title: "Slate merino crewneck", color: "#54606E" },
    { title: "Navy cashmere crew neck sweater", color: "#28324A" },
  ]);
  assert.ok(picked.every((p) => !/elbow/i.test(p.title)));
  assert.ok(picked.some((p) => /merino|cashmere/i.test(p.title)));
});

test("capsule matrix uses the same tailored jacket in at most two looks", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Outerwear", "Navy technical windbreaker", "#28324A"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Cream summer trousers", "#F5F0E6"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const tweedLooks = combos.filter((c) =>
    c.pieces.some((p) => /tweed/i.test(p)),
  );
  assert.ok(
    tweedLooks.length <= 2,
    `tweed in ${tweedLooks.length} looks: ${tweedLooks.map((c) => c.context).join(", ")}`,
  );
});

test("country weekend and outdoors do not share the same trousers and shoes", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Outerwear", "Navy technical windbreaker", "#CCCCCC"),
    item("Knitwear", "Navy cashmere crew neck", "#28324A"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Cream summer trousers", "#FFFFFF"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Blue-grey jeans", "#6B7C8A"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
    item("Footwear", "White leather sneakers", "#FFFFFF"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const country = combos.find((c) => c.context === "Country weekend");
  const outdoors = combos.find((c) => c.context === "Outdoors");
  assert.ok(country && outdoors, "expected both casual contexts");
  const key = (c: { pieces: string[] }) =>
    c.pieces
      .filter((p) => /trouser|chino|jean|sneaker|derby|shoe/i.test(p))
      .sort()
      .join("|");
  assert.notEqual(
    key(country!),
    key(outdoors!),
    `casual twins: ${country!.pieces.join(" + ")} vs ${outdoors!.pieces.join(" + ")}`,
  );
  assert.ok(
    outdoors!.pieces.some((p) => /jean/i.test(p)),
    `Outdoors should keep catalogue jeans: ${outdoors!.pieces.join(" + ")}`,
  );
});

test("trousersCloneShoes catches navy-on-navy and not navy plus white sneakers", () => {
  const colors = new Map([
    ["Navy linen trousers", "#28324A"],
    ["Navy leather derbies", "#1e2a3a"],
    ["White leather sneakers", "#F5F5F5"],
  ]);
  assert.equal(
    trousersCloneShoes("Navy linen trousers", "Navy leather derbies", colors),
    true,
  );
  assert.equal(
    trousersCloneShoes("Navy linen trousers", "White leather sneakers", colors),
    false,
  );
  assert.equal(
    trousersCloneShoes(
      "Cream summer trousers",
      "White leather sneakers",
      new Map([
        ["Cream summer trousers", "#FFFFFF"],
        ["White leather sneakers", "#FFFFFF"],
      ]),
    ),
    false,
  );
});

test("sanitizeLookHarmony swaps cloned navy shoes off navy trousers when sneakers exist", () => {
  const colors = new Map([
    ["Navy cashmere sweater", "#28324A"],
    ["Navy linen trousers", "#28324A"],
    ["Navy leather derbies", "#1e2a3a"],
    ["White leather sneakers", "#F5F5F5"],
  ]);
  const next = sanitizeLookHarmony(
    ["Navy cashmere sweater", "Navy linen trousers", "Navy leather derbies"],
    colors,
    {
      shoes: ["Navy leather derbies", "White leather sneakers"],
      allowCasualShoeSwap: true,
    },
  );
  assert.ok(
    next.some((p) => /sneaker/i.test(p)),
    `expected sneakers: ${next.join(" + ")}`,
  );
});

test("capsuleColorWord trusts navy in the title when the hex is pale grey", () => {
  assert.equal(
    capsuleColorWord("Luciénte Navy Blue Technical Windbreaker Jacket", "#CCCCCC"),
    "navy",
  );
});

test("capsuleColorWord calls olive olive, not yellow", () => {
  assert.equal(
    capsuleColorWord("Double Pleat Trousers", "#6B6B47", "Olive Green"),
    "olive green",
  );
  assert.equal(capsuleColorWord("Double Pleat Trousers", "#6B6B47"), "olive");
});

test("capsuleImageDirectives forbid copying knit elbow patches onto a jacket", () => {
  const d = capsuleImageDirectives([
    "Grey tweed jacket",
    "Warm Crew-Neck Jumper With Elbow Patches",
    "Navy linen trousers",
  ]);
  assert.match(d, /elbow patches/i);
  assert.match(d, /navy/i);
});

test("isJeanTitle ignores a denim-brand chino", () => {
  assert.equal(isJeanTitle("Wam Denim The Scarlet Navy Chino"), false);
  assert.equal(isJeanTitle("Wam Denim The Carry Light Grey Trousers"), false);
  assert.equal(isJeanTitle("Tapered Denim Cargo Trousers"), false);
  assert.equal(isJeanTitle("Blue-grey jeans"), true);
  assert.equal(isJeanTitle("Selvedge denim trousers"), true);
  assert.equal(isJeanTitle("Slim Fit Stretch Jeans"), true);
});

test("isCasualSummerShirtTitle catches V-neck short-sleeve, not an oxford", () => {
  assert.equal(
    isCasualSummerShirtTitle(
      "Valmonti Men’s Short Sleeve V-Neck Tailored Casual Summer Shirt",
    ),
    true,
  );
  assert.equal(isCasualSummerShirtTitle("Light grey oxford"), false);
  assert.equal(isCasualSummerShirtTitle("Long sleeve poplin shirt"), false);
});

test("wantsOutdoorJeans is true for an active / outdoors lifestyle", () => {
  assert.equal(wantsOutdoorJeans(varietyProfile()), true);
  assert.equal(
    wantsOutdoorJeans(testProfile({ lifestyle: ["Public speaking"] })),
    false,
  );
});

test("pickShoppingRolePair takes a long-sleeve shirt over a V-neck when polished", () => {
  const picked = pickShoppingRolePair(
    "Shirts",
    [
      { title: "Short Sleeve V-Neck Tailored Casual Summer Shirt" },
      { title: "Light grey oxford" },
      { title: "Camp collar linen shirt" },
    ],
    { polishedShirt: true },
  );
  assert.ok(picked.some((p) => /oxford/i.test(p.title)));
  assert.ok(!picked.some((p) => /v-neck|short sleeve/i.test(p.title)));
});

test("pickShoppingRolePair takes jeans plus a dark trouser when outdoors", () => {
  const picked = pickShoppingRolePair(
    "Trousers",
    [
      { title: "Cream summer trousers", color: "#FFFFFF" },
      { title: "Navy linen trousers", color: "#28324A" },
      { title: "Blue-grey jeans", color: "#6B7C8A" },
    ],
    { outdoorJeans: true },
  );
  assert.ok(picked.some((p) => /jean/i.test(p.title)));
  assert.ok(picked.some((p) => /navy/i.test(p.title)));
});

test("pickShoppingRolePair prefers a cheaper casual outer over a 4x windbreaker", () => {
  const picked = pickShoppingRolePair("Outerwear", [
    { title: "Grey tweed jacket", color: "#8B8B8B", priceEur: 59 },
    { title: "Navy technical windbreaker", color: "#CCCCCC", priceEur: 229 },
    { title: "Olive field jacket", color: "#5C6048", priceEur: 79 },
  ]);
  assert.ok(picked.some((p) => /tweed/i.test(p.title)));
  assert.ok(picked.some((p) => /field jacket/i.test(p.title)));
  assert.ok(!picked.some((p) => /windbreaker/i.test(p.title)));
});

test("capsule matrix does not tag a catalogue trouser as owned", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Cream summer trousers", "#F5F0E6"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  for (const look of combos) {
    assert.ok(
      !(look.owned ?? []).some((p) => /navy linen/i.test(p)),
      `${look.context} marked catalogue trousers owned: ${look.owned?.join(", ")}`,
    );
  }
});

test("capsule matrix skips assumed jeans when shopping has no denim", () => {
  const shopping = [
    item("Outerwear", "Navy technical windbreaker", "#28324A"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Footwear", "White leather sneakers", "#FFFFFF"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  assert.ok(
    !combos.some((c) => c.pieces.some((p) => /blue-grey jeans/i.test(p))),
    `assumed jeans leaked: ${combos.map((c) => `${c.context}: ${c.pieces.join(" + ")}`).join(" | ")}`,
  );
});

test("on stage keeps a lighter top against navy trousers", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Knitwear", "Navy cashmere crew neck", "#28324A"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Trousers", "Light grey slim chinos", "#AEB3B6"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const onStage = combos.find((c) => c.context === "On stage");
  assert.ok(onStage, "expected On stage");
  assert.ok(
    onStage!.pieces.some((p) => /oxford|shirt/i.test(p)),
    `On stage should contrast at the face: ${onStage!.pieces.join(" + ")}`,
  );
  assert.ok(
    !onStage!.pieces.every((p) => /navy/i.test(p) || isShoeTitle(p) === false && /navy/i.test(p)),
    `On stage still a navy column: ${onStage!.pieces.join(" + ")}`,
  );
});

test("dinner does not put a short-sleeve shirt under a winter tweed", () => {
  const shopping = [
    item("Outerwear", "Grey tweed jacket", "#8B8B8B"),
    item("Shirts", "Short Sleeve V-Neck Tailored Casual Summer Shirt", "#C3C3C3"),
    item("Shirts", "Light grey oxford", "#C3C3C3"),
    item("Trousers", "Navy linen trousers", "#28324A"),
    item("Footwear", "Navy leather derbies", "#1e2a3a"),
  ];
  const combos = capsuleMatrix(shopping, varietyProfile());
  const dinner = combos.find((c) => c.context === "Dinner");
  assert.ok(dinner, "expected Dinner");
  const hasTweed = dinner!.pieces.some((p) => /tweed/i.test(p));
  const hasShort = dinner!.pieces.some((p) => isCasualSummerShirtTitle(p));
  assert.equal(
    hasTweed && hasShort,
    false,
    `season clash: ${dinner!.pieces.join(" + ")}`,
  );
});

test("capsuleFrom puts the cheap tweed hero in Buy now, not a 4x windbreaker", () => {
  const shopping = [
    { ...item("Outerwear", "Grey tweed jacket"), priceEur: 59 },
    { ...item("Outerwear", "Navy technical windbreaker"), priceEur: 229 },
    { ...item("Trousers", "Navy linen trousers"), priceEur: 53 },
    { ...item("Footwear", "Navy leather derbies"), priceEur: 130 },
    { ...item("Knitwear", "Slate merino crewneck"), priceEur: 47 },
    { ...item("Shirts", "Light grey oxford"), priceEur: 41 },
    { ...item("Accessories", "Linen-blend tie"), priceEur: 10 },
  ];
  const plan = capsuleFrom(shopping, varietyProfile());
  assert.ok(
    plan.now.some((p) => /tweed/i.test(p.title)),
    `Buy now missing hero: ${plan.now.map((p) => p.title).join(", ")}`,
  );
  assert.ok(
    !plan.now.some((p) => /windbreaker/i.test(p.title)),
    `expensive windbreaker in Buy now: ${plan.now.map((p) => p.title).join(", ")}`,
  );
  assert.ok(
    plan.now.some((p) => /oxford|linen trousers|derb|merino/i.test(p.title)),
    `Buy now should cover a wardrobe gap: ${plan.now.map((p) => p.title).join(", ")}`,
  );
});

test("capsuleFrom does not fill Buy now with two shirts", () => {
  const shopping = [
    { ...item("Outerwear", "Grey tweed jacket"), priceEur: 59 },
    { ...item("Shirts", "Light grey oxford"), priceEur: 41 },
    { ...item("Shirts", "Charcoal poplin shirt"), priceEur: 41 },
    { ...item("Trousers", "Navy linen trousers"), priceEur: 53 },
    { ...item("Knitwear", "Slate merino crewneck"), priceEur: 47 },
  ];
  const plan = capsuleFrom(shopping, varietyProfile());
  const shirtsNow = plan.now.filter((p) => p.category === "Shirts");
  assert.ok(shirtsNow.length <= 1, `two shirts in Buy now: ${plan.now.map((p) => p.title).join(", ")}`);
  assert.ok(
    plan.now.some((p) => /trouser|merino|derb/i.test(p.title)),
    `Buy now should open a second role: ${plan.now.map((p) => p.title).join(", ")}`,
  );
});

test("capsuleImageDirectives ask for denim when the look includes jeans", () => {
  const d = capsuleImageDirectives([
    "Navy technical windbreaker",
    "Light grey oxford",
    "Blue-grey jeans",
    "White leather sneakers",
  ]);
  assert.match(d, /denim/i);
});

test("bestPaletteFitScore prefers a cool merino over a warm yellow jumper", () => {
  const best = [
    { name: "Navy Grey", hex: "#4A5568", why: "" },
    { name: "Dusty Blue", hex: "#6B8CAE", why: "" },
    { name: "Slate", hex: "#54606E", why: "" },
    { name: "Mauve", hex: "#9A7B8C", why: "" },
  ];
  const slate = bestPaletteFitScore("#54606E", "Slate merino crewneck", best);
  const yellow = bestPaletteFitScore(
    "#F4C430",
    "Geometric colour block jumper",
    best,
  );
  assert.ok(slate > yellow, `slate ${slate} should beat yellow ${yellow}`);
  assert.ok(slate >= 0.55, `slate merino should sit on the BEST palette (${slate})`);
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

test("resolveLookGarments prefers the brief's boots over a stale loafer slot", () => {
  const description =
    "rust leather jacket, oatmeal shirt, coffee chinos, olive belt, rust leather boots, oatmeal briefcase";
  const stale = [
    { garment: "linen blazer", color: "camel" },
    { garment: "cotton shirt", color: "oatmeal" },
    { garment: "chinos", color: "coffee" },
    { garment: "woven belt", color: "olive" },
    { garment: "suede loafers", color: "warm grey" },
    { garment: "leather briefcase", color: "oatmeal" },
  ];
  const garments = resolveLookGarments(stale, description);
  const shoe = garments.find((g) => g.category === "Footwear");
  const outer = garments.find((g) => g.category === "Outerwear");
  assert.ok(shoe);
  assert.match(shoe!.garment, /boot/i);
  assert.match(shoe!.clause, /leather boots/i);
  assert.ok(outer);
  assert.match(outer!.garment, /jacket/i);
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
