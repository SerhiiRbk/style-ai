import assert from "node:assert/strict";
import test from "node:test";
import { hexToHsl, reportPalette, type ColorRec } from "./colour-palette";
import {
  beltForShoe,
  bottomContrastsHero,
  contrastSwatch,
  isSneakerOccasion,
  isAccentForPalette,
  paletteRoleForHex,
  SHOE_LIGHTER_THAN_TROUSERS_MAX,
  formatLookColorRecipePrompt,
  lookSetColorRecipes,
  recipeHeroHonoured,
  recipeShoeHonoured,
  enforceRecipeShoe,
  enforceRecipeBelt,
  enforceRecipeJacketColour,
  MAX_SAME_BOTTOM_PER_SET,
  recipePaletteHexes,
  type LookColorRecipe,
} from "./look-set-color-recipes";

function best(subseason: Parameters<typeof reportPalette>[0]["subseason"]): ColorRec[] {
  return reportPalette({
    subseason,
    undertone: "neutral",
    contrast: "medium",
  }).best;
}

function hexes(bestColors: ColorRec[]): Set<string> {
  return new Set(bestColors.map((c) => c.hex.toLowerCase()));
}

function assertOnPalette(recipes: LookColorRecipe[], palette: ColorRec[]) {
  const allowed = hexes(palette);
  for (const r of recipes) {
    for (const sw of [r.hero, r.bottom, r.shoe, ...r.neutrals, r.accent].filter(Boolean)) {
      assert.ok(
        allowed.has(sw!.hex.toLowerCase()),
        `${sw!.name} ${sw!.hex} is not in BEST`,
      );
    }
  }
}

test("3-look set: distinct heroes, shared neutrals, all on-palette", () => {
  const palette = best("soft-summer");
  const recipes = lookSetColorRecipes(palette, 3);
  assert.equal(recipes.length, 3);
  const heroes = recipes.map((r) => r.hero.hex.toLowerCase());
  assert.equal(new Set(heroes).size, 3, `heroes should differ: ${heroes.join(",")}`);
  const n0 = recipes[0]!.neutrals.map((n) => n.hex.toLowerCase()).join(",");
  for (const r of recipes) {
    assert.equal(r.neutrals.map((n) => n.hex.toLowerCase()).join(","), n0);
  }
  assertOnPalette(recipes, palette);
});

test("6 and 9 looks stay unique on (hero, bottom) and stay on-palette", () => {
  for (const n of [6, 9]) {
    const palette = best("soft-summer");
    const recipes = lookSetColorRecipes(palette, n);
    assert.equal(recipes.length, n);
    const pairs = recipes.map((r) => `${r.hero.hex}|${r.bottom.hex}`.toLowerCase());
    assert.equal(new Set(pairs).size, n, `duplicate pairs at n=${n}: ${pairs.join(" ; ")}`);
    for (const r of recipes) {
      assert.notEqual(r.hero.hex.toLowerCase(), r.bottom.hex.toLowerCase());
    }
    assertOnPalette(recipes, palette);
  }
});

test("first three heroes are hue-spread, not a single green cluster", () => {
  const recipes = lookSetColorRecipes(best("soft-summer"), 3);
  const names = recipes.map((r) => r.hero.name.toLowerCase());
  const greenish = names.filter((n) => /teal|sage|olive|mint|green/.test(n));
  assert.ok(
    greenish.length <= 1,
    `too many green heroes in first 3: ${names.join(", ")}`,
  );
});

test("recipes work across subseasons at 3/6/9", () => {
  for (const sub of ["cool-winter", "warm-autumn", "light-summer"] as const) {
    for (const n of [3, 6, 9]) {
      const palette = best(sub);
      const recipes = lookSetColorRecipes(palette, n);
      assert.equal(recipes.length, n, `${sub} n=${n}`);
      assertOnPalette(recipes, palette);
      assert.equal(
        new Set(recipes.map((r) => `${r.hero.hex}|${r.bottom.hex}`.toLowerCase())).size,
        n,
        `${sub} n=${n} duplicate pairs`,
      );
    }
  }
});

