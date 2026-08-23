import assert from "node:assert/strict";
import test from "node:test";
import { humanizeProductTitle } from "@/lib/product-title";
import {
  LOOK_MATCH_VERSION,
  LOOK_RERANK_VERSION,
  lookItemsNeedRefresh,
} from "./look-match-version";

const title = humanizeProductTitle("Reserved Slim Fit Linen Shirt");

function item(over: {
  matchVersion?: number;
  rerankVersion?: number;
  similarPick?: boolean;
  title?: string;
} = {}) {
  return {
    title,
    similarPick: true as boolean | undefined,
    matchVersion: LOOK_MATCH_VERSION,
    ...over,
  };
}

test("current heuristic + implicit rerank version does not refresh", () => {
  assert.equal(
    lookItemsNeedRefresh({ 0: [item()] }),
    false,
  );
});

test("explicit current rerank version does not refresh", () => {
  assert.equal(
    lookItemsNeedRefresh({
      0: [item({ rerankVersion: LOOK_RERANK_VERSION })],
    }),
    false,
  );
});

test("stale heuristic version refreshes even when rerank is current", () => {
  assert.equal(
    lookItemsNeedRefresh({
      0: [
        item({
          matchVersion: LOOK_MATCH_VERSION - 1,
          rerankVersion: LOOK_RERANK_VERSION,
        }),
      ],
    }),
    true,
  );
});

test("stale rerank version refreshes even when heuristic is current", () => {
  assert.equal(
    lookItemsNeedRefresh({
      0: [
        item({
          matchVersion: LOOK_MATCH_VERSION,
          rerankVersion: LOOK_RERANK_VERSION - 1,
        }),
      ],
    }),
    true,
  );
});

test("missing similarPick or empty items still refresh", () => {
  assert.equal(lookItemsNeedRefresh(undefined), true);
  assert.equal(lookItemsNeedRefresh({}), true);
  assert.equal(
    lookItemsNeedRefresh({ 0: [item({ similarPick: undefined })] }),
    true,
  );
});
