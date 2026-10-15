import assert from "node:assert/strict";
import test from "node:test";
import {
  COLOURS_CTA,
  FREE_PAID_BOUNDARY,
  SIGNUP_CREDITS_LINE,
} from "./launch-copy";

test("free/paid boundary names diagnosis vs the report, not more colours", () => {
  assert.match(FREE_PAID_BOUNDARY, /season and palette/i);
  assert.match(FREE_PAID_BOUNDARY, /puts them on you/i);
  assert.match(FREE_PAID_BOUNDARY, /what to buy/i);
  assert.doesNotMatch(FREE_PAID_BOUNDARY, /more colours/i);
  assert.equal(COLOURS_CTA, "See it on you");
});

test("signup line keeps Starter + try-on, not a free Lookbook", () => {
  assert.match(SIGNUP_CREDITS_LINE, /6 credits/);
  assert.match(SIGNUP_CREDITS_LINE, /Starter Report/);
  assert.match(SIGNUP_CREDITS_LINE, /Lookbook is paid/);
});