test("contrastSwatch does not pair mushroom trousers with greige shoes", () => {
  const mushroom = { name: "mushroom", hex: "#A99C8C", why: "" };
  const greige = { name: "greige", hex: "#DAD3C6", why: "" };
  const sage = { name: "sage", hex: "#8A9A78", why: "" };
  const slate = { name: "slate", hex: "#647A93", why: "" };
  const shoe = contrastSwatch(mushroom, [greige, sage, slate]);
  assert.ok(shoe);
  assert.notEqual(shoe.name, "greige");
  assert.ok(["sage", "slate"].includes(shoe.name));
});

test("party × statement prompt forbids a tote and office crewneck", () => {
  const [recipe] = lookSetColorRecipes(best("soft-summer"), 3, {
    boldness: "statement",
    occasionId: "party",
  });
  assert.ok(recipe);
  const text = formatLookColorRecipePrompt(recipe, {
    boldness: "statement",
    occasionId: "party",
  });
  assert.match(text, /No tote/i);
  assert.match(text, /office crewneck/i);
  assert.match(text, /evening statement/i);
  assert.match(text, /MUST contrast the trousers/i);
});

test("prompt lists hero, bottom, pinned shoes and shared neutrals", () => {
  const [recipe] = lookSetColorRecipes(best("soft-summer"), 3);
  assert.ok(recipe);
  const text = formatLookColorRecipePrompt(recipe);
  assert.match(text, new RegExp(recipe.hero.name, "i"));
  assert.match(text, new RegExp(recipe.hero.hex, "i"));
  assert.match(text, new RegExp(recipe.bottom.name, "i"));
  assert.match(text, /Shoes:/i);
  assert.match(text, /shared neutrals/i);
  assert.match(text, /blazer|sport coat/i);
  assert.match(text, /overcoat/i);
});

test("three looks pin distinct shoe colours when the palette allows", () => {
  const recipes = lookSetColorRecipes(best("soft-autumn"), 3);
  const shoes = recipes.map((r) => r.shoe.hex.toLowerCase());
  assert.ok(
    new Set(shoes).size >= 2,
    `shoes should not all be the same grey: ${shoes.join(",")}`,
  );
});

test("work prompt pins a white or light-blue shirt from the trousers", () => {
  const recipes = lookSetColorRecipes(best("soft-autumn"), 3, {
    occasionId: "work",
  });
  const coffee = recipes.find((r) => /coffee|brown|olive|camel/i.test(r.bottom.name));
  const light = recipes.find((r) =>
    /oatmeal|cream|stone|grey|gray/i.test(r.bottom.name),
  );
  if (coffee) {
    const text = formatLookColorRecipePrompt(coffee, { occasionId: "work" });
    assert.match(text, /Shirt: white oxford/i);
  }
  if (light && light !== coffee) {
    const text = formatLookColorRecipePrompt(light, { occasionId: "work" });
    assert.match(text, /Shirt: light blue oxford/i);
  }
});

test("shoe is never a chromatic clone of the hero jacket", () => {
  for (const n of [3, 6]) {
    const recipes = lookSetColorRecipes(best("soft-summer"), n);
    for (const r of recipes) {
      const h = hexToHsl(r.hero.hex);
      const s = hexToHsl(r.shoe.hex);
      if (h.s >= 0.22 && h.l > 0.34 && s.s >= 0.22 && s.l > 0.34) {
        const d = Math.abs(h.h - s.h);
        const hue = d > 180 ? 360 - d : d;
        assert.ok(
          hue >= 30 || Math.abs(h.l - s.l) >= 0.28,
          `hero ${r.hero.name} ${r.hero.hex} clones shoe ${r.shoe.name} ${r.shoe.hex}`,
        );
      }
    }
  }
});

