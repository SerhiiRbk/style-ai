/**
 * Colour invariants across the three layers that decide what a client is shown:
 *
 *   A. the avoid / near-face gates (style-extras)
 *   B. the look colour recipes and capsule slots (look-set-color-recipes, capsule-wardrobe)
 *   C. catalogue admission for a capsule slot (recipe-pool-rules)
 *
 * Each test pushes one case — a real palette from a shipped report, or a
 * production defect — through every layer that has an opinion and fails when
 * the layers disagree. "What B recommends, C admits" is the load-bearing one:
 * a recipe that names a colour the catalogue gate would reject is a report
 * whose text and shopping list contradict each other.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { styleProfileSchema, type StyleProfile } from "./style-profile";
import type { ColorRec } from "./report";
import {
  capsuleWardrobeSlots,
  type CapsuleWardrobeRole,
  type CapsuleWardrobeSlot,
} from "./capsule-wardrobe";
import {
  enforceRecipeBelt,
  enforceRecipeShoe,
  lookSetColorRecipes,
  MAX_SAME_BOTTOM_PER_SET,
} from "./look-set-color-recipes";
import { recipePoolRejection, type RecipePoolContext, type RecipePoolRow } from "./recipe-pool-rules";
import {
  hitsAvoidPalette,
  isClassicLeatherColour,
  isCoolPastelNearFace,
  isDarkAnchorPiece,
  leatherTargetsFromGuide,
  shoeColourOffLeather,
  shoeGuideFor,
  wantsOutdoorJeans,
  wantsPolishedFootwear,
} from "./style-extras";

type Fixture = {
  slug: string;
  profile: StyleProfile;
  colors: { best: ColorRec[]; avoid: { name: string; hex: string }[] };
};

function load(slug: string): Fixture {
  const raw = JSON.parse(
    readFileSync(fileURLToPath(new URL(`./fixtures/reports/${slug}.json`, import.meta.url)), "utf8"),
  ) as { profile: unknown; colors: Fixture["colors"] };
  return { slug, profile: styleProfileSchema.parse(raw.profile), colors: raw.colors };
}

const FIXTURES = ["soft-summer-a111", "soft-autumn-f4b8", "deep-autumn-9674", "cool-summer-6451"].map(load);

function slotsFor(f: Fixture): CapsuleWardrobeSlot[] {
  const { profile, colors } = f;
  const avoid: ColorRec[] = colors.avoid.map((c) => ({ ...c, why: "" }));
  return capsuleWardrobeSlots(colors.best, avoid, {
    outdoorJeans: wantsOutdoorJeans(profile),
    polished: wantsPolishedFootwear(profile),
    cool: profile.physical.undertone === "cool",
    warm: profile.physical.undertone === "warm",
    leather: leatherTargetsFromGuide(shoeGuideFor(profile, colors.best, avoid)),
  });
}

function ctxFor(f: Fixture): RecipePoolContext {
  return {
    undertone: f.profile.physical.undertone,
    best: f.colors.best,
    bodyType: f.profile.physical.bodyType,
    outdoorJeans: wantsOutdoorJeans(f.profile),
    avoid: f.colors.avoid,
  };
}

function slot(slots: CapsuleWardrobeSlot[], role: CapsuleWardrobeRole): CapsuleWardrobeSlot {
  const s = slots.find((x) => x.role === role);
  assert.ok(s, `no ${role} slot`);
  return s;
}

/** A plausible catalogue title for a colour in a slot — the garment word the slot's own filters expect. */
const GARMENT_FOR_ROLE: Record<CapsuleWardrobeRole, string> = {
  jacket: "wool blazer",
  casualOuter: "wool shacket",
  darkTrouser: "wool trousers",
  casualTrouser: "cotton chinos",
  shirt: "cotton oxford shirt",
  knit: "merino crewneck jumper",
  dressShoe: "leather derbies",
  loafer: "leather loafers",
  sneaker: "leather sneakers",
  belt: "leather belt",
  bag: "leather briefcase",
};

function row(title: string, hex: string): RecipePoolRow {
  return { title, hay: title, hex };
}

/* ------------------------- B ⊆ C: recipes are admissible ------------------------- */

