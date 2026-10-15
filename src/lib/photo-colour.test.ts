import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGains,
  castDirection,
  contrastFromSpread,
  estimateCastGains,
  isSkinLike,
  labHueAngle,
  measureColouring,
  medianSkinInBox,
  hairSamplePlausible,
  neutralLean,
  sameShoot,
  detectFaceBox,
  detectRegions,
  detectBodySkin,
  reconcileContrast,
  reconcileUndertone,
  rgbToHex,
  rgbToLab,
  undertoneFromHueAngle,
  undertoneFromSkinSamples,
  type RawImage,
  type Rgb,
} from "./photo-colour";

/** Synthetic portrait: a background wall, a skin block, a hair block. */
function synth(opts: {
  wall: Rgb;
  skin: Rgb;
  hair: Rgb;
  size?: number;
}): RawImage {
  const size = opts.size ?? 120;
  const data = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      let c = opts.wall;
      const nx = x / size;
      const ny = y / size;
      if (nx > 0.3 && nx < 0.7 && ny > 0.06 && ny < 0.26) c = opts.hair;
      else if (nx > 0.28 && nx < 0.72 && ny > 0.3 && ny < 0.8) c = opts.skin;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  }
  return { data, width: size, height: size, channels: 3 };
}

const WALL_WHITE: Rgb = [235, 235, 235];
const WALL_WARM: Rgb = [235, 222, 200]; // orange bulb on a white wall
const SKIN_NEUTRAL: Rgb = [215, 175, 148];
const HAIR_DARK: Rgb = [60, 55, 52];

test("skin gate accepts skin, rejects hair, wall and lips-red", () => {
  assert.equal(isSkinLike(SKIN_NEUTRAL), true);
  assert.equal(isSkinLike([230, 190, 160]), true);
  assert.equal(isSkinLike(HAIR_DARK), false);
  assert.equal(isSkinLike(WALL_WHITE), false);
  assert.equal(isSkinLike([200, 40, 60]), false);
});

test("Lab hue angle separates rosy from golden skin", () => {
  const rosy = rgbToLab([220, 170, 170]);
  const golden = rgbToLab([220, 180, 130]);
  assert.ok(labHueAngle(rosy.a, rosy.b) < labHueAngle(golden.a, golden.b));
  assert.equal(undertoneFromHueAngle(labHueAngle(rosy.a, rosy.b)), "cool");
  assert.equal(undertoneFromHueAngle(labHueAngle(golden.a, golden.b)), "warm");
});

test("white-patch cast estimate finds a warm bulb and neutralises the wall", () => {
  const img = synth({ wall: WALL_WARM, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const cast = estimateCastGains(img);
  assert.equal(cast.source, "white-patch");
  assert.ok(cast.strength > 0.05, `strength ${cast.strength}`);
  assert.equal(castDirection(cast), "warm");
  const wall = applyGains(WALL_WARM, cast.gains);
  const spread = Math.max(...wall) - Math.min(...wall);
  assert.ok(spread < 8, `wall after correction ${rgbToHex(wall)}`);
  // Balanced light → no cast.
  const neutral = estimateCastGains(synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK }));
  assert.ok(neutral.strength < 0.02);
  assert.equal(castDirection(neutral), "neutral");
});

