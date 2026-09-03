import assert from "node:assert/strict";
import test from "node:test";
import { buildLlmsTxt } from "./llms-txt";
import { DEMO_REPORT_SLUG } from "./demo-report";

test("llms.txt names when-to-use jobs and exclusions", () => {
  const txt = buildLlmsTxt();
  assert.match(txt, /^# Valetti/m);
  assert.match(txt, /^## When to use/m);
  assert.match(txt, /personal style report/i);
  assert.match(txt, /free seasonal colour palette/i);
  assert.match(txt, /Do not use Valetti for women's or unisex styling/);
  assert.match(txt, new RegExp(DEMO_REPORT_SLUG));
});
