import assert from "node:assert/strict";
import test from "node:test";
import { pickAdmittedMatch, type LookMatchRow } from "./look-match-rank";

function row(id: string, title: string, color = "Navy"): LookMatchRow {
  return {
    id,
    source: "test",
    brand: "Test",
    title,
    color,
    color_hex: "#28324A",
    price_eur: 80,
    deeplink: "https://example.com",
    image_url: null,
    similarity: 0.9,
  };
}

test("work looks drop a sport blazer even when it is the only jacket", () => {
  const sport = row("s", "Reserved Sport Blazer", "Grey");
  assert.equal(
    pickAdmittedMatch([sport], "navy", "blazer", "moderate", "navy blazer", null, "work"),
    null,
  );

  const navy = row("n", "Navy Tailored Blazer");
  const picked = pickAdmittedMatch(
    [sport, navy],
    "navy",
    "blazer",
    "moderate",
    "navy blazer",
    null,
    "work",
  );
  assert.equal(picked?.row.id, "n");
});

test("work looks still accept a sport coat", () => {
  const coat = row("c", "Reiss Wool Sport Coat");
  const picked = pickAdmittedMatch(
    [coat],
    "navy",
    "blazer",
    "moderate",
    "navy sport coat",
    null,
    "work",
  );
  assert.equal(picked?.row.id, "c");
});

test("smart casual teal overshirt prefers a blue overshirt over a navy blazer", () => {
  const blazer = row("b", "Navy Tailored Blazer");
  const overshirt = row("o", "Regular Fit Denim Overshirt", "Pastel blue");
  overshirt.color_hex = "#2F4B7C";
  const picked = pickAdmittedMatch(
    [blazer, overshirt],
    "soft-teal",
    "overshirt",
    "moderate",
    "soft-teal overshirt",
    null,
    "smart_casual",
  );
  assert.equal(picked?.row.id, "o");
});

test("smart casual greige messenger may take a brown briefcase", () => {
  const weekender = row("w", "Nappa Leather Detail Travel Bag", "Greige");
  weekender.color_hex = "#DAD3C6";
  const brief = row("b", "Textured Briefcase", "Brown");
  brief.color_hex = "#6F4E37";
  const picked = pickAdmittedMatch(
    [weekender, brief],
    "greige",
    "messenger bag",
    "moderate",
    "greige canvas messenger bag",
    null,
    "smart_casual",
  );
  assert.equal(picked?.row.id, "b");
});