test("a vouched neutral reference beats the white-patch guess", () => {
  const img = synth({ wall: WALL_WARM, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const cast = estimateCastGains(img, { box: { x: 0.02, y: 0.4, w: 0.15, h: 0.3 }, trulyNeutral: true });
  assert.equal(cast.source, "reference");
  assert.equal(castDirection(cast), "warm");
});

test("medianSkinInBox rejects a box that landed on hair or wall", () => {
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  assert.ok(medianSkinInBox(img, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }));
  assert.equal(medianSkinInBox(img, { x: 0.35, y: 0.08, w: 0.3, h: 0.15 }), null);
  assert.equal(medianSkinInBox(img, { x: 0.0, y: 0.0, w: 0.2, h: 0.9 }), null);
});

test("undertone from samples: forearms outweigh a flushed cheek", () => {
  const flushedCheek: Rgb = [215, 140, 135]; // rosy, drags the angle down
  const forearm: Rgb = [200, 165, 125]; // golden
  const cheekOnly = undertoneFromSkinSamples([{ corrected: flushedCheek, weight: 1 }]);
  assert.equal(cheekOnly.undertone, "cool");
  const both = undertoneFromSkinSamples([
    { corrected: flushedCheek, weight: 1 },
    { corrected: forearm, weight: 2 },
    { corrected: forearm, weight: 2 },
  ]);
  assert.notEqual(both.undertone, "cool");
  assert.ok(both.confidence < 1, "disagreement lowers confidence");
});

test("contrast from lightness spread", () => {
  assert.equal(contrastFromSpread(0.56), "high");
  assert.equal(contrastFromSpread(0.49), "medium"); // dark-chestnut hair on medium skin
  assert.equal(contrastFromSpread(0.3), "medium");
  assert.equal(contrastFromSpread(0.12), "low");
});

test("measureColouring: warm bulb on neutral skin — corrected undertone is not warm, contrast is medium (dark hair on medium-light skin)", () => {
  // The bulb pushes skin toward orange: multiply by the wall's cast.
  const castSkin: Rgb = [
    Math.round((SKIN_NEUTRAL[0] * WALL_WARM[0]) / 235),
    Math.round((SKIN_NEUTRAL[1] * WALL_WARM[1]) / 235),
    Math.round((SKIN_NEUTRAL[2] * WALL_WARM[2]) / 235),
  ];
  const img = synth({ wall: WALL_WARM, skin: castSkin, hair: HAIR_DARK });
  const m = measureColouring({
    face: img,
    regions: {
      forehead: { x: 0.4, y: 0.32, w: 0.2, h: 0.08 },
      cheekLeft: { x: 0.3, y: 0.5, w: 0.12, h: 0.12 },
      cheekRight: { x: 0.58, y: 0.5, w: 0.12, h: 0.12 },
      hair: { x: 0.35, y: 0.08, w: 0.3, h: 0.15 },
    },
    castHint: "warm-tint",
  });
  assert.ok(m);
  assert.equal(m.castApplied, true);
  assert.equal(m.castDirection, "warm");
  // Raw pixels read warmer than the corrected ones.
  const rawLab = rgbToLab(castSkin);
  const corrLab = rgbToLab([
    parseInt(m.skinHex.slice(1, 3), 16),
    parseInt(m.skinHex.slice(3, 5), 16),
    parseInt(m.skinHex.slice(5, 7), 16),
  ]);
  assert.ok(labHueAngle(corrLab.a, corrLab.b) < labHueAngle(rawLab.a, rawLab.b));
  assert.equal(m.contrast, "medium");
  assert.ok(m.hairHex);
  assert.equal(m.skinSamples.length, 3);
});

test("measureColouring falls back to the portrait centre when no region is given", () => {
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const m = measureColouring({ face: img, regions: {}, castHint: "neutral" });
  assert.ok(m);
  assert.equal(m.castApplied, false);
  assert.equal(m.skinSamples[0]!.region, "face-centre");
  assert.equal(m.skinHex, rgbToHex(SKIN_NEUTRAL));
});

test("reconcile: the measured angle must clear the model's boundary; tint lowers the bar", () => {
  const m = (undertone: "warm" | "cool" | "neutral", angle: number) => ({
    undertone,
    undertoneHueAngle: angle,
    undertoneConfidence: 0.2,
  });
  // Report f4b8e202: model "warm" under an orange bulb, skin measured at 50°
  // — ten degrees short of warm even though neutral vs cool is a toss-up.
  assert.equal(reconcileUndertone("warm", m("neutral", 50), "warm-tint"), "neutral");
  assert.equal(reconcileUndertone("warm", m("neutral", 50), "neutral"), "neutral");
  // 56° is only four degrees short of warm: the model stands in daylight, not under a tint.
  assert.equal(reconcileUndertone("warm", m("neutral", 56), "neutral"), "warm");
  assert.equal(reconcileUndertone("warm", m("neutral", 54), "warm-tint"), "neutral");
  assert.equal(reconcileUndertone("cool", m("warm", 66), "neutral"), "warm");
  // Clearly not warm, but cool by only 0.7° — reported as neutral, not cool.
  assert.equal(reconcileUndertone("warm", m("cool", 47.3), "warm-tint"), "neutral");
  assert.equal(reconcileUndertone("warm", m("cool", 43), "warm-tint"), "cool");
  assert.equal(reconcileUndertone("cool", m("neutral", 52), "neutral"), "cool");
  assert.equal(reconcileUndertone("neutral", m("warm", 70), "neutral"), "warm");
  assert.equal(reconcileUndertone("neutral", m("warm", 63), "neutral"), "neutral");
  assert.equal(reconcileUndertone("warm", m("warm", 65)), "warm");
  assert.equal(reconcileUndertone("warm", null), "warm");
  assert.equal(reconcileContrast("medium", { contrastSpread: 0.56 }), "high");
  // 0.18–0.5 is the indecisive band: the model's verdict stands there.
  assert.equal(reconcileContrast("high", { contrastSpread: 0.49 }), "high");
  assert.equal(reconcileContrast("medium", { contrastSpread: 0.45 }), "medium"); // dark-chestnut on medium skin
  assert.equal(reconcileContrast("high", { contrastSpread: 0.25 }), "medium");
  assert.equal(reconcileContrast("medium", { contrastSpread: 0.3 }), "medium");
  assert.equal(reconcileContrast("low", { contrastSpread: null }), "low");
});

test("a neck box on stubble is rejected: face samples must agree in lightness", () => {
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const m = measureColouring({
    face: img,
    regions: {
      cheekLeft: { x: 0.3, y: 0.5, w: 0.12, h: 0.12 },
      cheekRight: { x: 0.58, y: 0.5, w: 0.12, h: 0.12 },
      // "neck" that actually landed on the dark hair block — stubble in real life.
      neck: { x: 0.4, y: 0.08, w: 0.2, h: 0.14 },
      hair: { x: 0.35, y: 0.08, w: 0.3, h: 0.15 },
    },
    castHint: "neutral",
  });
  assert.ok(m);
  // The hair block is not skin-like, so the box yields nothing rather than a dark sample.
  assert.equal(m.skinSamples.some((s) => s.region === "neck"), false);
  assert.equal(m.skinHex, rgbToHex(SKIN_NEUTRAL));
});

test("a dark 'skin' sample far from the model's cheek hex is thrown out", () => {
  const stubble: Rgb = [110, 78, 62]; // passes the skin gate, 0.3 darker than the cheeks
  const size = 120;
  const data = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const nx = x / size;
      const ny = y / size;
      let c: Rgb = WALL_WHITE;
      if (nx > 0.3 && nx < 0.7 && ny > 0.06 && ny < 0.26) c = HAIR_DARK;
      else if (nx > 0.28 && nx < 0.72 && ny > 0.3 && ny < 0.7) c = SKIN_NEUTRAL;
      else if (nx > 0.35 && nx < 0.65 && ny >= 0.7 && ny < 0.82) c = stubble;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  }
  const img: RawImage = { data, width: size, height: size, channels: 3 };
  const regions = {
    cheekLeft: { x: 0.3, y: 0.45, w: 0.12, h: 0.12 },
    cheekRight: { x: 0.58, y: 0.45, w: 0.12, h: 0.12 },
    neck: { x: 0.4, y: 0.71, w: 0.2, h: 0.1 },
    hair: { x: 0.35, y: 0.08, w: 0.3, h: 0.15 },
  };
  assert.equal(isSkinLike(stubble), true, "fixture: stubble must pass the gate");
  const m = measureColouring({ face: img, regions, castHint: "neutral", modelSkinHex: rgbToHex(SKIN_NEUTRAL) });
  assert.ok(m);
  assert.deepEqual(m.rejected.map((r) => r.region), ["neck"]);
  assert.equal(m.skinHex, rgbToHex(SKIN_NEUTRAL));
  assert.equal(m.contrast, "medium");
});

