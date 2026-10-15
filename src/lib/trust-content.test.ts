import assert from "node:assert/strict";
import test from "node:test";
import {
  TRUST_DELETE_HREF,
  TRUST_INTRO,
  TRUST_SECTIONS,
  TRUST_TITLE,
} from "./trust-content";

test("trust page is short, names Article 9, and points at one-click delete", () => {
  assert.match(TRUST_TITLE, /photos/i);
  assert.match(TRUST_INTRO, /do not train/i);
  assert.equal(TRUST_DELETE_HREF, "/account#photos");
  const ids = TRUST_SECTIONS.map((s) => s.id);
  assert.deepEqual(ids, ["what-we-do", "what-we-dont", "gdpr", "delete"]);
  const gdpr = TRUST_SECTIONS.find((s) => s.id === "gdpr");
  assert.match(gdpr?.body ?? "", /Article 9/);
  assert.match(gdpr?.body ?? "", /explicit consent/i);
});
