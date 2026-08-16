import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSTRUCTOR_TYPES,
  slotsFromLook,
} from "./look-constructor";

test("constructor Trousers types include shorts", () => {
  assert.ok(CONSTRUCTOR_TYPES.Trousers.some((t) => t.id === "shorts"));
});

test("slotsFromLook keeps charcoal shorts as the bottoms type", () => {
  const slots = slotsFromLook(
    "Terrace at Dusk",
    "Soft teal linen camp-collar shirt, soft charcoal tailored linen shorts, greige suede loafers, sage canvas belt.",
  );
  const bottoms = slots.find((s) => s.category === "Trousers");
  assert.ok(bottoms, "expected a Trousers slot");
  assert.equal(bottoms?.garment, "shorts");
  assert.match(bottoms?.color ?? "", /charcoal/);
});
