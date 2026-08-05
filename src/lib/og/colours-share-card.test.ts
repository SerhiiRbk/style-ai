import assert from "node:assert/strict";
import test from "node:test";
import {
  atelierBackdropDataUri,
  dressFormDataUri,
  fabricSwatchDataUri,
  monogramDataUri,
  SWATCH_ASPECT_RATIO,
  SWATCH_OFFSETS_Y,
  SWATCH_ROTATIONS,
  verticalLayoutFor,
} from "./colours-share-card";

function decodeSvg(uri: string): string {
  const prefix = "data:image/svg+xml;utf8,";
  assert.ok(uri.startsWith(prefix));
  return decodeURIComponent(uri.slice(prefix.length));
}

test("atelier backdrop contains cloth, tailoring, and frame without a right wedge", () => {
  const svg = decodeSvg(atelierBackdropDataUri(1080, 1920));

  assert.match(svg, /id="clothGrain"/);
  assert.match(svg, /stroke-dasharray=/);
  assert.match(svg, /<rect[^>]+stroke="#c2a06a"/);
  assert.doesNotMatch(svg, /data-layer="diagonal-fold"/);
});

test("watermark is a tall serif V without calligraphic loops", () => {
  const svg = decodeSvg(monogramDataUri(700, 900));

  assert.match(svg, /data-layer="serif-v"/);
  assert.doesNotMatch(svg, /data-layer="upper-loop"/);
  assert.doesNotMatch(svg, /data-layer="lower-loop"/);
  assert.match(svg, /viewBox="0 0 700 900"/);
});

test("fabric swatch uses layered textile weave and edge depth", () => {
  const svg = decodeSvg(fabricSwatchDataUri("#647a93", 180, 220));

  assert.match(svg, /id="warp"/);
  assert.match(svg, /id="weft"/);
  assert.match(svg, /id="edgeShade"/);
  assert.match(svg, /id="threadHighlights"/);
  assert.match(svg, /id="slubFibres"/);
  assert.match(svg, /data-layer="surface-fibres"/);
  assert.match(svg, /data-tooth-depth="[4-6]"/);
});

test("swatches use a 2:3 ratio and all lean slightly right", () => {
  assert.equal(SWATCH_ASPECT_RATIO, 2 / 3);
  assert.deepEqual(SWATCH_ROTATIONS, [2, 4, 3, 5, 3, 5, 2, 4]);
  assert.deepEqual(SWATCH_OFFSETS_Y, [0, 8, 2, 9, 0, 7, 2, 8]);
  assert.ok(SWATCH_ROTATIONS.every((rotation) => rotation > 0));
});

test("dress-form uses the supplied Valetti tailoring emblem without a dark plate", () => {
  const svg = decodeSvg(dressFormDataUri());

  assert.match(svg, /viewBox="0 0 107 92"/);
  assert.match(svg, /cx="55\.2" cy="44\.35" rx="26\.2" ry="40\.15"/);
  assert.match(svg, /M55\.2 23\.6v39\.58/);
  // Gold linework only — no dark rectangular mount and no "MEN" caption
  // (which rendered as tiny square glyphs at card size).
  assert.doesNotMatch(svg, /id="bg"/);
  assert.doesNotMatch(svg, /<rect[^>]*fill="url\(#bg\)"/);
  assert.doesNotMatch(svg, />MEN<\/text>/);
});

test("feed card uses a compact layout that fits 1080 by 1350", () => {
  const layout = verticalLayoutFor("feed", 1080, 1350);

  assert.equal(layout.pad, 64);
  assert.equal(layout.tileW, 171);
  assert.equal(layout.titleFontSize, 88);
  assert.equal(layout.monogramSize, 335);
  assert.equal(layout.centerMasthead, true);
});