test("a body box on a beige wall is rejected against the face skin", () => {
  const face = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  // Body photo: beige tiles everywhere (skin-like chromaticity), no real skin in the box.
  const beige: Rgb = [216, 198, 160];
  const body = synth({ wall: beige, skin: beige, hair: HAIR_DARK });
  const m = measureColouring({
    face,
    body,
    regions: {
      cheekLeft: { x: 0.3, y: 0.5, w: 0.12, h: 0.12 },
      cheekRight: { x: 0.58, y: 0.5, w: 0.12, h: 0.12 },
      hair: { x: 0.35, y: 0.08, w: 0.3, h: 0.15 },
      bodySkin: [{ box: { x: 0.05, y: 0.4, w: 0.15, h: 0.15 }, part: "forearm" }],
    },
    castHint: "neutral",
  });
  assert.ok(m);
  assert.equal(m.bodySkinUsed, false);
  assert.ok(m.rejected.some((r) => r.region === "forearm"));
});

test("hairSamplePlausible: a near-white sample cannot be dark brown hair", () => {
  assert.equal(hairSamplePlausible("#e6ded2", "dark brown"), false);
  assert.equal(hairSamplePlausible("#3a2f2a", "dark brown"), true);
  assert.equal(hairSamplePlausible("#2a2a2a", "light blonde"), false);
  assert.equal(hairSamplePlausible("#c9b48a", "blonde"), true);
  assert.equal(hairSamplePlausible("#b0b0b0", "grey"), true);
  assert.equal(hairSamplePlausible("#e6ded2", null), true);
});

