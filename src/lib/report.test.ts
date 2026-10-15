import assert from "node:assert/strict";
import test from "node:test";
import {
  isStaleShoppingCopy,
  pdfReadiness,
  PDF_STRICT_WINDOW_MS,
  SHOPPING_VERSION,
  reportUpsellForTier,
  type PdfReadinessInput,
  type ShoppingItem,
  hairImagesPending,
} from "./report";

function item(over: Partial<ShoppingItem>): ShoppingItem {
  return {
    category: "Trousers",
    title: "Reserved Chino Slim Fit Trousers",
    why: "Slim chinos in pale grey streamline your rectangle build.",
    priceEur: 40,
    retailer: "Reserved",
    url: "https://www.reserved.com/p/123",
    color: "#8b8b8b",
    ...over,
  };
}

test("a paid lookbook is not sold Premium at the footer", () => {
  assert.equal(reportUpsellForTier("lookbook"), null);
  assert.ok(reportUpsellForTier("basic"));
  assert.ok(reportUpsellForTier("premium"));
});

test("pre-version shopping is stale only where the colour gates could change it", () => {
  // Grey chinos with a real swatch: the gates would not touch them — no rematch.
  assert.equal(isStaleShoppingCopy([item({})]), false);
  // A black piece → the black gate applies → rematch.
  assert.equal(
    isStaleShoppingCopy([item({ title: "Gentleman Shoe Black Leather Derby Shoes", category: "Footwear" })]),
    true,
  );
  assert.equal(isStaleShoppingCopy([item({ color: "#0e0e10" })]), true);
  // Placeholder swatch = colour unknown at match time → rematch.
  assert.equal(isStaleShoppingCopy([item({ color: "#CCCCCC" })]), true);
  // Already on the current version → never version-stale.
  assert.equal(
    isStaleShoppingCopy([item({ title: "Black Derby", shoppingVersion: SHOPPING_VERSION })]),
    false,
  );
});


const NOW = Date.parse("2026-09-04T12:00:00Z");
function fresh(over: Partial<PdfReadinessInput> = {}): PdfReadinessInput {
  const img = { imagePath: "u/r/x.jpg" };
  return {
    tier: "lookbook",
    createdAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
    status: "ready",
    generationPending: false,
    hasReferencePhoto: true,
    looks: [img, img, img],
    coverImage: "u/r/cover.jpg",
    capsuleImages: ["a", "b", "c"],
    hair: {
      recommend: [{ ...img, imagePathSide: "s" }, { ...img, imagePathSide: "s" }, { ...img, imagePathSide: "s" }, { ...img, imagePathSide: "s" }],
      avoid: [img, img],
    },
    facialHair: [img, img, img, img],
    eyewear: [img, img, img, img],
    accessories: [img, img],
    headwear: [img, img],
    watchImage: "u/r/watch.jpg",
    shoeImage: "u/r/shoe.jpg",
    ...over,
  };
}

test("a fully rendered fresh lookbook report is PDF-ready", () => {
  assert.deepEqual(pdfReadiness(fresh(), NOW), { ready: true, reason: null });
});

test("any missing image blocks the PDF while the report is fresh, with the right reason", () => {
  assert.equal(pdfReadiness(fresh({ status: "processing" }), NOW).reason, "processing");
  assert.equal(pdfReadiness(fresh({ generationPending: true }), NOW).reason, "looks");
  assert.equal(pdfReadiness(fresh({ coverImage: null }), NOW).reason, "cover");
  assert.equal(pdfReadiness(fresh({ looks: [{ imagePath: "x" }, {}] }), NOW).reason, "looks");
  assert.equal(
    pdfReadiness(fresh({ hair: { recommend: [{ imagePath: "x" }], avoid: [] } }), NOW).reason,
    "hair",
    "dual-angle tier needs the side view too",
  );
  assert.equal(pdfReadiness(fresh({ eyewear: [{}] }), NOW).reason, "grooming");
  assert.equal(pdfReadiness(fresh({ capsuleImages: ["a", null, "c"] }), NOW).reason, "capsule");
  assert.equal(pdfReadiness(fresh({ capsuleImages: [] }), NOW).reason, "capsule");
  assert.equal(pdfReadiness(fresh({ watchImage: null }), NOW).reason, "boards");
});