test("recipe prompt forbids repeating the hero on the shoes", () => {
  const [recipe] = lookSetColorRecipes(best("soft-summer"), 3);
  assert.ok(recipe);
  const text = formatLookColorRecipePrompt(recipe);
  assert.match(text, /one chromatic hero/i);
  assert.match(text, /shoes must not match the jacket/i);
});

test("count 0 returns no recipes", () => {
  assert.deepEqual(lookSetColorRecipes(best("soft-summer"), 0), []);
});

test("belt follows dark shoe leather; coloured suede or light shoes get the dark neutral belt", () => {
  const navy = { name: "Muted navy", hex: "#3E4C63", why: "" };
  const plum = { name: "Soft plum", hex: "#7A6577", why: "" };
  const teal = { name: "Soft teal", hex: "#5F8C86", why: "" };
  const charcoal = { name: "Soft charcoal", hex: "#464C55", why: "" };
  const greige = { name: "Greige", hex: "#DAD3C6", why: "" };
  const stone = { name: "Stone", hex: "#c9c2b5", why: "" };
  const coffee = { name: "Coffee", hex: "#45352a", why: "" };
  const spruce = { name: "Spruce", hex: "#3a534d", why: "" };
  assert.equal(beltForShoe(navy, [charcoal], [greige]).hex, navy.hex);
  // Greige sneakers do not make a greige belt: a light belt under dark trousers
  // was the a111 defect, so a light shoe hands the belt to the dark anchor.
  assert.equal(beltForShoe(greige, [charcoal], [greige]).hex, charcoal.hex, "light shoe → dark neutral belt");
  assert.notEqual(beltForShoe(stone, [navy, charcoal], [charcoal, navy]).name, "Stone");
  assert.equal(beltForShoe(coffee, [navy, charcoal], [charcoal, navy]).name, "Coffee");
  // Teal, plum and spruce suede are coloured shoes — not belt colours.
  assert.equal(beltForShoe(teal, [charcoal], [greige]).hex, charcoal.hex);
  assert.equal(beltForShoe(plum, [charcoal], [greige]).hex, charcoal.hex);
  const spruceBelt = beltForShoe(spruce, [navy, charcoal], [charcoal, navy]);
  assert.notEqual(spruceBelt.hex.toLowerCase(), spruce.hex.toLowerCase());
  assert.match(spruceBelt.name, /navy|charcoal|grey|gray/i);
  for (const r of lookSetColorRecipes(best("soft-summer"), 3)) {
    assert.ok(r.belt, "every recipe carries a belt");
    assert.ok(hexToHsl(r.belt.hex).s < 0.28 || r.belt.hex === r.shoe.hex, `belt ${r.belt.name} is not chromatic`);
    assert.ok(recipePaletteHexes(r).includes(r.belt.hex.toLowerCase()) || recipePaletteHexes(r).includes(r.belt.hex));
  }
  const prompt = formatLookColorRecipePrompt(lookSetColorRecipes(best("soft-summer"), 3)[0]!);
  assert.match(prompt, /- Belt: /);
  assert.doesNotMatch(prompt, /Shared neutrals \(belt, bag\)/);
});

test("recipeHeroHonoured reads the hero from description or items, ignoring softeners", () => {
  const recipe = { hero: { name: "Soft teal", hex: "#5F8C86", why: "" } };
  assert.equal(recipeHeroHonoured({ description: "Teal merino crewneck, greige chinos" }, recipe), true);
  assert.equal(recipeHeroHonoured({ description: "Navy blazer, white shirt", items: [{ color: "soft teal" }] }, recipe), true);
  assert.equal(recipeHeroHonoured({ description: "Navy blazer, white shirt, grey trousers" }, recipe), false);
  assert.equal(recipeHeroHonoured({ description: "" }, { hero: { name: "Soft", hex: "#000000", why: "" } }), true);
});

/* ------------------------ formal shoe enforcement ------------------------ */

