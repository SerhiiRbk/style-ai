/**
 * Golden set from real production reports (see scripts/extract-report-fixture.mjs).
 * Each fixture is a report that shipped with a defect we then fixed; the tests
 * replay the deterministic parts of the pipeline over the stored data and fail
 * if a defect comes back. Stored shopping was produced by the OLD code, so the
 * gate tests assert that today's gates *flag* those items, not that the list
 * is clean.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  capsuleColumnBlends,
  capsuleMatrix,
  hitsAvoidPalette,
  inferSwatchHex,
  investmentLevel,
  isClassicLeatherColour,
  isCoolPastelNearFace,
  isJacketTitle,
  isLoaferTitle,
  isNearFaceShoppingCategory,
  isShoeTitle,
  isOpticWhiteNearFace,
  priceOutlierThreshold,
  titleColourOverridesHex,
  isDrawstringTitle,
  isSportsBagTitle,
  lookAsksSportsBag,
  slotColourAdmitted,
} from "./style-extras";
import { recipePoolRejection } from "./recipe-pool-rules";
import {
  bottomContrastsHero,
  isSneakerOccasion,
  lookSetColorRecipes,
  SHOE_LIGHTER_THAN_TROUSERS_MAX,
} from "./look-set-color-recipes";
import { hexToHsl } from "./colour-palette";
import { wantedLookGarments } from "./look-wanted";
import { styleProfileSchema, type StyleProfile } from "./style-profile";
import type { ColorRec, ShoppingItem } from "./report";

type Fixture = {
  slug: string;
  profile: unknown;
  colors: { best: ColorRec[]; avoid: { name: string; hex: string }[] };
  shopping: ShoppingItem[];
  lookItems: Record<string, ShoppingItem[]>;
  looks: { idx: number; context: string; title: string; description: string; items: { garment: string; color?: string | null }[] | null }[];
};

function load(slug: string): Fixture & { profile: StyleProfile } {
  const raw = JSON.parse(
    readFileSync(fileURLToPath(new URL(`./fixtures/reports/${slug}.json`, import.meta.url)), "utf8"),
  ) as Fixture;
  return { ...raw, profile: styleProfileSchema.parse(raw.profile) };
}

const SLUGS = ["soft-summer-a111", "soft-autumn-f4b8", "deep-autumn-9674", "cool-summer-6451"] as const;
const FIXTURES = SLUGS.map(load);
const REPORT_CONTEXT_IDS = ["dinner", "weekend", "business_social", "work", "smart_casual", "travel"];
const CASUAL_OUTER_RE = /\b(shacket|overshirt|windbreaker|parka|puffer|bomber|hooded|quilted)\b/i;

/* ------------------------------ every fixture ------------------------------ */