test("basic tier has no capsule / grooming / boards requirement", () => {
  const basic = fresh({
    tier: "basic",
    capsuleImages: null,
    facialHair: null,
    eyewear: null,
    watchImage: null,
    shoeImage: null,
    hair: { recommend: [{ imagePath: "x" }, { imagePath: "x" }, { imagePath: "x" }], avoid: [{ imagePath: "x" }, { imagePath: "x" }] },
  });
  assert.equal(pdfReadiness(basic, NOW).ready, true);
});

test("after the strict window only a still-processing report blocks the download", () => {
  const old = fresh({
    createdAt: new Date(NOW - PDF_STRICT_WINDOW_MS - 60_000).toISOString(),
    capsuleImages: ["a", null],
    watchImage: null,
  });
  assert.equal(pdfReadiness(old, NOW).ready, true);
  assert.equal(pdfReadiness({ ...old, status: "processing" }, NOW).reason, "processing");
  assert.equal(pdfReadiness({ ...old, generationPending: true }, NOW).ready, false);
});

test("without a reference photo only content and the capsule matrix gate the PDF", () => {
  const noPhoto = fresh({
    hasReferencePhoto: false,
    coverImage: null,
    looks: [{}, {}],
    hair: { recommend: [{}], avoid: [] },
    watchImage: null,
    shoeImage: null,
  });
  assert.equal(pdfReadiness(noPhoto, NOW).ready, true);
  assert.equal(pdfReadiness({ ...noPhoto, capsuleImages: [] }, NOW).reason, "capsule");
});

test("hair cards stay 'generating' after the first look lands, while the report is fresh", () => {
  const hair = {
    recommend: [
      { name: "Textured crop", why: "" },
      { name: "Side part", why: "" },
      { name: "Quiff", why: "" },
      { name: "Layered cut", why: "" },
    ],
    avoid: [{ name: "Flat centre part", why: "" }, { name: "Slicked back", why: "" }],
  };
  const now = Date.parse("2026-09-05T10:00:00Z");
  const fresh = new Date(now - 10 * 60_000).toISOString();
  const stale = new Date(now - PDF_STRICT_WINDOW_MS - 60_000).toISOString();
  // Looks are rendered before hair: a look image proves nothing about the haircuts.
  assert.equal(
    hairImagesPending({ hasReferencePhoto: true, hair, tier: "lookbook", createdAt: fresh, anyLookImage: true, now }),
    true,
  );
  assert.equal(
    hairImagesPending({ hasReferencePhoto: true, hair, tier: "lookbook", createdAt: fresh, anyLookImage: false, now }),
    true,
  );
  // A batch that never finished stops blocking once the report is old.
  assert.equal(
    hairImagesPending({ hasReferencePhoto: true, hair, tier: "lookbook", createdAt: stale, anyLookImage: true, now }),
    false,
  );
  // No reference photo → nothing personal to wait for.
  assert.equal(
    hairImagesPending({ hasReferencePhoto: false, hair, tier: "lookbook", createdAt: fresh, anyLookImage: false, now }),
    false,
  );
  // Batch complete → not pending.
  const done = {
    recommend: hair.recommend.map((h) => ({ ...h, imagePath: "u/r/hair.jpg", imagePathSide: "u/r/hair-side.jpg" })),
    avoid: hair.avoid.map((h) => ({ ...h, imagePath: "u/r/avoid.jpg" })),
  };
  assert.equal(
    hairImagesPending({ hasReferencePhoto: true, hair: done, tier: "lookbook", createdAt: fresh, anyLookImage: true, now }),
    false,
  );
});
