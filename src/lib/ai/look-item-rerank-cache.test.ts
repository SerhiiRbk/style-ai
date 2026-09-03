import assert from "node:assert/strict";
import test from "node:test";
import { LOOK_RERANK_VERSION } from "@/lib/look-match-version";
import {
  loadOrComputeRerank,
  memoryRerankStore,
  rerankCacheKey,
  type RerankCacheInput,
} from "./look-item-rerank-cache";

const base: RerankCacheInput = {
  lookTitle: "Teal Summer Authority",
  lookDescription: "Muted teal linen shirt, oatmeal chinos",
  paletteHints: "soft autumn",
  styleId: null,
  occasionId: "work",
  slots: [
    { slot: 0, candidateIds: ["shirt-blue", "shirt-grey", "shirt-sage"] },
    { slot: 1, candidateIds: ["chino-buff", "wool-brown"] },
  ],
};

test("same look and same top-8 ids share a cache key", () => {
  assert.equal(rerankCacheKey(base), rerankCacheKey({ ...base }));
});

test("a different top-8 set or order changes the key", () => {
  const swapped = rerankCacheKey({
    ...base,
    slots: [
      { slot: 0, candidateIds: ["shirt-grey", "shirt-blue", "shirt-sage"] },
      base.slots[1],
    ],
  });
  const extra = rerankCacheKey({
    ...base,
    slots: [
      { slot: 0, candidateIds: ["shirt-blue", "shirt-grey", "shirt-navy"] },
      base.slots[1],
    ],
  });
  assert.notEqual(rerankCacheKey(base), swapped);
  assert.notEqual(rerankCacheKey(base), extra);
});

test("look copy, occasion, and rerank version are part of the key", () => {
  assert.notEqual(
    rerankCacheKey(base),
    rerankCacheKey({ ...base, lookDescription: "Sage linen shirt" }),
  );
  assert.notEqual(
    rerankCacheKey(base),
    rerankCacheKey({ ...base, occasionId: "weekend" }),
  );
  assert.notEqual(
    rerankCacheKey(base),
    rerankCacheKey({ ...base, rerankVersion: LOOK_RERANK_VERSION + 1 }),
  );
});

test("loadOrCompute skips the paid compute on a cache hit", async () => {
  const store = memoryRerankStore<
    { slot: number; candidateIndex: number; similarPick: boolean }[]
  >();
  const key = rerankCacheKey(base);
  let calls = 0;
  const compute = async () => {
    calls += 1;
    return [{ slot: 0, candidateIndex: 0, similarPick: false }];
  };

  const first = await loadOrComputeRerank(key, compute, store);
  const second = await loadOrComputeRerank(key, compute, store);

  assert.deepEqual(first, second);
  assert.equal(calls, 1);
});

test("a failed compute is not cached", async () => {
  const store = memoryRerankStore<
    { slot: number; candidateIndex: number; similarPick: boolean }[]
  >();
  const key = rerankCacheKey(base);
  let calls = 0;

  const miss = await loadOrComputeRerank(key, async () => {
    calls += 1;
    return null;
  }, store);
  const hit = await loadOrComputeRerank(key, async () => {
    calls += 1;
    return [{ slot: 0, candidateIndex: 1, similarPick: true }];
  }, store);

  assert.equal(miss, null);
  assert.equal(hit?.[0]?.candidateIndex, 1);
  assert.equal(calls, 2);
});
