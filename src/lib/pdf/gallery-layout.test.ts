import assert from "node:assert/strict";
import test from "node:test";
import {
  packedGalleryFits,
  packedGalleryImageHeight,
  packedGalleryPageSize,
  packedGallerySize,
} from "./gallery-layout";

test("a 2×2 portrait pack is four items", () => {
  assert.equal(packedGalleryPageSize(2, 2), 4);
});

test("packed height shrinks so two captioned rows fit the page budget", () => {
  const natural = 292;
  const h = packedGalleryImageHeight({
    budget: 694,
    rows: 2,
    captionHeight: 55,
    rowGap: 20,
    naturalHeight: natural,
  });
  const row = h + 8 + 55 + 20;
  assert.ok(h < natural, `should shrink below ${natural}, got ${h}`);
  assert.ok(row * 2 <= 694 + 0.01, `two rows ${row * 2} must fit in 694`);
});

test("packed height does not grow past the natural 4:5 box", () => {
  const h = packedGalleryImageHeight({
    budget: 2000,
    rows: 2,
    captionHeight: 40,
    rowGap: 16,
    naturalHeight: 292,
  });
  assert.equal(h, 292);
});

test("a full page fits a packed 2×2; a sliver does not", () => {
  assert.equal(
    packedGalleryFits({
      budget: 700,
      rows: 2,
      captionHeight: 55,
      rowGap: 20,
    }),
    true,
  );
  assert.equal(
    packedGalleryFits({
      budget: 120,
      rows: 2,
      captionHeight: 55,
      rowGap: 20,
    }),
    false,
  );
});

test("packed size keeps the 4:5 portrait ratio when height shrinks", () => {
  const ratio = 5 / 4;
  const naturalHeight = 292;
  const { width, height } = packedGallerySize({
    budget: 694,
    rows: 2,
    captionHeight: 55,
    rowGap: 20,
    naturalHeight,
    ratio,
  });
  assert.ok(height < naturalHeight);
  assert.ok(Math.abs(height / width - ratio) < 1e-9);
});

test("packed size stays at the natural 4:5 box when the page is tall enough", () => {
  const ratio = 5 / 4;
  const naturalHeight = 292;
  const { width, height } = packedGallerySize({
    budget: 2000,
    rows: 2,
    captionHeight: 40,
    rowGap: 16,
    naturalHeight,
    ratio,
  });
  assert.equal(height, naturalHeight);
  assert.equal(width, naturalHeight / ratio);
});

test("title leftover on a fresh A4 page fits packed 2×2, not two natural rows", () => {
  // After newPage + section title, leftover is ~690pt. Two 4:5 rows need ~750.
  // Page-break must use packed height, or the title sits alone on a blank page.
  const leftover = 690;
  const naturalRow = 292 + 8 + 55 + 20;
  assert.ok(leftover - 2 * naturalRow < 64);
  assert.equal(
    packedGalleryFits({
      budget: leftover,
      rows: 2,
      captionHeight: 55,
      rowGap: 20,
    }),
    true,
  );
});
