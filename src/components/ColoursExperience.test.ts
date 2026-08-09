import assert from "node:assert/strict";
import test from "node:test";
import { COLOURS_SOCIAL_FORMATS } from "./ColoursExperience";
import {
  buildColoursSwatchSvg,
  buildFabricStripeSvg,
  COLOURS_SWATCH_ASPECT_RATIO,
} from "./FabricSwatch";

test("colour-page swatches are upright fabric cards matching the reference viewBox", () => {
  assert.equal(COLOURS_SWATCH_ASPECT_RATIO, 132 / 214);
});

test("swatch svg renders the atelier fabric card without the dark mount", () => {
  const svg = buildColoursSwatchSvg("#879b98", "abc");
  // Colour is inlined into the cloth and pinking teeth.
  assert.ok(svg.includes("#879b98"));
  // Pinked (zig-zag) shear edges and woven texture are present.
  assert.match(svg, /id="teethH-abc"/);
  assert.match(svg, /id="teethV-abc"/);
  assert.match(svg, /id="weave-abc"/);
  assert.match(svg, /feTurbulence/);
  // The dark mount / black background is gone.
  assert.doesNotMatch(svg, /id="mount/);
  assert.doesNotMatch(svg, /#26251f/);
  // No tilt on the fabric itself beyond the reference's ~1.25° card lift.
  assert.doesNotMatch(svg, /rotate\(-?[2-9]/);
});

test("swatch ids are namespaced per instance to avoid cross-referencing", () => {
  const a = buildColoursSwatchSvg("#111111", "one");
  const b = buildColoursSwatchSvg("#222222", "two");
  assert.match(a, /url\(#clothTexture-one\)/);
  assert.match(b, /url\(#clothTexture-two\)/);
  assert.ok(!a.includes("-two"));
});

test("moodboard palette stripes reuse fabric weave without pinked mount", () => {
  const svg = buildFabricStripeSvg("#879b98", "mb0");
  assert.ok(svg.includes("#879b98"));
  assert.match(svg, /id="stripeWeave-mb0"/);
  assert.match(svg, /feTurbulence/);
  assert.doesNotMatch(svg, /teethH|teethV|mount/);
});

test("social downloads include a 4:5 Facebook and Instagram feed image", () => {
  assert.deepEqual(COLOURS_SOCIAL_FORMATS.at(-1), {
    format: "feed",
    label: "Facebook / Instagram · 4:5",
    filenameSuffix: "feed",
  });
});
