import assert from "node:assert/strict";
import test from "node:test";
import {
  LOOK_STYLE_FIT_IDS,
  lookStyleFitScore,
  lookStyleHasFit,
  lookStyleIsVeto,
  lookStyleQueryHint,
  lookStyleRerankHint,
} from "./look-style-fit";

test("only the five high-signal styles have recipes", () => {
  assert.deepEqual(
    [...LOOK_STYLE_FIT_IDS].sort(),
    ["breton", "city_formal", "heritage_knit", "open_knit", "rive_gauche"].sort(),
  );
  assert.equal(lookStyleHasFit("atelier"), false);
  assert.equal(lookStyleHasFit("riviera"), false);
  assert.equal(lookStyleHasFit("nordic"), false);
  assert.equal(lookStyleHasFit(null), false);
});

test("atelier and unknown styles score 0 and never veto", () => {
  const mariniere = { title: "Saint James Marinière Stripe Knit" };
  assert.equal(lookStyleFitScore("atelier", mariniere), 0);
  assert.equal(lookStyleFitScore("unknown", mariniere), 0);
  assert.equal(lookStyleIsVeto("atelier", { title: "Safari Jacket" }), false);
  assert.equal(lookStyleQueryHint("atelier"), null);
  assert.equal(lookStyleRerankHint("atelier"), null);
});

test("Breton boosts marinière / caban / maritime stripe, not pinstripe", () => {
  assert.equal(
    lookStyleFitScore("breton", { title: "Saint James Marinière Knit" }),
    1,
  );
  assert.equal(lookStyleFitScore("breton", { title: "Navy Caban Coat" }), 1);
  assert.equal(lookStyleFitScore("breton", { title: "Striped Cotton Knit" }), 1);
  assert.equal(lookStyleFitScore("breton", { title: "Pinstripe Oxford Shirt" }), 0);
  assert.equal(lookStyleFitScore("breton", { title: "Fine Merino Crew" }), 0);
});

test("Breton vetoes safari / gurkha / seersucker unless the title also boosts", () => {
  assert.equal(lookStyleIsVeto("breton", { title: "Safari Jacket" }), true);
  assert.equal(lookStyleIsVeto("breton", { title: "Gurkha Linen Trousers" }), true);
  assert.equal(lookStyleIsVeto("breton", { title: "Seersucker Shirt" }), true);
  assert.equal(lookStyleIsVeto("breton", { title: "Navy Caban" }), false);
});

test("Rive Gauche boosts roll-neck and trench, vetoes gurkha and sneakers", () => {
  assert.equal(
    lookStyleFitScore("rive_gauche", { title: "Fine Merino Roll-Neck" }),
    1,
  );
  assert.equal(lookStyleFitScore("rive_gauche", { title: "Cotton Trench Coat" }), 1);
  assert.equal(lookStyleFitScore("rive_gauche", { title: "Fine Merino Crew" }), 0);
  assert.equal(lookStyleIsVeto("rive_gauche", { title: "Gurkha Trousers" }), true);
  assert.equal(lookStyleIsVeto("rive_gauche", { title: "Leather Sneakers" }), true);
  assert.equal(lookStyleIsVeto("rive_gauche", { title: "Suede Derbies" }), false);
});

test("Heritage knit boosts Fair Isle / Shetland / shawl, vetoes crochet", () => {
  assert.equal(
    lookStyleFitScore("heritage_knit", { title: "Fair Isle Crew Jumper" }),
    1,
  );
  assert.equal(
    lookStyleFitScore("heritage_knit", { title: "Shetland Wool Sweater" }),
    1,
  );
  assert.equal(
    lookStyleFitScore("heritage_knit", { title: "Shawl-Collar Cardigan" }),
    1,
  );
  assert.equal(
    lookStyleFitScore("heritage_knit", { title: "Fisherman Rib Knit" }),
    1,
  );
  assert.equal(lookStyleIsVeto("heritage_knit", { title: "Crochet Shirt" }), true);
  assert.equal(lookStyleIsVeto("heritage_knit", { title: "Mesh Polo" }), true);
});

test("City formal boosts oxford / derby, vetoes camp-collar and Belgian loafers", () => {
  assert.equal(lookStyleFitScore("city_formal", { title: "Oxford Cloth Shirt" }), 1);
  assert.equal(lookStyleFitScore("city_formal", { title: "Leather Derbies" }), 1);
  assert.equal(lookStyleFitScore("city_formal", { title: "Worsted Trousers" }), 1);
  assert.equal(lookStyleIsVeto("city_formal", { title: "Camp-Collar Shirt" }), true);
  assert.equal(
    lookStyleIsVeto("city_formal", { title: "Belgian Loafers" }),
    true,
  );
});

test("City formal does not boost a relaxed or viscose shirt just because it says poplin", () => {
  assert.equal(
    lookStyleFitScore("city_formal", { title: "Zara Relaxed Fit Poplin Shirt" }),
    0,
  );
  assert.equal(
    lookStyleIsVeto("city_formal", { title: "Zara Relaxed Fit Poplin Shirt" }),
    true,
  );
  assert.equal(
    lookStyleIsVeto("city_formal", {
      title: "Reserved Comfort Fit Shirt",
      materialFamily: "viscose",
      fit: "relaxed",
    }),
    true,
  );
  assert.equal(
    lookStyleFitScore("city_formal", { title: "Regular Fit Poplin Shirt" }),
    1,
  );
  assert.equal(
    lookStyleIsVeto("city_formal", {
      title: "Reserved Regular Fit Cotton Shirt",
      description: "low stand up collar, short sleeves, patch chest pocket",
    }),
    true,
  );
  assert.equal(
    lookStyleFitScore("city_formal", { title: "Zara Poplin Check Shirt" }),
    0,
  );
  assert.equal(
    lookStyleIsVeto("city_formal", { title: "Zara Poplin Check Shirt" }),
    true,
  );
});

test("Open knit boosts mesh / crochet and vetoes Shetland", () => {
  assert.equal(lookStyleFitScore("open_knit", { title: "Crochet Camp Shirt" }), 1);
  assert.equal(lookStyleFitScore("open_knit", { title: "Open-Knit Polo" }), 1);
  assert.equal(lookStyleIsVeto("open_knit", { title: "Shetland Crew" }), true);
  assert.equal(lookStyleIsVeto("open_knit", { title: "Fair Isle Jumper" }), true);
});

test("pattern / subtype fields count as well as the title", () => {
  assert.equal(
    lookStyleFitScore("breton", { title: "Cotton Knit", pattern: "stripe" }),
    1,
  );
  assert.equal(
    lookStyleFitScore("rive_gauche", {
      title: "Merino Knit",
      garmentSubtype: "turtleneck",
    }),
    1,
  );
});

test("query and rerank hints exist for recipe styles", () => {
  assert.match(lookStyleQueryHint("breton") ?? "", /marinière|caban/i);
  assert.match(lookStyleRerankHint("rive_gauche") ?? "", /roll-neck/i);
});
