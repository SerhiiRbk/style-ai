import assert from "node:assert/strict";
import test from "node:test";
import { catalogGenderAllowed } from "./catalog-gender";

test("men filter keeps men, unisex, and Any / unstated", () => {
  assert.equal(catalogGenderAllowed("men", "men"), true);
  assert.equal(catalogGenderAllowed("unisex", "men"), true);
  assert.equal(catalogGenderAllowed(null, "men"), true);
  assert.equal(catalogGenderAllowed(undefined, "men"), true);
  assert.equal(catalogGenderAllowed("", "men"), true);
  assert.equal(catalogGenderAllowed("any", "men"), true);
  assert.equal(catalogGenderAllowed("unstated", "men"), true);
  assert.equal(catalogGenderAllowed("Any", "men"), true);
});

test("men filter still drops women and kids", () => {
  assert.equal(catalogGenderAllowed("women", "men"), false);
  assert.equal(catalogGenderAllowed("kids", "men"), false);
});

test("no filter keeps every gender", () => {
  assert.equal(catalogGenderAllowed("women", null), true);
  assert.equal(catalogGenderAllowed("kids", undefined), true);
});