const WORK_RECIPE: Pick<LookColorRecipe, "shoe" | "belt"> = {
  shoe: { name: "Soft charcoal", hex: "#464b54", why: "" },
  belt: { name: "Soft charcoal", hex: "#464b54", why: "" },
};

test("recipeShoeHonoured: greige oxfords fail a work look, dark leather passes", () => {
  const greige = {
    description:
      "Slate-blue wool blazer, white cotton poplin shirt, soft-charcoal wool trousers, greige leather oxfords, greige leather belt",
    items: [
      { garment: "wool blazer", color: "slate-blue" },
      { garment: "cotton poplin shirt", color: "white" },
      { garment: "wool trousers", color: "soft-charcoal" },
      { garment: "leather oxfords", color: "greige" },
      { garment: "leather belt", color: "greige" },
    ],
  };
  assert.equal(recipeShoeHonoured(greige, WORK_RECIPE, "work"), false);
  // Off-duty looks are not judged — light suede loafers are fine at the weekend.
  assert.equal(recipeShoeHonoured(greige, WORK_RECIPE, "weekend"), true);
  const dark = {
    ...greige,
    items: greige.items.map((it) =>
      /oxfords/.test(it.garment) ? { ...it, color: "dark brown" } : it,
    ),
  };
  assert.equal(recipeShoeHonoured(dark, WORK_RECIPE, "work"), true);
  const recipeColour = {
    ...greige,
    items: greige.items.map((it) =>
      /oxfords/.test(it.garment) ? { ...it, color: "soft-charcoal" } : it,
    ),
  };
  assert.equal(recipeShoeHonoured(recipeColour, WORK_RECIPE, "work"), true);
  // Legacy look without items: judged on the description clause.
  assert.equal(
    recipeShoeHonoured({ description: greige.description }, WORK_RECIPE, "work"),
    false,
  );
  assert.equal(
    recipeShoeHonoured(
      { description: "Navy blazer, white shirt, grey trousers, black leather derbies" },
      WORK_RECIPE,
      "formal",
    ),
    true,
  );
});

test("enforceRecipeShoe snaps the shoe and its matching belt in items and prose", () => {
  const look = {
    title: "Slate-blue blazer, quiet authority",
    description:
      "Slate-blue wool blazer, white cotton poplin shirt, soft-charcoal wool trousers, greige leather oxfords, greige leather belt, dusty-rose leather briefcase",
    items: [
      { garment: "wool blazer", color: "slate-blue" },
      { garment: "cotton poplin shirt", color: "white" },
      { garment: "wool trousers", color: "soft-charcoal" },
      { garment: "leather oxfords", color: "greige" },
      { garment: "leather belt", color: "greige" },
      { garment: "leather briefcase", color: "dusty-rose" },
    ],
  };
  const fixed = enforceRecipeShoe(look, WORK_RECIPE, "work");
  assert.equal(fixed.title, look.title);
  assert.equal(fixed.items?.find((i) => /oxfords/.test(i.garment))?.color, "soft-charcoal");
  assert.equal(fixed.items?.find((i) => /belt/.test(i.garment))?.color, "soft-charcoal");
  assert.equal(fixed.items?.find((i) => /briefcase/.test(i.garment))?.color, "dusty-rose");
  assert.match(fixed.description, /soft-charcoal leather oxfords/);
  assert.match(fixed.description, /soft-charcoal leather belt/);
  assert.doesNotMatch(fixed.description, /greige/);
  assert.equal(recipeShoeHonoured(fixed, WORK_RECIPE, "work"), true);
  // Already honoured → identity.
  assert.equal(enforceRecipeShoe(fixed, WORK_RECIPE, "work"), fixed);
  // Non-formal occasion → untouched.
  assert.equal(enforceRecipeShoe(look, WORK_RECIPE, "dinner"), look);
});

/* ------------------------- hero / bottom contrast ------------------------- */

