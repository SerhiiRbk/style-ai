import assert from "node:assert/strict";
import test from "node:test";
import { composeLookBrief } from "./look-brief";

const BRIEF = "A relaxed weekend outfit for running errands.";
const BOLDNESS_VALUES = ["conservative", "moderate", "experimental", "statement"] as const;

test("omitting both boldness and season leaves the brief unchanged", () => {
  assert.equal(composeLookBrief(BRIEF), BRIEF);
  assert.equal(composeLookBrief(BRIEF, {}), BRIEF);
});

test("season alone prepends a season line and keeps the brief intact", () => {
  const result = composeLookBrief(BRIEF, { season: "winter" });
  assert.match(result, /Season: winter/);
  assert.ok(result.endsWith(BRIEF), "original brief text must be preserved verbatim");
});

for (const boldness of BOLDNESS_VALUES) {
  test(`strictness phrase is prepended for boldness="${boldness}"`, () => {
    const result = composeLookBrief(BRIEF, { boldness });
    assert.match(result, new RegExp(`Strictness: ${boldness}`));
    assert.ok(result.endsWith(BRIEF), "original brief text must be preserved verbatim");
  });
}

test("season + strictness compose together, season first", () => {
  const result = composeLookBrief(BRIEF, { boldness: "statement", season: "summer" });
  assert.match(result, /^Season: summer/, "season line should lead");
  assert.match(result, /Strictness: statement/);
  assert.ok(result.endsWith(BRIEF));
  assert.ok(
    result.indexOf("Season:") < result.indexOf("Strictness:"),
    "season note must precede the strictness note",
  );
});

test("the four boldness strictness phrases are all distinct", () => {
  const phrases = BOLDNESS_VALUES.map(
    (b) => composeLookBrief(BRIEF, { boldness: b }).replace(BRIEF, ""),
  );
  assert.equal(new Set(phrases).size, phrases.length, "each Boldness value must yield a distinct strictness phrase");
});
