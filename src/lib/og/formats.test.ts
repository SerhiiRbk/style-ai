import assert from "node:assert/strict";
import test from "node:test";
import { parseVerticalFormat, VERTICAL_SIZE } from "./formats";

test("feed format is parsed and rendered at 1080 by 1350", () => {
  assert.equal(parseVerticalFormat("feed"), "feed");
  assert.deepEqual(VERTICAL_SIZE.feed, { width: 1080, height: 1350 });
});

test("unknown formats still fall back to the horizontal card", () => {
  assert.equal(parseVerticalFormat("square"), null);
});
