import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSTRUCTOR_TYPES,
  TIE_TYPES,
  canonicalTieType,
  composeLookDescription,
  slotsFromLook,
} from "./look-constructor";

test("constructor Trousers types include shorts", () => {
  assert.ok(CONSTRUCTOR_TYPES.Trousers.some((t) => t.id === "shorts"));
});

test("constructor Accessories include pocket square and neckerchief", () => {
  const ids = CONSTRUCTOR_TYPES.Accessories.map((t) => t.id);
  assert.ok(ids.includes("pocket square"), `missing pocket square: ${ids.join(",")}`);
  assert.ok(ids.includes("neckerchief"), `missing neckerchief: ${ids.join(",")}`);
});

test("constructor tie types include bolo", () => {
  assert.ok(TIE_TYPES.some((t) => t.id === "bolo"));
  assert.equal(canonicalTieType("black leather bolo tie"), "bolo");
});

test("slotsFromLook keeps pocket square and neckerchief as accessories", () => {
  const slots = slotsFromLook(
    "Riviera Ease",
    "Sage linen shirt, navy linen trousers, mushroom suede loafers, teal linen pocket square, ivory silk neckerchief.",
  );
  const accessories = slots.filter((s) => s.category === "Accessories");
  assert.ok(
    accessories.some((s) => s.garment === "pocket square"),
    `missing pocket square: ${accessories.map((s) => s.garment).join(",")}`,
  );
  assert.ok(
    accessories.some((s) => s.garment === "neckerchief"),
    `missing neckerchief: ${accessories.map((s) => s.garment).join(",")}`,
  );
});

test("slotsFromLook maps a neck scarf to neckerchief, not a winter scarf", () => {
  const slots = slotsFromLook(
    "Open Collar",
    "White oxford shirt, stone chinos, brown loafers, sage silk neck scarf.",
  );
  const accessories = slots.filter((s) => s.category === "Accessories");
  assert.equal(accessories.length, 1);
  assert.equal(accessories[0]?.garment, "neckerchief");
});

test("slotsFromLook reads a bolo as a tie cut", () => {
  const slots = slotsFromLook(
    "Ranch Evening",
    "Ivory western shirt, dark brown trousers, cognac boots, black bolo tie.",
  );
  const tie = slots.find((s) => s.garment === "tie");
  assert.ok(tie, "expected a tie slot");
  assert.equal(tie?.tieType, "bolo");
});

test("composeLookDescription names bolo and neckerchief", () => {
  const text = composeLookDescription([
    { category: "Shirts", garment: "shirt", color: "ivory" },
    { category: "Accessories", garment: "tie", color: "black", tieType: "bolo" },
    { category: "Accessories", garment: "neckerchief", color: "sage" },
    { category: "Accessories", garment: "pocket square", color: "teal" },
  ]);
  assert.match(text, /bolo/);
  assert.match(text, /neckerchief/);
  assert.match(text, /pocket square/);
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
