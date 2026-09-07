import assert from "node:assert/strict";
import test from "node:test";
import { reasonIsSafe } from "../shopping-reason-guard";

const SUMMER_AVOID = [
  { name: "Pure Black", hex: "#000000" },
  { name: "Golden Yellow", hex: "#F4C430" },
];

test("reasonIsSafe still rejects a material the title does not have", () => {
  assert.equal(
    reasonIsSafe(
      "A sleek linen oxford that lifts your soft summer colouring without shouting.",
      { title: "Navy merino crewneck", color: "#C3C3C3" },
    ),
    false,
  );
});

test("reasonIsSafe rejects copy that sells an avoid colour as a palette pick", () => {
  assert.equal(
    reasonIsSafe(
      "Black derby shoes ground experimental outfits and sit in your summer palette.",
      { title: "Gentleman Shoe Leather Derby Shoes", color: "#111111" },
      SUMMER_AVOID,
    ),
    false,
  );
  assert.equal(
    reasonIsSafe(
      "A golden yellow knit brightens your complexion and belongs in your best colours.",
      { title: "Geometric ribbed jumper", color: "#E8C84A" },
      SUMMER_AVOID,
    ),
    false,
  );
});

test("reasonIsSafe allows black or brown dress shoes framed as office etiquette", () => {
  assert.equal(
    reasonIsSafe(
      "A black leather derby is the classic office shoe — it follows tailoring etiquette, not seasonal colour.",
      { title: "Gentleman Shoe Leather Derby Shoes", color: "#111111" },
      SUMMER_AVOID,
    ),
    true,
  );
  assert.equal(
    reasonIsSafe(
      "Brown oxfords are the other half of business dress codes — wear them with navy trousers and a matching belt.",
      { title: "Brown leather oxfords", color: "#4A3526" },
      SUMMER_AVOID,
    ),
    true,
  );
});