// Report a111db4d: the soft-summer palette whose weekend look put a slate-blue
// knit over sage chinos — ΔL 0.12, neighbouring muted hues, one tonal blur.
const REPORT_BEST: ColorRec[] = [
  { name: "Greige", hex: "#ded8d4", why: "" },
  { name: "Soft teal", hex: "#5f8c86", why: "" },
  { name: "Dusty rose", hex: "#d4c2c0", why: "" },
  { name: "Muted navy", hex: "#424b5b", why: "" },
  { name: "Sage", hex: "#a2af94", why: "" },
  { name: "Mushroom", hex: "#baaea2", why: "" },
  { name: "Soft plum", hex: "#9b8398", why: "" },
  { name: "Slate blue", hex: "#6c8098", why: "" },
  { name: "Soft charcoal", hex: "#464b54", why: "" },
  { name: "Dove grey", hex: "#c6cdd1", why: "" },
];

test("bottomContrastsHero: slate blue over sage fails, real steps pass", () => {
  const slate = REPORT_BEST[7]!;
  const sage = REPORT_BEST[4]!;
  const mushroom = REPORT_BEST[5]!;
  const rose = REPORT_BEST[2]!;
  const navy = REPORT_BEST[3]!;
  const charcoal = REPORT_BEST[8]!;
  const greige = REPORT_BEST[0]!;
  assert.equal(bottomContrastsHero(slate, sage), false);
  assert.equal(bottomContrastsHero(slate, mushroom), false);
  // Light bottom under a mid hero — a clear value step.
  assert.equal(bottomContrastsHero(slate, rose), true);
  assert.equal(bottomContrastsHero(slate, greige), true);
  // Dark on dark is a deliberate column, not a blur.
  assert.equal(bottomContrastsHero(navy, charcoal), true);
  // Chromatic hero over a true neutral anchor (teal knit, charcoal trousers).
  assert.equal(bottomContrastsHero(REPORT_BEST[1]!, charcoal), true);
  // Two muted mid-neutrals never carry a pairing on their own.
  assert.equal(bottomContrastsHero(REPORT_BEST[6]!, mushroom), false);
});

test("statement recipes never pair a mid hero with a mid bottom of the same value", () => {
  for (const n of [3, 6]) {
    const recipes = lookSetColorRecipes(REPORT_BEST, n, { boldness: "statement" });
    assert.equal(recipes.length, n);
    for (const r of recipes) {
      assert.ok(
        bottomContrastsHero(r.hero, r.bottom),
        `n=${n}: ${r.hero.name} over ${r.bottom.name} has no contrast`,
      );
    }
  }
  // Nine looks may exhaust the contrasting pairs — the tonal pair is a last
  // resort, never the rule.
  const nine = lookSetColorRecipes(REPORT_BEST, 9, { boldness: "statement" });
  const contrasting = nine.filter((r) => bottomContrastsHero(r.hero, r.bottom)).length;
  assert.ok(contrasting >= 7, `only ${contrasting}/9 contrasting pairs`);
});

test("hero / bottom contrast holds across subseasons for 3 and 6 looks", () => {
  for (const sub of ["soft-summer", "cool-winter", "warm-autumn", "light-summer"] as const) {
    for (const n of [3, 6]) {
      const recipes = lookSetColorRecipes(best(sub), n);
      for (const r of recipes) {
        assert.ok(
          bottomContrastsHero(r.hero, r.bottom),
          `${sub} n=${n}: ${r.hero.name} over ${r.bottom.name}`,
        );
      }
    }
  }
});

/* ----------------------- shoes never lighter than legs ---------------------- */

