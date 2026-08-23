import assert from "node:assert/strict";
import test from "node:test";
import { estimatesFromArchived, originalsFromArchived } from "./look-archive";
import {
  lookDiffersFromOriginal,
  mergeOriginalLooks,
  parseOriginalLook,
  parseOriginalLooks,
} from "./look-original";

test("parseOriginalLook reads camelCase and snake_case image paths", () => {
  const camel = parseOriginalLook({
    title: "Soft Plum",
    description: "soft plum blazer",
    palette: ["#7A6577"],
    imagePath: "u/looksets/a/1.jpg",
    imagePathTq: "u/looksets/a/1-tq.jpg",
    items: [{ title: "Blazer", category: "Outerwear" }],
    savedAt: "2026-08-23T12:00:00.000Z",
  });
  assert.equal(camel?.imagePath, "u/looksets/a/1.jpg");
  assert.equal(camel?.imagePathTq, "u/looksets/a/1-tq.jpg");

  const snake = parseOriginalLook({
    title: "Soft Plum",
    description: "soft plum blazer",
    image_path: "u/looksets/a/1.jpg",
    image_path_tq: null,
  });
  assert.equal(snake?.imagePath, "u/looksets/a/1.jpg");
  assert.equal(snake?.imagePathTq, null);
});

test("parseOriginalLooks ignores junk keys and empty snapshots", () => {
  const map = parseOriginalLooks({
    1: { title: "A", description: "brief", imagePath: "p.jpg" },
    nope: { imagePath: "x.jpg" },
    2: { title: "missing image" },
  });
  assert.equal(Object.keys(map).join(","), "1");
  assert.equal(map[1]?.title, "A");
});

test("originalsFromArchived reads the first snapshot per look index", () => {
  const map = originalsFromArchived([
    {
      path: "orig.jpg",
      title: "Soft Plum",
      createdAt: "2026-08-23T12:00:00.000Z",
      lookIndex: 1,
      description: "soft plum blazer",
      palette: ["#7A6577"],
      items: [],
    },
    { path: "later.jpg", title: "Navy", createdAt: "2026-08-23T13:00:00.000Z" },
  ]);
  assert.equal(map[1]?.imagePath, "orig.jpg");
  assert.equal(map[1]?.description, "soft plum blazer");
  assert.deepEqual(mergeOriginalLooks({ 1: map[1]! }, { 1: map[1]! })[1]?.imagePath, "orig.jpg");
});

test("estimatesFromArchived reads the first estimate per look index", () => {
  const map = estimatesFromArchived([
    {
      path: "orig.jpg",
      title: "Soft Plum",
      createdAt: "2026-08-23T12:00:00.000Z",
      lookIndex: 0,
      constructEstimate: {
        opinion: {
          verdict: "good",
          headline: "Navy holds the plum brief",
          body: "The unstructured navy blazer keeps evening polish without the pastel trap.",
          pairWith: ["black suede loafers"],
        },
        fingerprint: "a",
        savedAt: "2026-08-23T12:00:00.000Z",
      },
    },
    { path: "later.jpg", title: "Navy", createdAt: "2026-08-23T13:00:00.000Z" },
  ]);
  assert.equal(map[0]?.opinion.verdict, "good");
  assert.equal(map[0]?.fingerprint, "a");
});

test("lookDiffersFromOriginal is true only after construct", () => {
  const original = parseOriginalLook({
    title: "A",
    description: "soft plum blazer",
    imagePath: "orig.jpg",
  });
  assert.equal(
    lookDiffersFromOriginal(
      { imagePath: "orig.jpg", description: "soft plum blazer" },
      original,
    ),
    false,
  );
  assert.equal(
    lookDiffersFromOriginal(
      { imagePath: "new.jpg", description: "navy blazer" },
      original,
    ),
    true,
  );
  assert.equal(
    lookDiffersFromOriginal({ imagePath: "orig.jpg", description: "x" }, null),
    false,
  );
});