test("a hair sample that cannot be the stated hair colour is rejected, so contrast is not measured from a wall", () => {
  // Hair box on the bare wall: only background there — no sample at all.
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const onWall = measureColouring({
    face: img,
    regions: {
      cheekLeft: { x: 0.3, y: 0.5, w: 0.12, h: 0.12 },
      cheekRight: { x: 0.58, y: 0.5, w: 0.12, h: 0.12 },
      hair: { x: 0.02, y: 0.02, w: 0.2, h: 0.12 }, // wall
    },
    castHint: "neutral",
    hairColor: "dark brown",
  });
  assert.ok(onWall);
  assert.equal(onWall.hairHex, null);
  assert.equal(onWall.contrast, null);
  // A light block that is not the wall (a pale hat, a bright highlight) is no "dark brown" hair either.
  const pale = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: [200, 200, 205] });
  const m = measureColouring({ face: pale, castHint: "neutral", hairColor: "dark brown" });
  assert.ok(m);
  assert.equal(m.hairHex, null);
  assert.equal(m.contrast, null);
  assert.ok(m.rejected.some((r) => r.region === "hair"));
});

test("when most boxes miss, the portrait centre joins the lone survivor", () => {
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const m = measureColouring({
    face: img,
    regions: {
      forehead: { x: 0.02, y: 0.02, w: 0.1, h: 0.08 }, // wall → no skin
      cheekLeft: { x: 0.35, y: 0.1, w: 0.1, h: 0.1 }, // hair → no skin
      cheekRight: { x: 0.58, y: 0.5, w: 0.12, h: 0.12 }, // real cheek
      hair: { x: 0.35, y: 0.08, w: 0.3, h: 0.15 },
    },
    castHint: "neutral",
    modelSkinHex: rgbToHex(SKIN_NEUTRAL),
    hairColor: "dark brown",
  });
  assert.ok(m);
  assert.deepEqual(m.skinSamples.map((s) => s.region).sort(), ["cheekRight", "face-centre"]);
  assert.equal(m.skinHex, rgbToHex(SKIN_NEUTRAL));
});

/* ----------------------------- region detection ----------------------------- */

test("detectFaceBox finds the skin block under the hair, not the wall", () => {
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const box = detectFaceBox(img);
  assert.ok(box);
  assert.ok(Math.abs(box.left - 0.28) < 0.03, `left ${box.left}`);
  assert.ok(Math.abs(box.top - 0.3) < 0.03, `top ${box.top}`);
  assert.ok(Math.abs(box.width - 0.44) < 0.04, `width ${box.width}`);
  // A warm wall that passes the loose skin gate is still background.
  const warm = detectFaceBox(synth({ wall: WALL_WARM, skin: SKIN_NEUTRAL, hair: HAIR_DARK }));
  assert.ok(warm);
  assert.ok(Math.abs(warm.top - 0.3) < 0.03, `warm-wall top ${warm.top}`);
  assert.ok(Math.abs(warm.width - 0.44) < 0.04, `warm-wall width ${warm.width}`);
});