for (const f of FIXTURES) {
  const colors = new Map(f.shopping.map((i) => [i.title, i.color]));
  const best = f.colors.best;

  test(`${f.slug}: capsule matrix has no top / bottom column`, () => {
    const combos = capsuleMatrix(f.shopping, f.profile, best);
    assert.ok(combos.length >= 4, `only ${combos.length} outfits`);
    for (const c of combos) {
      const top = c.pieces.find((p) => !isJacketTitle(p) && !isShoeTitle(p) && !/belt|bag|backpack|tote/i.test(p) && !/trousers|chinos|jeans/i.test(p));
      const bottom = c.pieces.find((p) => /trousers|chinos|jeans/i.test(p));
      if (!top || !bottom || !colors.has(top) || !colors.has(bottom)) continue;
      assert.equal(capsuleColumnBlends(top, bottom, colors, best), false, `${c.context}: ${top} + ${bottom}`);
    }
  });

  test(`${f.slug}: no piece is a uniform — jacket and each shirt on at most two outfits`, () => {
    const combos = capsuleMatrix(f.shopping, f.profile, best);
    const uses = new Map<string, number>();
    for (const c of combos) for (const p of c.pieces) uses.set(p, (uses.get(p) ?? 0) + 1);
    const dump = combos.map((c) => `${c.context}: ${c.pieces.join(" + ")}`).join(" | ");
    for (const it of f.shopping) {
      const n = uses.get(it.title) ?? 0;
      if (it.category === "Outerwear" && !CASUAL_OUTER_RE.test(it.title)) {
        assert.ok(n <= 2, `${it.title} (jacket) on ${n} outfits: ${dump}`);
      }
      if (it.category === "Shirts") assert.ok(n <= 2, `${it.title} (shirt) on ${n} outfits: ${dump}`);
    }
  });

  test(`${f.slug}: Date night is not the office after six`, () => {
    const combos = capsuleMatrix(f.shopping, f.profile, best);
    const date = combos.find((c) => c.context === "Date night");
    if (!date) return;
    const hasLoafer = f.shopping.some((i) => i.category === "Footwear" && isLoaferTitle(i.title));
    if (hasLoafer) {
      assert.ok(
        !date.pieces.some((p) => isShoeTitle(p) && /oxfords?|derb/i.test(p)),
        `cap-toe on a date: ${date.pieces.join(" + ")}`,
      );
    }
  });

  test(`${f.slug}: look recipes keep hero / bottom contrast and shoes no lighter than trousers`, () => {
    const recipes = lookSetColorRecipes(best, 6, {
      boldness: f.profile.boldness,
      occasionIds: REPORT_CONTEXT_IDS,
    });
    assert.equal(recipes.length, 6);
    recipes.forEach((r, i) => {
      assert.ok(bottomContrastsHero(r.hero, r.bottom), `${r.hero.name} over ${r.bottom.name}`);
      if (isSneakerOccasion(REPORT_CONTEXT_IDS[i])) return;
      const gap = hexToHsl(r.shoe.hex).l - hexToHsl(r.bottom.hex).l;
      assert.ok(gap <= SHOE_LIGHTER_THAN_TROUSERS_MAX + 1e-9, `${REPORT_CONTEXT_IDS[i]}: ${r.shoe.name} under ${r.bottom.name}`);
    });
  });

  test(`${f.slug}: palette's own dark neutrals never hit the avoid list`, () => {
    for (const c of best) {
      const { s, l } = hexToHsl(c.hex);
      if (l > 0.36 || s > 0.3) continue;
      assert.equal(
        hitsAvoidPalette(`${c.name} wool trousers`, c.hex, f.colors.avoid, { category: "Trousers" }),
        false,
        `${c.name} ${c.hex} flagged by its own avoid list`,
      );
    }
  });
}

/* ------------------------- known defects, per report ------------------------- */

function flaggedNearFace(f: Fixture & { profile: StyleProfile }): string[] {
  const warm = f.profile.physical.undertone === "warm";
  return f.shopping
    .filter((i) => isNearFaceShoppingCategory(i.category))
    .filter((i) => {
      const hay = `${i.title} ${i.colorName ?? ""}`;
      return (
        hitsAvoidPalette(hay, i.color, f.colors.avoid, { category: i.category }) ||
        (warm && isCoolPastelNearFace(hay, i.color))
      );
    })
    .map((i) => i.title);
}

test("deep-autumn-9674: the light-blue knit at the face is caught, the rest of the capsule passes", () => {
  const f = FIXTURES[2]!;
  assert.deepEqual(flaggedNearFace(f), ["Luciénte Pure Extra-Fine Merino Wool Classic Crewneck"]);
  // Optic white oxford is demoted for a warm palette (soft rule, still allowed).
  const cos = f.shopping.find((i) => /COS Oxford/.test(i.title))!;
  assert.equal(isOpticWhiteNearFace(`${cos.title} ${cos.colorName ?? ""}`, cos.color), true);
  // "Brown ... Oxford Shoes" stored as black: the title wins.
  const gs = f.shopping.find((i) => /Brown Genuine Leather Oxford/.test(i.title))!;
  assert.equal(titleColourOverridesHex(gs.title, gs.color), "#6F4E37");
  // No other item changes colour.
  const overridden = f.shopping.filter((i) => titleColourOverridesHex(i.title, i.color)).map((i) => i.title);
  assert.deepEqual(overridden, [gs.title]);
});