test("every colour a capsule slot asks for is admitted by the catalogue gate for that slot", () => {
  for (const f of FIXTURES) {
    const ctx = ctxFor(f);
    for (const s of slotsFor(f)) {
      const garment = s.role === "casualTrouser" && ctx.outdoorJeans ? "slim jeans" : GARMENT_FOR_ROLE[s.role];
      const why = recipePoolRejection(s, row(`${s.color.name} ${garment}`, s.color.hex), ctx);
      assert.equal(why, null, `${f.slug}: ${s.role} "${s.color.name}" rejected by its own slot: ${why}`);
    }
  }
});

test("every look recipe's shoe, belt, bottom and hero is admitted by the matching capsule slot", () => {
  for (const f of FIXTURES) {
    const ctx = ctxFor(f);
    const slots = slotsFor(f);
    const recipes = lookSetColorRecipes(f.colors.best, 6, { boldness: f.profile.boldness });
    assert.ok(recipes.length >= 3, `${f.slug}: only ${recipes.length} recipes`);
    for (const r of recipes) {
      // A leather-coloured recipe shoe must pass the dress-shoe slot; a palette
      // suede (teal, brick) is a casual-look shoe, checked against the palette
      // in the leather test instead.
      if (!shoeColourOffLeather(`${r.shoe.name} leather`, r.shoe.hex, "#000000")) {
        const shoeWhy = recipePoolRejection(slot(slots, "dressShoe"), row(`${r.shoe.name} leather derbies`, r.shoe.hex), ctx);
        assert.equal(shoeWhy, null, `${f.slug}: recipe shoe "${r.shoe.name}" ${r.shoe.hex}: ${shoeWhy}`);
      }
      const beltWhy = recipePoolRejection(slot(slots, "belt"), row(`${r.belt.name} leather belt`, r.belt.hex), ctx);
      assert.equal(beltWhy, null, `${f.slug}: recipe belt "${r.belt.name}" ${r.belt.hex}: ${beltWhy}`);
      const bottomTitle = `${r.bottom.name} cotton chinos`;
      const bottomRole: CapsuleWardrobeRole = isDarkAnchorPiece(bottomTitle, new Map([[bottomTitle, r.bottom.hex]]))
        ? "darkTrouser"
        : "casualTrouser";
      const bottomWhy = recipePoolRejection(
        slot(slots, bottomRole),
        row(bottomRole === "casualTrouser" && ctx.outdoorJeans ? `${r.bottom.name} slim jeans` : bottomTitle, r.bottom.hex),
        ctx,
      );
      assert.equal(bottomWhy, null, `${f.slug}: recipe bottom "${r.bottom.name}" ${r.bottom.hex} as ${bottomRole}: ${bottomWhy}`);
      const heroWhy = recipePoolRejection(slot(slots, "knit"), row(`${r.hero.name} merino crewneck jumper`, r.hero.hex), ctx);
      assert.equal(heroWhy, null, `${f.slug}: recipe hero "${r.hero.name}" ${r.hero.hex} at the face: ${heroWhy}`);
    }
  }
});

/* ---------------------------- leather etiquette agrees ---------------------------- */

test("dress shoes, belts and bags are leather colours in every layer; a loafer is leather or the palette's own swatch", () => {
  for (const f of FIXTURES) {
    const slots = slotsFor(f);
    const bestHexes = new Set(f.colors.best.map((c) => c.hex.toLowerCase()));
    for (const role of ["dressShoe", "belt", "bag"] as const) {
      const s = slot(slots, role);
      assert.ok(
        !shoeColourOffLeather(`${s.color.name} leather`, s.color.hex, "#000000"),
        `${f.slug}: capsule ${role} colour "${s.color.name}" is chromatic`,
      );
    }
    // The capsule's smart shoe may be a suede loafer in a palette colour — a
    // deliberate statement — but never a colour from outside the palette.
    const loafer = slot(slots, "loafer");
    assert.ok(
      !shoeColourOffLeather(`${loafer.color.name} leather`, loafer.color.hex, "#000000") ||
        bestHexes.has(loafer.color.hex.toLowerCase()),
      `${f.slug}: capsule loafer "${loafer.color.name}" is neither leather nor a palette swatch`,
    );
    for (const r of lookSetColorRecipes(f.colors.best, 6, { boldness: f.profile.boldness })) {
      assert.ok(
        !shoeColourOffLeather(`${r.belt.name} leather`, r.belt.hex, "#000000"),
        `${f.slug}: recipe belt "${r.belt.name}" ${r.belt.hex} is chromatic`,
      );
      assert.ok(
        !shoeColourOffLeather(`${r.shoe.name} leather`, r.shoe.hex, "#000000") || bestHexes.has(r.shoe.hex.toLowerCase()),
        `${f.slug}: recipe shoe "${r.shoe.name}" ${r.shoe.hex} is neither leather nor a palette swatch`,
      );
    }
  }
});

