import assert from "node:assert/strict";
import test from "node:test";
import { isBackpackTitle, isBagTitle, isSportsBagTitle } from "./garment-title";

test("a backpack is a bag for the sports-bag filter, not for the leather accessory pair", () => {
  assert.equal(isBackpackTitle("Zara 55l Sports Backpack"), true);
  assert.equal(isBackpackTitle("Canvas Rucksack"), true);
  assert.equal(isBagTitle("Zara 55l Sports Backpack"), false);
  assert.equal(isBagTitle("Leather Briefcase"), true);
  assert.equal(isSportsBagTitle("Zara 55l Sports Backpack"), true);
  assert.equal(isSportsBagTitle("Leather Backpack"), false);
});