test("without model boxes the measurement finds skin and hair itself", () => {
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: HAIR_DARK });
  const regions = detectRegions(img);
  assert.ok(regions.forehead && regions.cheekLeft && regions.cheekRight && regions.hair);
  const m = measureColouring({ face: img, castHint: "neutral", hairColor: "dark brown" });
  assert.ok(m);
  assert.equal(m.skinHex, rgbToHex(SKIN_NEUTRAL));
  assert.equal(m.hairHex, rgbToHex(HAIR_DARK));
  assert.ok(m.contrastSpread != null && Math.abs(m.contrastSpread - 0.49) < 0.02, `spread ${m.contrastSpread}`);
  assert.equal(m.contrast, "medium");
  assert.deepEqual(m.skinSamples.map((s) => s.region).sort(), ["cheekLeft", "cheekRight", "forehead"]);
});

test("a shaved head on a white wall yields no hair sample, so contrast is left to the model", () => {
  const img = synth({ wall: WALL_WHITE, skin: SKIN_NEUTRAL, hair: WALL_WHITE });
  const m = measureColouring({ face: img, castHint: "neutral", hairColor: "dark brown" });
  assert.ok(m);
  assert.equal(m.hairHex, null);
  assert.equal(m.contrast, null);
});

test("detectBodySkin keeps hand-sized skin blobs at arm height and drops head, floor and door", () => {
  const size = 200;
  const data = new Uint8Array(size * size * 3);
  const DOOR: Rgb = [190, 150, 80]; // a wooden door: huge, skin-like, yellower than the face
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      let c: Rgb = WALL_WHITE;
      if (nx > 0.55 && nx < 0.95 && ny > 0.05 && ny < 0.95) c = DOOR; // a wooden door: huge, skin-like
      if (nx > 0.42 && nx < 0.58 && ny > 0.05 && ny < 0.2) c = SKIN_NEUTRAL; // head
      if (nx > 0.3 && nx < 0.36 && ny > 0.5 && ny < 0.6) c = SKIN_NEUTRAL; // left hand
      if (nx > 0.62 && nx < 0.68 && ny > 0.5 && ny < 0.6) c = SKIN_NEUTRAL; // right hand (over the door)
      if (ny > 0.9) c = [210, 180, 150]; // beige floor tiles
      const i = (y * size + x) * 3;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  }
  const found = detectBodySkin({ data, width: size, height: size, channels: 3 }, SKIN_NEUTRAL);
  assert.equal(found.length, 2, JSON.stringify(found));
  for (const f of found) {
    assert.ok(f.box.y > 0.45 && f.box.y + f.box.h < 0.65, JSON.stringify(f.box));
  }
});

test("neutralLean: a neutral read leans cool or warm by its hue angle, given three samples", () => {
  const three = [{}, {}, {}] as never;
  assert.equal(neutralLean({ undertone: "neutral", undertoneHueAngle: 48, skinSamples: three }), "cool");
  assert.equal(neutralLean({ undertone: "neutral", undertoneHueAngle: 58, skinSamples: three }), "warm");
  assert.equal(neutralLean({ undertone: "neutral", undertoneHueAngle: 54.5, skinSamples: three }), null);
  assert.equal(neutralLean({ undertone: "neutral", undertoneHueAngle: 48, skinSamples: [{}, {}] as never }), null);
  assert.equal(neutralLean({ undertone: "cool", undertoneHueAngle: 40, skinSamples: three }), null);
  assert.equal(neutralLean(null), null);
});

test("sameShoot: uploads hours apart are two shoots; unknown times pass", () => {
  assert.equal(sameShoot("2026-07-12T07:55:46Z", "2026-07-12T08:10:00Z"), true);
  assert.equal(sameShoot("2026-07-12T07:55:46Z", "2026-08-06T05:17:44Z"), false);
  assert.equal(sameShoot(undefined, "2026-08-06T05:17:44Z"), true);
  assert.equal(sameShoot("not a date", "2026-08-06T05:17:44Z"), true);
});