test("a chromatic loafer and belt in a look: the recipe layer corrects, the catalogue layer rejects", () => {
  const f = FIXTURES[0]!;
  const ctx = ctxFor(f);
  const slots = slotsFor(f);
  const recipe = lookSetColorRecipes(f.colors.best, 1, { boldness: "moderate", occasionIds: ["work"] })[0]!;
  const look = {
    description: "Dusty-blue crewneck knit, charcoal chinos, spruce suede loafers, spruce leather belt",
    items: [
      { garment: "crewneck knit", color: "dusty-blue" },
      { garment: "chinos", color: "charcoal" },
      { garment: "suede loafers", color: "spruce" },
      { garment: "leather belt", color: "spruce" },
    ],
  };
  const fixed = enforceRecipeBelt(enforceRecipeShoe(look, recipe, "work"), recipe);
  assert.doesNotMatch(fixed.items!.find((i) => /belt/.test(i.garment))!.color, /spruce/);
  assert.doesNotMatch(fixed.items!.find((i) => /loafers/.test(i.garment))!.color, /spruce/);
  const loaferWhy = recipePoolRejection(slot(slots, "loafer"), row("Spruce Suede Loafers", "#4a5d4a"), ctx);
  assert.ok(loaferWhy, "catalogue admitted spruce loafers");
  const beltWhy = recipePoolRejection(slot(slots, "belt"), row("Spruce Leather Belt", "#4a5d4a"), ctx);
  assert.ok(beltWhy, "catalogue admitted a spruce belt");
});

test("tan and cognac stay classic dress leather for every palette; golden / caramel do not", () => {
  for (const f of FIXTURES) {
    const ctx = ctxFor(f);
    const s = slot(slotsFor(f), "dressShoe");
    for (const [title, hex] of [["Tan Leather Derbies", "#a56a3a"], ["Cognac Leather Oxfords", "#8b4a2b"]] as const) {
      assert.ok(isClassicLeatherColour(title, hex), title);
      assert.equal(hitsAvoidPalette(title, hex, f.colors.avoid, { category: "Footwear", role: "dressShoe" }), false, `${f.slug}: ${title}`);
      assert.equal(recipePoolRejection(s, row(title, hex), ctx), null, `${f.slug}: ${title}`);
    }
    assert.equal(isClassicLeatherColour("Golden Brown Suede Loafers", "#b5804a"), false);
    assert.equal(isClassicLeatherColour("Caramel Leather Loafers", "#b5804a"), false);
  }
});

/* ---------------------------- near-face gates agree ---------------------------- */

test("a cool pastel at the face on a warm palette: gate flags it, catalogue rejects it, recipes never propose it", () => {
  for (const f of FIXTURES.filter((x) => x.profile.physical.undertone === "warm")) {
    const ctx = ctxFor(f);
    const knit = slot(slotsFor(f), "knit");
    const title = "Light Blue Merino Jumper";
    assert.equal(isCoolPastelNearFace(title, "#a9c4de"), true);
    const why = recipePoolRejection(knit, row(title, "#a9c4de"), ctx);
    assert.ok(why && /near-face:cool-pastel|avoid-palette/.test(why), `${f.slug}: ${why}`);
    for (const r of lookSetColorRecipes(f.colors.best, 6, { boldness: f.profile.boldness })) {
      assert.equal(isCoolPastelNearFace(r.hero.name, r.hero.hex), false, `${f.slug}: hero "${r.hero.name}" is a cool pastel`);
    }
  }
});

/* ------------------------------- repetition caps ------------------------------- */

test("no trouser colour carries more than two of six looks, for every shipped palette", () => {
  for (const f of FIXTURES) {
    const uses = new Map<string, number>();
    for (const r of lookSetColorRecipes(f.colors.best, 6, { boldness: f.profile.boldness })) {
      uses.set(r.bottom.hex, (uses.get(r.bottom.hex) ?? 0) + 1);
    }
    for (const [hex, n] of uses) assert.ok(n <= MAX_SAME_BOTTOM_PER_SET, `${f.slug}: ${hex} on ${n} looks`);
  }
});