test("contrastSwatch does not put greige shoes under charcoal trousers", () => {
  const charcoal = REPORT_BEST[8]!;
  const greige = REPORT_BEST[0]!;
  const navy = REPORT_BEST[3]!;
  const rose = REPORT_BEST[2]!;
  const shoe = contrastSwatch(charcoal, [greige, rose, navy]);
  assert.ok(shoe);
  assert.equal(shoe.name, "Muted navy", `picked ${shoe.name}`);
  // Only light candidates: the rule cannot be met, the least-bad pair still returns.
  const fallback = contrastSwatch(charcoal, [greige, rose]);
  assert.ok(fallback);
  // Light trousers take any darker shoe.
  const underGreige = contrastSwatch(greige, [navy, charcoal, rose]);
  assert.ok(underGreige && hexToHsl(underGreige.hex).l < hexToHsl(greige.hex).l);
});

test("recipes keep the shoe no lighter than the trousers by more than the cap", () => {
  for (const [palette, label] of [
    [REPORT_BEST, "report"],
    [best("soft-summer"), "soft-summer"],
    [best("cool-winter"), "cool-winter"],
    [best("warm-autumn"), "warm-autumn"],
  ] as const) {
    for (const n of [3, 6, 9]) {
      for (const r of lookSetColorRecipes(palette, n, { boldness: "statement" })) {
        const gap = hexToHsl(r.shoe.hex).l - hexToHsl(r.bottom.hex).l;
        assert.ok(
          gap <= SHOE_LIGHTER_THAN_TROUSERS_MAX + 1e-9,
          `${label} n=${n}: ${r.shoe.name} shoes under ${r.bottom.name} trousers (gap ${gap.toFixed(2)})`,
        );
      }
    }
  }
});

/* -------------------------- sneaker-context exception ------------------------- */

test("isSneakerOccasion: weekend / travel / outdoor / resort only", () => {
  for (const id of ["weekend", "travel", "outdoor", "resort"]) {
    assert.equal(isSneakerOccasion(id), true, id);
  }
  for (const id of ["work", "dinner", "smart_casual", "business_social", "party", "formal", null, undefined]) {
    assert.equal(isSneakerOccasion(id), false, String(id));
  }
});

test("contrastSwatch allows a light sneaker under dark trousers when asked", () => {
  const charcoal = REPORT_BEST[8]!;
  const greige = REPORT_BEST[0]!;
  const navy = REPORT_BEST[3]!;
  const shoe = contrastSwatch(charcoal, [greige, navy], null, { allowLighterShoe: true });
  assert.ok(shoe);
  assert.equal(shoe.name, "Greige", `picked ${shoe.name}`);
});

test("per-look occasions: sneaker looks may go light, the rest keep the leg line", () => {
  const occasionIds = ["dinner", "weekend", "business_social", "work", "smart_casual", "travel"];
  const recipes = lookSetColorRecipes(REPORT_BEST, 6, {
    boldness: "statement",
    occasionIds,
  });
  assert.equal(recipes.length, 6);
  recipes.forEach((r, i) => {
    if (isSneakerOccasion(occasionIds[i])) return;
    const gap = hexToHsl(r.shoe.hex).l - hexToHsl(r.bottom.hex).l;
    assert.ok(
      gap <= SHOE_LIGHTER_THAN_TROUSERS_MAX + 1e-9,
      `${occasionIds[i]}: ${r.shoe.name} under ${r.bottom.name} (gap ${gap.toFixed(2)})`,
    );
  });
  // A set-level sneaker occasion (Create-a-Look weekend set) lifts the cap for
  // every look; at least one dark-trouser look should take the light pair.
  const weekend = lookSetColorRecipes(REPORT_BEST, 6, {
    boldness: "statement",
    occasionId: "weekend",
  });
  const light = weekend.filter(
    (r) => hexToHsl(r.shoe.hex).l - hexToHsl(r.bottom.hex).l > SHOE_LIGHTER_THAN_TROUSERS_MAX,
  );
  assert.ok(light.length >= 1, weekend.map((r) => `${r.shoe.name} under ${r.bottom.name}`).join(" | "));
});

/* ----------------------- accent vs neutral by palette ----------------------- */

