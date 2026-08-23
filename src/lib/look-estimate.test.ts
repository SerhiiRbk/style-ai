import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateMatchesLook,
  lookEstimateFingerprint,
  parseLookEstimate,
  parseLookEstimates,
} from "./look-estimate";

const opinion = {
  verdict: "good" as const,
  headline: "Navy holds the plum brief",
  body: "The unstructured navy blazer keeps evening polish without the pastel trap. Grey knit and petrol chinos stay in the same temperature.",
  pairWith: ["black suede loafers", "slim leather belt"],
};

test("lookEstimateFingerprint changes when the brief or a SKU changes", () => {
  const items = [{ productId: "blazer-1", category: "Blazers", title: "Navy" }];
  const a = lookEstimateFingerprint("soft plum blazer", items);
  const b = lookEstimateFingerprint("navy blazer", items);
  const c = lookEstimateFingerprint("soft plum blazer", [
    { productId: "blazer-2", category: "Blazers", title: "Navy" },
  ]);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(estimateMatchesLook({ opinion, fingerprint: a, savedAt: "t" }, a), true);
  assert.equal(estimateMatchesLook({ opinion, fingerprint: a, savedAt: "t" }, b), false);
});

test("parseLookEstimate rejects a missing verdict and keeps pairWith", () => {
  assert.equal(parseLookEstimate({ fingerprint: "x" }), null);
  const stored = parseLookEstimate({
    opinion,
    fingerprint: "brief\nid",
    savedAt: "2026-08-23T12:00:00.000Z",
  });
  assert.equal(stored?.opinion.verdict, "good");
  assert.deepEqual(stored?.opinion.pairWith, [
    "black suede loafers",
    "slim leather belt",
  ]);
});

test("parseLookEstimates ignores junk keys", () => {
  const map = parseLookEstimates({
    1: { opinion, fingerprint: "a" },
    nope: { opinion, fingerprint: "b" },
    2: { headline: "no wrapper" },
  });
  assert.equal(Object.keys(map).join(","), "1");
  assert.equal(map[1]?.fingerprint, "a");
});
