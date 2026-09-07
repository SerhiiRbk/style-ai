import assert from "node:assert/strict";
import test from "node:test";
import { recipePoolRejection, type RecipePoolContext, type RecipePoolSlot } from "./recipe-pool-rules";

const ctx = (over: Partial<RecipePoolContext> = {}): RecipePoolContext => ({
  undertone: "neutral",
  best: [{ hex: "#303444" }, { hex: "#e0e0d9" }, { hex: "#6e8ca6" }],
  bodyType: "triangle",
  outdoorJeans: false,
  avoid: [{ name: "Pure Black", hex: "#000000" }],
  ...over,
});
const casual: RecipePoolSlot = { role: "casualTrouser", category: "Trousers", color: { name: "Cool white", hex: "#e0e0d9" } };

test("drawstring trousers do not fill the casual slot unless the brief is outdoor / active (64510d11)", () => {
  const row = { title: "Valmonti Men’s Relaxed Corduroy Trousers Drawstring Everyday Fit", hay: "… White", hex: "#ffffff" };
  assert.equal(recipePoolRejection(casual, row, ctx()), "casual-trouser-drawstring");
  assert.equal(recipePoolRejection(casual, { ...row, title: "Slim Cotton Chinos", hay: "Slim Cotton Chinos White" }, ctx()), null);
  // An outdoor brief wants jeans there; a drawstring jean passes the drawstring rule.
  assert.equal(
    recipePoolRejection(casual, { title: "Relaxed Drawstring Jeans", hay: "Relaxed Drawstring Jeans", hex: "#e0e0d9" }, ctx({ outdoorJeans: true })),
    null,
  );
});

test("a tote fills the bag slot; a backpack does not", () => {
  const bag: RecipePoolSlot = { role: "bag", category: "Accessories", color: { name: "Navy grey", hex: "#303444" } };
  assert.equal(recipePoolRejection(bag, { title: "Zara Leather Tote", hay: "Zara Leather Tote Navy", hex: "#303444" }, ctx()), null);
  assert.equal(
    recipePoolRejection(bag, { title: "Canvas Rucksack", hay: "Canvas Rucksack Navy", hex: "#303444" }, ctx()),
    "bag-not-bag",
  );
});