test("isAccentForPalette: muted hero colours are accents on a Soft Summer, greys are not", () => {
  // Products faithfully in the palette's teal / slate (s ≈ 0.2) — the constant
  // rule called these neutrals.
  assert.equal(paletteRoleForHex("#5f8c86", REPORT_BEST), "hero");
  assert.equal(isAccentForPalette("#5f8c86", REPORT_BEST), true);
  assert.equal(isAccentForPalette("#6c8098", REPORT_BEST), true);
  // Greys, greige, charcoal, navy trousers, mushroom: the neutral base.
  assert.equal(isAccentForPalette("#c3c3c3", REPORT_BEST), false);
  assert.equal(isAccentForPalette("#ded8d4", REPORT_BEST), false);
  assert.equal(isAccentForPalette("#464b54", REPORT_BEST), false);
  assert.equal(isAccentForPalette("#28324a", REPORT_BEST), false);
  assert.equal(isAccentForPalette("#baaea2", REPORT_BEST), false);
  // A pink shirt brighter than the palette is still an accent.
  assert.equal(isAccentForPalette("#d9a6c0", REPORT_BEST), true);
  // Dark brown leather sits on the dark anchor, not on mushroom — a neutral.
  assert.equal(paletteRoleForHex("#4a2f23", REPORT_BEST), "anchor");
  assert.equal(isAccentForPalette("#4a2f23", REPORT_BEST), false);
});

test("isAccentForPalette: navy trousers are not an accent on a bright palette", () => {
  const winter = best("cool-winter");
  // A saturated navy (s ≈ 0.35) sits on the palette's dark anchor.
  const navy = winter.find((c) => /navy|ink|midnight/i.test(c.name)) ?? winter.find((c) => hexToHsl(c.hex).l <= 0.34);
  assert.ok(navy, "fixture needs a dark anchor");
  assert.equal(isAccentForPalette(navy!.hex, winter), false);
  // The palette's own hero stays an accent.
  const hero = winter.find((c) => {
    const h = hexToHsl(c.hex);
    return h.s >= 0.3 && h.l >= 0.3 && h.l <= 0.65;
  });
  assert.ok(hero, "fixture needs a hero");
  assert.equal(isAccentForPalette(hero!.hex, winter), true);
});

/* ------------------------- bottoms cap + belt leather ------------------------- */

test("one trouser colour appears on at most two looks of a six-look set", () => {
  for (const palette of [REPORT_BEST, best("cool-summer"), best("soft-summer"), best("deep-autumn")]) {
    const recipes = lookSetColorRecipes(palette, 6, { boldness: "statement" });
    const uses = new Map<string, number>();
    for (const r of recipes) uses.set(r.bottom.name, (uses.get(r.bottom.name) ?? 0) + 1);
    for (const [name, n] of uses) assert.ok(n <= MAX_SAME_BOTTOM_PER_SET, `${name} on ${n} looks`);
  }
});

test("work / dinner / business-social bottoms stay off cool-white (64510d11)", () => {
  const palette = best("cool-summer");
  const occasionIds = ["dinner", "weekend", "business_social", "work", "smart_casual", "travel"];
  const recipes = lookSetColorRecipes(palette, 6, { boldness: "statement", occasionIds });
  for (const id of ["dinner", "business_social", "work"] as const) {
    const r = recipes[occasionIds.indexOf(id)]!;
    const { l } = hexToHsl(r.bottom.hex);
    assert.ok(
      l < 0.68 && !/\b(white|pearl|ivory|cream|snow)\b/i.test(r.bottom.name),
      `${id} bottom ${r.bottom.name} ${r.bottom.hex} is too light`,
    );
  }
});

