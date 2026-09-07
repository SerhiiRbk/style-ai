import assert from "node:assert/strict";
import test from "node:test";
import { wantedLookGarments } from "./look-wanted";

const LOOK_ITEMS = [
  { garment: "cotton overshirt", color: "soft-teal" },
  { garment: "tailored trousers", color: "mushroom" },
  { garment: "leather loafers", color: "slate-blue" },
  { garment: "leather belt", color: "soft-charcoal" },
  { garment: "leather messenger bag", color: "greige" },
];

test("wantedLookGarments names the slots no pick filled", () => {
  const matched = [
    { garment: "trousers" },
    { garment: "loafers" },
    { garment: "belt" },
  ];
  const wanted = wantedLookGarments(matched, LOOK_ITEMS);
  assert.deepEqual(
    wanted.map((w) => w.garment),
    ["cotton overshirt", "leather messenger bag"],
  );
});

test("wantedLookGarments: a shirt pick does not cover the overshirt", () => {
  const wanted = wantedLookGarments(
    [{ garment: "shirt" }, { garment: "trousers" }, { garment: "loafers" }, { garment: "belt" }, { garment: "messenger" }],
    LOOK_ITEMS,
  );
  assert.deepEqual(wanted.map((w) => w.garment), ["cotton overshirt"]);
});

test("wantedLookGarments stays silent for legacy picks without slot info", () => {
  assert.deepEqual(wantedLookGarments([{}, {}], LOOK_ITEMS), []);
  assert.deepEqual(wantedLookGarments([{ garment: "belt" }], null), []);
});

test("wantedLookGarments: no picks means every structured slot is wanted", () => {
  assert.deepEqual(
    wantedLookGarments([], LOOK_ITEMS).map((w) => w.garment),
    LOOK_ITEMS.map((i) => i.garment),
  );
});

test("wantedLookGarments: a mauve blazer with no pick is wanted (64510d11)", () => {
  const wanted = wantedLookGarments(
    [
      { garment: "shirt" },
      { garment: "chinos" },
      { garment: "loafers" },
      { garment: "belt" },
      { garment: "tie" },
    ],
    [
      { color: "mauve", garment: "blazer" },
      { color: "cool-white", garment: "shirt" },
      { color: "spruce", garment: "chinos" },
      { color: "slate", garment: "loafers" },
      { color: "navy-grey", garment: "belt" },
      { color: "cool-rose", garment: "tie" },
    ],
  );
  assert.deepEqual(wanted.map((w) => w.garment), ["blazer"]);
});

test("wantedLookGarments: a descriptor filed under colour still covers the slot", () => {
  // Report f4b8e202: items said {color: "light-blue oxford", garment: "shirt"},
  // the matcher keyed the slot "oxford" — the shirt is matched, not wanted.
  const wanted = wantedLookGarments(
    [{ garment: "oxford" }, { garment: "trousers" }, { garment: "oxfords" }, { garment: "belt" }, { garment: "pocket square" }],
    [
      { color: "olive wool", garment: "blazer" },
      { color: "light-blue oxford", garment: "shirt" },
      { color: "oatmeal wool", garment: "trousers" },
      { color: "coffee leather", garment: "oxfords" },
      { color: "coffee leather", garment: "belt" },
      { color: "soft-rust", garment: "pocket square" },
      { color: "warm-grey leather", garment: "briefcase" },
    ],
  );
  assert.deepEqual(wanted.map((w) => w.garment), ["blazer", "briefcase"]);
});
