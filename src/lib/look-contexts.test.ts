import assert from "node:assert/strict";
import test from "node:test";
import { LOOK_CONTEXTS, lookContextById } from "./look-contexts";

// BACKWARD COMPAT: the existing single "extra look" add-on and every stored
// `looks.context` value depend on the shipped ids. They MUST survive.
const SHIPPED = ["work", "smart_casual", "weekend", "dinner", "formal", "travel"];
// New occasions Create-a-Look needs that aren't already represented.
const ADDED = ["business_social", "wedding_guest", "party", "cultural", "resort", "outdoor"];

test("shipped occasion ids are preserved (do not break look-extra)", () => {
  const ids = new Set(LOOK_CONTEXTS.map((c) => c.id));
  for (const id of SHIPPED) assert.ok(ids.has(id), `removed shipped id: ${id}`);
});

test("new Create-a-Look occasions are present", () => {
  const ids = new Set(LOOK_CONTEXTS.map((c) => c.id));
  for (const id of ADDED) assert.ok(ids.has(id), `missing ${id}`);
});

test("every occasion has a non-trivial brief", () => {
  for (const c of LOOK_CONTEXTS)
    assert.ok(c.brief.length > 20, `thin brief: ${c.id}`);
});

test("dinner/date brief signals approachable, not formal", () => {
  // `dinner` already carries the date intent ("Dinner / date") — no new `date` id.
  assert.match(lookContextById("dinner")!.brief, /approachable|confiden|attract|relaxed|evening/i);
});