test("soft-autumn-f4b8: a shirt filed as 'light-blue oxford' + 'shirt' is matched, not wanted", () => {
  const f = FIXTURES[1]!;
  const work = f.looks.find((l) => /work/i.test(l.context))!;
  const wanted = wantedLookGarments(f.lookItems[String(work.idx)] ?? [], work.items);
  assert.ok(!wanted.some((w) => /shirt/i.test(w.garment)), wanted.map((w) => `${w.color} ${w.garment}`).join(", "));
  assert.deepEqual(flaggedNearFace(f), []);
});

test("soft-summer-a111: after the rematch the capsule has no placeholder-colour hero and no avoid leather", () => {
  const f = FIXTURES[0]!;
  // Every piece has a real swatch — the beige blazer with #CCCCCC that headed the
  // first version of this report cannot come back as a hero.
  for (const i of f.shopping) {
    assert.notEqual(inferSwatchHex(i.title, i.color), "#CCCCCC", `${i.title} has no usable colour`);
  }
  // Historic rows this report shipped with — the gates must still catch them.
  assert.notEqual(inferSwatchHex("Wam Denim The Corlan Light Beige Blazer", "#CCCCCC"), "#CCCCCC");
  assert.equal(isClassicLeatherColour("Reserved Leather Derby Shoes golden brown", "#B3733B"), false);
  assert.equal(
    hitsAvoidPalette("Reserved Leather Derby Shoes golden brown", "#B3733B", f.colors.avoid, { category: "Footwear", role: "dressShoe" }),
    true,
  );
  // The rematched derby is a true brown — classic dress leather passes.
  const derby = f.shopping.find((i) => /Leather Derby Shoes/.test(i.title))!;
  assert.equal(
    hitsAvoidPalette(`${derby.title} ${derby.colorName ?? ""}`, derby.color, f.colors.avoid, { category: "Footwear", role: "dressShoe" }),
    false,
  );
  // Price outlier: the sneakers still sit far above the rest of the list (no in-band alternative existed).
  const sneakers = f.shopping.find((i) => /Patina Sneakers/.test(i.title))!;
  const others = f.shopping.filter((i) => i !== sneakers).map((i) => i.priceEur);
  assert.ok(sneakers.priceEur > priceOutlierThreshold(others));
  // Tiers follow price, not category.
  const shacket = f.shopping.find((i) => /Shacket/.test(i.title))!;
  assert.equal(investmentLevel(shacket), "Core");
  // The capsule of this report: the pink shirt and the blazer at most twice each, the casual pieces in use.
  const combos = capsuleMatrix(f.shopping, f.profile, f.colors.best);
  const pink = combos.filter((c) => c.pieces.some((p) => /Washed Relaxed Fit Shirt/.test(p))).length;
  assert.ok(pink <= 2, `pink shirt on ${pink} outfits`);
  assert.ok(combos.some((c) => c.pieces.some((p) => /Shacket|Sneakers/.test(p))));
});

test("cool-summer-6451: today's gates flag the drawstring whites, sports backpack and oatmeal polo", () => {
  const f = FIXTURES[3]!;
  const cords = f.shopping.find((i) => /Drawstring/.test(i.title));
  assert.ok(cords, "fixture lost the white drawstring cords");
  assert.equal(isDrawstringTitle(cords.title), true);
  assert.equal(
    recipePoolRejection(
      { role: "casualTrouser", category: "Trousers", color: { name: "Cool white", hex: "#e0e0d9" } },
      { title: cords.title, hay: `${cords.title} ${cords.colorName ?? ""}`, hex: cords.color },
      {
        undertone: f.profile.physical.undertone,
        best: f.colors.best,
        bodyType: f.profile.physical.bodyType,
        outdoorJeans: false,
        avoid: f.colors.avoid,
      },
    ),
    "casual-trouser-drawstring",
  );
  assert.equal(isSportsBagTitle("Zara 55l Sports Backpack"), true);
  assert.equal(lookAsksSportsBag("slate backpack"), false);
  assert.equal(lookAsksSportsBag("Travel / transitional"), false);
  assert.equal(
    slotColourAdmitted("cool-white", "Zara Regular Fit Textured Knit Polo Shirt", {
      productHex: "#D8CFB8",
    }),
    false,
  );
  const knit = f.shopping.find((i) => /Luciénte/.test(i.title));
  assert.ok(knit);
  assert.equal(titleColourOverridesHex(knit.title, knit.color, knit.colorName), "#AEC7DE");
});