test("statement Cool Summer: at most one mauve/rose hero, never on work or dinner", () => {
  const palette = best("cool-summer");
  const occasionIds = ["dinner", "weekend", "business_social", "work", "smart_casual", "travel"];
  const recipes = lookSetColorRecipes(palette, 6, { boldness: "statement", occasionIds });
  const pink = (c: ColorRec) => /\b(mauve|rose|pink|blush|lilac|lavender)\b/i.test(c.name);
  const pinkHeroes = recipes.filter((r) => pink(r.hero));
  assert.ok(pinkHeroes.length <= 1, recipes.map((r) => r.hero.name).join(", "));
  for (const id of ["dinner", "business_social", "work"] as const) {
    assert.equal(pink(recipes[occasionIds.indexOf(id)]!.hero), false, id);
  }
});

test("enforceRecipeJacketColour snaps a mauve blazer and overcoat, leaves a mauve knit", () => {
  const recipe = {
    hero: { name: "Dusty blue", hex: "#6E8CA6", why: "" },
    neutrals: [
      { name: "Cool white", hex: "#F1F1EF", why: "" },
      { name: "Navy grey", hex: "#2B3A4E", why: "" },
    ] as [ColorRec, ColorRec],
  };
  const look = {
    description:
      "Mauve wool-blend blazer, cool-white oxford shirt, spruce chinos, mauve merino cardigan, charcoal tailored overcoat",
    items: [
      { garment: "blazer", color: "mauve" },
      { garment: "shirt", color: "cool-white" },
      { garment: "chinos", color: "spruce" },
      { garment: "cardigan", color: "mauve" },
      { garment: "overcoat", color: "charcoal" },
    ],
  };
  const fixed = enforceRecipeJacketColour(look, recipe);
  assert.equal(fixed.items?.find((i) => i.garment === "blazer")?.color, "dusty-blue");
  assert.match(fixed.description, /dusty-blue wool-blend blazer/i);
  assert.equal(fixed.items?.find((i) => i.garment === "cardigan")?.color, "mauve");
  assert.match(fixed.description, /mauve merino cardigan/i);
  const roseCoat = {
    description: "Mauve tailored overcoat, navy trousers",
    items: [
      { garment: "overcoat", color: "mauve" },
      { garment: "trousers", color: "navy" },
    ],
  };
  const coat = enforceRecipeJacketColour(roseCoat, recipe);
  assert.match(coat.items?.find((i) => i.garment === "overcoat")?.color ?? "", /navy|charcoal|camel|stone|greige/i);
  assert.doesNotMatch(coat.items?.find((i) => i.garment === "overcoat")?.color ?? "", /mauve|rose|pink/i);
});

test("enforceRecipeBelt turns a spruce belt into the recipe's leather, leaves leather belts alone", () => {
  const recipe = { belt: { name: "Soft charcoal", hex: "#464b54", why: "" } };
  const look = {
    description: "Dusty-blue crewneck knit, charcoal-grey chinos, spruce suede loafers, spruce leather belt, slate canvas tote",
    items: [
      { garment: "crewneck knit", color: "dusty-blue" },
      { garment: "chinos", color: "charcoal-grey" },
      { garment: "suede loafers", color: "spruce" },
      { garment: "leather belt", color: "spruce" },
      { garment: "canvas tote", color: "slate" },
    ],
  };
  const fixed = enforceRecipeBelt(look, recipe);
  assert.equal(fixed.items?.find((i) => /belt/.test(i.garment))?.color, "soft-charcoal");
  assert.match(fixed.description, /soft-charcoal leather belt/);
  // The loafers keep their colour: the shoe rule is a separate, occasion-bound decision.
  assert.equal(fixed.items?.find((i) => /loafers/.test(i.garment))?.color, "spruce");
  const leather = { ...look, items: look.items.map((i) => (/belt/.test(i.garment) ? { ...i, color: "coffee leather" } : i)) };
  assert.equal(enforceRecipeBelt(leather, recipe), leather);
  const navy = { ...look, items: look.items.map((i) => (/belt/.test(i.garment) ? { ...i, color: "navy-grey" } : i)) };
  assert.equal(enforceRecipeBelt(navy, recipe), navy);
});
