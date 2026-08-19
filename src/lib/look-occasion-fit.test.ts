import assert from "node:assert/strict";
import test from "node:test";
import { lookOccasionIdFromContext } from "./look-contexts";
import {
  isOccasionCasualTrouserTitle,
  lookOccasionAppliesToGarment,
  lookOccasionIsTailored,
  lookOccasionQueryHint,
} from "./look-occasion-fit";

test("Work / meetings context resolves to work", () => {
  assert.equal(lookOccasionIdFromContext("Work / meetings"), "work");
  assert.equal(lookOccasionIdFromContext("work"), "work");
  assert.equal(lookOccasionIdFromContext("Weekend"), "weekend");
});

test("work and formal are tailored occasions", () => {
  assert.equal(lookOccasionIsTailored("work"), true);
  assert.equal(lookOccasionIsTailored("formal"), true);
  assert.equal(lookOccasionIsTailored("weekend"), false);
  assert.equal(lookOccasionAppliesToGarment("work", "chinos"), true);
  assert.equal(lookOccasionAppliesToGarment("work", "knit"), false);
});

test("linen relaxed trousers are casual unless the look asked for them", () => {
  assert.equal(
    isOccasionCasualTrouserTitle(
      "Cotton/linen Relaxed Fit Trousers",
      "sage cotton chinos",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualTrouserTitle("Cotton Chinos", "sage cotton chinos"),
    false,
  );
  assert.equal(
    isOccasionCasualTrouserTitle(
      "Linen Blend Trousers",
      "mushroom linen-blend trousers",
    ),
    false,
  );
  assert.equal(
    isOccasionCasualTrouserTitle("Relaxed Fit Chinos", "sage cotton chinos"),
    true,
  );
});

test("work query hint steers away from linen relaxed", () => {
  assert.match(lookOccasionQueryHint("work") ?? "", /not linen/i);
  assert.equal(lookOccasionQueryHint("weekend"), null);
});
