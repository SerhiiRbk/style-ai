/**
 * Deterministic colour measurement from the client's photos — the pixel-level
 * second opinion behind the vision model's "warm / cool / medium contrast".
 *
 * Why: the model judges undertone from one face under whatever light the
 * bathroom had. An orange bulb makes everyone "warm"; a flushed cheek reads
 * "warm" too. Here we (1) estimate the light's colour cast from a neutral
 * reference or a white-patch heuristic and correct for it, (2) sample skin from
 * several regions — forehead, cheeks, neck, and hands / forearms on the
 * full-length photo, which never flush — and (3) derive undertone from the Lab
 * hue angle of the corrected skin, contrast from the lightness spread between
 * skin and hair, which tinted light barely moves. Pure: raw pixel buffers in,
 * numbers out; the sharp / fetch side lives in `ai/photo-colour-measure.ts`.
 */
import type { Contrast, LightingCast, Undertone } from "./colour-palette";
import { hexToHsl } from "./colour-palette";

export type RawImage = {
  data: Uint8Array;
  width: number;
  height: number;
  channels: 3 | 4;
};

/** Normalised box on an image: top-left origin, 0..1 of width / height. */
export type NormBox = { x: number; y: number; w: number; h: number };
export type Rgb = [number, number, number];

export type BodySkinPart = "hand" | "forearm" | "neck" | "chest" | "other";

export type MeasureRegions = {
  forehead?: NormBox | null;
  cheekLeft?: NormBox | null;
  cheekRight?: NormBox | null;
  neck?: NormBox | null;
  hair?: NormBox | null;
  /** A white or grey object in the FACE photo; `trulyNeutral` when the model is sure it is not cream / beige. */
  neutralReference?: { box: NormBox; trulyNeutral: boolean } | null;
  /** Skin on the BODY photo — hands, forearms, neck. These never flush. */
  bodySkin?: { box: NormBox; part: BodySkinPart }[] | null;
};

export type CastGains = {
  /** Per-channel multipliers that neutralise the reference (mean 1). */
  gains: Rgb;
  /** Largest deviation of a gain from 1 — 0 is balanced light. */
  strength: number;
  /** How the estimate was made. */
  source: "reference" | "white-patch" | "none";
};

export type SkinSample = {
  region: string;
  /** 0 = face photo, 1 = body photo. */
  image: number;
  raw: Rgb;
  corrected: Rgb;
  weight: number;
  pixels: number;
  coverage: number;
};

export type RejectedSample = { region: string; image: number; hex: string; reason: string };

export type ColouringMeasurement = {
  skinHex: string;
  skinRawHex: string;
  hairHex: string | null;
  hairRawHex: string | null;
  skinSamples: SkinSample[];
  /** Samples the plausibility checks threw out (a "neck" box on stubble, a "hand" on a beige wall). */
  rejected: RejectedSample[];
  bodySkinUsed: boolean;
  /** Why the body photo was left out, when it was: "different-shoot". */
  bodySkinSkipped?: string;
  cast: CastGains;
  castDirection: "neutral" | "warm" | "cool";
  castApplied: boolean;
  undertone: Undertone;
  /** Weighted Lab hue angle of the corrected skin, degrees. */
  undertoneHueAngle: number;
  /** 0..1 — margin to the class boundary × agreement between regions. */
  undertoneConfidence: number;
  contrast: Contrast | null;
  /** |L(skin) − L(hair)| in HSL lightness, when hair was measured. */
  contrastSpread: number | null;
};

/* ----------------------------- colour maths ----------------------------- */

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** sRGB (D65) → CIE Lab. */
export function rgbToLab(rgb: Rgb): { L: number; a: number; b: number } {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Lab hue angle in degrees (0..360). Skin sits roughly 40°–75°. */
export function labHueAngle(a: number, b: number): number {
  const deg = (Math.atan2(b, a) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

export function rgbToHex(rgb: Rgb): string {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToHsl(rgb: Rgb): { h: number; s: number; l: number } {
  return hexToHsl(rgbToHex(rgb));
}

/** Absolute chroma 0..1 — HSL saturation explodes on light colours (a warm-lit white wall reads s≈0.47). */
function chroma(rgb: Rgb): number {
  return (Math.max(...rgb) - Math.min(...rgb)) / 255;
}

/**
 * Skin chromaticity gate (YCbCr rule, Chai & Ngan bounds) plus HSL sanity —
 * rejects hair, lips, eyes, background walls that are too grey or too bright.
 */
export function isSkinLike(rgb: Rgb): boolean {
  const [r, g, b] = rgb;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (cb < 77 || cb > 127 || cr < 133 || cr > 177) return false;
  const { h, s, l } = rgbToHsl(rgb);
  if (l < 0.18 || l > 0.93) return false;
  if (s < 0.08 || s > 0.78) return false;
  return h <= 55 || h >= 335;
}

function pixelAt(img: RawImage, x: number, y: number): Rgb {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
}

function clampBox(img: RawImage, box: NormBox) {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(box.x * img.width)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(box.y * img.height)));
  const x1 = Math.max(x0 + 1, Math.min(img.width, Math.ceil((box.x + box.w) * img.width)));
  const y1 = Math.max(y0 + 1, Math.min(img.height, Math.ceil((box.y + box.h) * img.height)));
  return { x0, y0, x1, y1 };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function medianRgb(px: Rgb[]): Rgb {
  return [median(px.map((p) => p[0])), median(px.map((p) => p[1])), median(px.map((p) => p[2]))];
}

/** Iterate a box with a stride that keeps the sample around 4k pixels. */
function boxPixels(img: RawImage, box: NormBox): { pixels: Rgb[]; total: number } {
  const { x0, y0, x1, y1 } = clampBox(img, box);
  const area = (x1 - x0) * (y1 - y0);
  const step = Math.max(1, Math.floor(Math.sqrt(area / 4000)));
  const pixels: Rgb[] = [];
  let total = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      pixels.push(pixelAt(img, x, y));
      total += 1;
    }
  }
  return { pixels, total };
}

/**
 * Median skin colour inside a box. Null when the box holds too little skin
 * (a mislocated box on hair or wall) — fewer than 25 skin pixels or under 20 %
 * of the sampled area.
 */
export function medianSkinInBox(
  img: RawImage,
  box: NormBox,
): { rgb: Rgb; pixels: number; coverage: number } | null {
  const { pixels, total } = boxPixels(img, box);
  const skin = pixels.filter(isSkinLike);
  const coverage = total ? skin.length / total : 0;
  if (skin.length < 25 || coverage < 0.2) return null;
  return { rgb: medianRgb(skin), pixels: skin.length, coverage };
}

/** Median of the darker half of non-skin pixels in a box — the hair mass. */
export function medianHairInBox(
  img: RawImage,
  box: NormBox,
  /** Wall colour to keep out of the sample — the band above the head is part wall. */
  background?: Rgb | null,
): Rgb | null {
  const { pixels } = boxPixels(img, box);
  const nonSkin = pixels.filter(
    (p) => !isSkinLike(p) && !(background && rgbDistance(p, background) < BACKGROUND_MAX_DISTANCE),
  );
  if (nonSkin.length < 25) return null;
  const sorted = [...nonSkin].sort(
    (a, b) => rgbToHsl(a).l - rgbToHsl(b).l,
  );
  return medianRgb(sorted.slice(0, Math.max(25, Math.floor(sorted.length / 2))));
}

/* ------------------------------ same shoot ------------------------------ */

/** Two photos uploaded further apart than this are two shoots: different light, different day, sometimes a different room. */
export const SAME_SHOOT_MAX_MS = 2 * 60 * 60 * 1000;

/**
 * May the body photo be measured alongside the portrait? Skin from a July
 * hallway and a face from an August wall are not one light; the body samples
 * would pull the undertone toward whichever bulb lit the hallway. Unknown
 * upload times (legacy photos chosen around the report's creation) pass.
 */
export function sameShoot(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return true;
  return Math.abs(ta - tb) <= SAME_SHOOT_MAX_MS;
}

/* --------------------------- region detection --------------------------- */

/** RGB distance below which a pixel counts as "the wall". */
export const BACKGROUND_MAX_DISTANCE = 34;
/** Minimum chroma (max − min channel, 0–255) for a pixel to count as skin in the mask. */
const MASK_MIN_CHROMA = 28;
/** Face height / width, hairline to chin. */
const FACE_ASPECT = 1.35;
/** A body-skin blob grows only over pixels this close to its seed — a hand in front of a wooden door stays a hand. */
const COMPONENT_MAX_DISTANCE = 45;
/** Body-skin mask: hue and lightness distance from the face's skin a pixel may have. */
const BODY_MASK_MAX_HUE = 12;
const BODY_MASK_MAX_DL = 0.2;

function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Background colour from the image borders: the top band and the outer
 * columns. A portrait is a face on a wall; the wall is what touches the edges.
 */
export function estimateBackground(img: RawImage): Rgb {
  const bands: NormBox[] = [
    { x: 0, y: 0, w: 1, h: 0.06 },
    { x: 0, y: 0, w: 0.06, h: 0.6 },
    { x: 0.94, y: 0, w: 0.06, h: 0.6 },
  ];
  const px: Rgb[] = [];
  for (const b of bands) px.push(...boxPixels(img, b).pixels);
  return medianRgb(px);
}

/** Skin for the purpose of finding the face: skin-like, chromatic, and not the wall. */
function isMaskSkin(p: Rgb, background: Rgb): boolean {
  if (!isSkinLike(p)) return false;
  if (Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) < MASK_MIN_CHROMA) return false;
  return rgbDistance(p, background) >= BACKGROUND_MAX_DISTANCE;
}

/** Face bounding box as fractions of the image. */
export type FaceBox = { left: number; top: number; width: number; height: number };

/**
 * Where the face is, from the pixels: the widest contiguous run of skin
 * columns in the upper part of the image, and the first row in which those
 * columns turn to skin. Asking a vision model for coordinates gave boxes a
 * consistent tenth of the frame too high — forehead on the hair, hair on
 * the wall — so the geometry is computed, not asked for.
 */
export function detectFaceBox(img: RawImage): FaceBox | null {
  const { width: W, height: H } = img;
  const background = estimateBackground(img);
  const step = Math.max(1, Math.floor(Math.min(W, H) / 240));
  const colCount = new Int32Array(W);
  const searchBottom = Math.floor(H * 0.75);
  for (let y = 0; y < searchBottom; y += step) {
    for (let x = 0; x < W; x += step) {
      if (isMaskSkin(pixelAt(img, x, y), background)) colCount[x]! += 1;
    }
  }
  let peak = 0;
  let peakX = -1;
  for (let x = 0; x < W; x++) {
    if (colCount[x]! > peak) {
      peak = colCount[x]!;
      peakX = x;
    }
  }
  if (peakX < 0 || peak * step < H * 0.12) return null;
  const colBar = peak * 0.3;
  let left = peakX;
  let right = peakX;
  let gap = 0;
  const maxGap = Math.max(2, Math.floor(W * 0.03 / step));
  for (let x = peakX - step; x >= 0; x -= step) {
    if (colCount[x]! >= colBar) {
      left = x;
      gap = 0;
    } else if (++gap > maxGap) {
      break;
    }
  }
  gap = 0;
  for (let x = peakX + step; x < W; x += step) {
    if (colCount[x]! >= colBar) {
      right = x;
      gap = 0;
    } else if (++gap > maxGap) {
      break;
    }
  }
  const widthPx = right - left + step;
  if (widthPx < W * 0.12) return null;

  const rowCount = new Int32Array(H);
  for (let y = 0; y < H; y += step) {
    for (let x = left; x <= right; x += step) {
      if (isMaskSkin(pixelAt(img, x, y), background)) rowCount[y]! += 1;
    }
  }
  const rowPeak = Math.max(...Array.from(rowCount));
  const rowBar = rowPeak * 0.25;
  let top = -1;
  for (let y = 0; y < H; y += step) {
    // two consecutive skin rows — a stray skin-like pixel row on the wall is not the hairline
    if (rowCount[y]! >= rowBar && (rowCount[Math.min(H - 1, y + step)] ?? 0) >= rowBar) {
      top = y;
      break;
    }
  }
  if (top < 0) return null;
  const heightPx = Math.min(H - top, widthPx * FACE_ASPECT);
  return { left: left / W, top: top / H, width: widthPx / W, height: heightPx / H };
}

/**
 * Measurement boxes from the face box: forehead between hairline and brows,
 * the flat of each cheek at nose level, and the hair band above the hairline.
 */
export function faceRegionsFromBox(face: FaceBox): Pick<MeasureRegions, "forehead" | "cheekLeft" | "cheekRight" | "hair"> {
  const { left, top, width: w, height: h } = face;
  const box = (fx: number, fy: number, fw: number, fh: number): NormBox => ({
    x: left + fx * w,
    y: top + fy * h,
    w: fw * w,
    h: fh * h,
  });
  const hairTop = Math.max(0, top - 0.3 * h);
  const hairBottom = top - 0.02 * h;
  return {
    forehead: box(0.3, 0.1, 0.4, 0.12),
    cheekLeft: box(0.1, 0.48, 0.2, 0.14),
    cheekRight: box(0.7, 0.48, 0.2, 0.14),
    hair:
      hairBottom - hairTop >= 0.03
        ? { x: left + 0.15 * w, y: hairTop, w: 0.7 * w, h: hairBottom - hairTop }
        : null,
  };
}

/**
 * Bare skin on the full-length photo: connected skin blobs at arm height —
 * hands and forearms — sized like hands. The head (top of the frame), the
 * floor (bottom) and anything door- or wall-sized are left out.
 */
export function detectBodySkin(
  img: RawImage,
  /** The face's skin colour: body skin must look like it — a beige door frame does not. */
  faceRgb?: Rgb | null,
): { box: NormBox; part: "hand" }[] {
  const { width: W, height: H } = img;
  const background = estimateBackground(img);
  const step = Math.max(1, Math.floor(Math.min(W, H) / 200));
  const gw = Math.ceil(W / step);
  const gh = Math.ceil(H / step);
  const mask = new Uint8Array(gw * gh);
  const faceHsl = faceRgb ? rgbToHsl(faceRgb) : null;
  const likeFace = (p: Rgb): boolean => {
    if (!faceHsl) return true;
    const { h, l } = rgbToHsl(p);
    const dh = Math.min(Math.abs(h - faceHsl.h), 360 - Math.abs(h - faceHsl.h));
    return dh <= BODY_MASK_MAX_HUE && Math.abs(l - faceHsl.l) <= BODY_MASK_MAX_DL;
  };
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px = pixelAt(img, gx * step, gy * step);
      if (isMaskSkin(px, background) && likeFace(px)) mask[gy * gw + gx] = 1;
    }
  }
  const seen = new Uint8Array(gw * gh);
  const cells = gw * gh;
  const out: { box: NormBox; part: "hand"; size: number }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < cells; start++) {
    if (!mask[start] || seen[start]) continue;
    let minX = gw, maxX = -1, minY = gh, maxY = -1, n = 0, sumY = 0;
    const seed = pixelAt(img, (start % gw) * step, Math.floor(start / gw) * step);
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % gw;
      const y = (i - x) / gw;
      n++;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const j of [i - 1, i + 1, i - gw, i + gw]) {
        if (j < 0 || j >= cells || seen[j] || !mask[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === gw - 1)) continue;
        const jx = j % gw;
        if (rgbDistance(pixelAt(img, jx * step, ((j - jx) / gw) * step), seed) > COMPONENT_MAX_DISTANCE) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    const frac = n / cells;
    const cy = sumY / n / gh;
    if (frac < 0.0005 || frac > 0.015) continue; // dust, or a door
    if (cy < 0.3 || cy > 0.8) continue; // the head, or the floor
    if ((maxX - minX + 1) / gw > 0.25) continue; // wider than any arm
    if ((maxY - minY + 1) / gh > 0.3) continue; // taller than an arm hanging from the elbow
    out.push({
      box: { x: minX / gw, y: minY / gh, w: (maxX - minX + 1) / gw, h: (maxY - minY + 1) / gh },
      part: "hand",
      size: n,
    });
  }
  return out
    .sort((a, b) => b.size - a.size)
    .slice(0, 4)
    .map(({ box, part }) => ({ box, part }));
}

/** Every measurement region from the pixels alone. */
export function detectRegions(face: RawImage, body?: RawImage | null): MeasureRegions {
  const faceBox = detectFaceBox(face);
  const faceRegions = faceBox ? faceRegionsFromBox(faceBox) : null;
  let faceRgb: Rgb | null = null;
  if (body && faceRegions) {
    const cheeks = [faceRegions.cheekLeft, faceRegions.cheekRight]
      .map((b) => (b ? medianSkinInBox(face, b)?.rgb : null))
      .filter((c): c is Rgb => Boolean(c));
    if (cheeks.length) faceRgb = medianRgb(cheeks);
  }
  return {
    ...(faceRegions ?? {}),
    neutralReference: null,
    bodySkin: body ? detectBodySkin(body, faceRgb) : [],
  };
}

/**
 * Colour cast of the light. With a trusted neutral reference (a white wall or
 * shirt the model vouches for) the gains simply neutralise its mean; otherwise
 * a white-patch estimate on the brightest low-chroma pixels. Gains are clamped
 * to ±25 % so a cream wall cannot swing a portrait blue.
 */
export function estimateCastGains(
  img: RawImage,
  reference?: { box: NormBox; trulyNeutral: boolean } | null,
  opts?: {
    /** Skin / hair boxes to keep out of the white-patch sample. */
    exclude?: NormBox[];
    /** Only pixels brighter than this count as "white" — the wall must out-light the skin. */
    minLightness?: number;
  },
): CastGains {
  const NONE: CastGains = { gains: [1, 1, 1], strength: 0, source: "none" };
  let mean: Rgb | null = null;
  let source: CastGains["source"] = "none";
  if (reference?.trulyNeutral) {
    const { pixels } = boxPixels(img, reference.box);
    const usable = pixels.filter((p) => {
      const { l } = rgbToHsl(p);
      return chroma(p) < 0.3 && l > 0.25 && l < 0.98;
    });
    if (usable.length >= 25) {
      mean = medianRgb(usable);
      source = "reference";
    }
  }
  if (!mean) {
    // A warm-lit white wall and light skin share chromaticity, so skin cannot
    // be told apart by colour here — it is kept out by its boxes and by the
    // requirement that "white" be brighter than the skin.
    const excluded = (opts?.exclude ?? []).map((b) => clampBox(img, b));
    const minL = Math.max(0.5, opts?.minLightness ?? 0.5);
    const { x0, y0, x1, y1 } = clampBox(img, { x: 0, y: 0, w: 1, h: 1 });
    const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
    const candidates: Rgb[] = [];
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        if (excluded.some((e) => x >= e.x0 && x < e.x1 && y >= e.y0 && y < e.y1)) continue;
        const p = pixelAt(img, x, y);
        const { l } = rgbToHsl(p);
        if (chroma(p) < 0.22 && l > minL && l < 0.985) candidates.push(p);
      }
    }
    if (candidates.length < 100) return NONE;
    const bright = [...candidates]
      .sort((a, b) => rgbToHsl(b).l - rgbToHsl(a).l)
      .slice(0, Math.max(100, Math.floor(candidates.length * 0.05)));
    mean = medianRgb(bright);
    source = "white-patch";
  }
  const avg = (mean[0] + mean[1] + mean[2]) / 3;
  if (avg <= 0) return NONE;
  const raw: Rgb = [avg / Math.max(1, mean[0]), avg / Math.max(1, mean[1]), avg / Math.max(1, mean[2])];
  const clamp = (g: number) => Math.max(0.8, Math.min(1.25, g));
  const gains: Rgb = [clamp(raw[0]), clamp(raw[1]), clamp(raw[2])];
  const strength = Math.max(...gains.map((g) => Math.abs(g - 1)));
  return { gains, strength, source };
}

export function applyGains(rgb: Rgb, gains: Rgb): Rgb {
  return [
    Math.min(255, rgb[0] * gains[0]),
    Math.min(255, rgb[1] * gains[1]),
    Math.min(255, rgb[2] * gains[2]),
  ];
}

/** Direction of a cast from its gains: a warm light needs blue boosted. */
export function castDirection(cast: CastGains): "neutral" | "warm" | "cool" {
  if (cast.strength < 0.04) return "neutral";
  return cast.gains[2] > cast.gains[0] ? "warm" : "cool";
}

/**
 * Is a measured hair colour believable for the model's hair words? Dark hair
 * cannot read light (a box on the wall), light hair cannot read near-black.
 * Unknown or unusual words trust the sample.
 */
export function hairSamplePlausible(hex: string, hairColor?: string | null): boolean {
  if (!hairColor) return true;
  const c = hairColor.toLowerCase();
  const { l } = hexToHsl(hex);
  if (/\b(grey|gray|silver|white|salt)\b/.test(c)) return l >= 0.4;
  if (/\b(blond|blonde|golden|fair|light)\b/.test(c)) return l >= 0.3;
  if (/\b(black|jet|espresso|dark|brunette|brown|chestnut|auburn|ginger|red)\b/.test(c)) {
    return l <= 0.5;
  }
  return true;
}

/* ------------------------------ undertone ------------------------------- */

/** Lab hue angle at / above which corrected skin reads warm (golden). */
export const UNDERTONE_WARM_MIN_ANGLE = 60;
/** Lab hue angle at / below which corrected skin reads cool (rosy). */
export const UNDERTONE_COOL_MAX_ANGLE = 48;

export function undertoneFromHueAngle(angle: number): Undertone {
  if (angle >= UNDERTONE_WARM_MIN_ANGLE) return "warm";
  if (angle <= UNDERTONE_COOL_MAX_ANGLE) return "cool";
  return "neutral";
}

/**
 * Undertone from several corrected skin samples. Body skin (hands, forearms,
 * neck) outweighs cheeks, which flush red and drag the angle down. Confidence
 * is the margin to the nearest class boundary scaled by how many samples agree.
 */
export function undertoneFromSkinSamples(
  samples: { corrected: Rgb; weight: number }[],
): { undertone: Undertone; hueAngle: number; confidence: number } {
  const usable = samples.filter((s) => s.weight > 0);
  if (!usable.length) return { undertone: "neutral", hueAngle: 54, confidence: 0 };
  let sumW = 0;
  let sumA = 0;
  const votes: Undertone[] = [];
  for (const s of usable) {
    const lab = rgbToLab(s.corrected);
    const angle = labHueAngle(lab.a, lab.b);
    sumW += s.weight;
    sumA += angle * s.weight;
    votes.push(undertoneFromHueAngle(angle));
  }
  const hueAngle = sumA / sumW;
  const undertone = undertoneFromHueAngle(hueAngle);
  const margin =
    undertone === "warm"
      ? hueAngle - UNDERTONE_WARM_MIN_ANGLE
      : undertone === "cool"
        ? UNDERTONE_COOL_MAX_ANGLE - hueAngle
        : Math.min(hueAngle - UNDERTONE_COOL_MAX_ANGLE, UNDERTONE_WARM_MIN_ANGLE - hueAngle);
  const agreement = votes.filter((v) => v === undertone).length / votes.length;
  const confidence = Math.max(0, Math.min(1, margin / 8)) * agreement;
  return { undertone, hueAngle, confidence };
}

/* ------------------------------- contrast ------------------------------- */

/**
 * Skin / hair lightness spread that reads as high contrast. Light skin under a
 * corrected indoor exposure sits around l 0.62–0.70, near-black hair at 0.22–
 * 0.26: a spread of 0.38+ is fair-skin-dark-hair territory.
 *
 * Calibration (2026-09-06): dark-chestnut hair (L≈0.22) on medium skin (L≈0.65)
 * is a spread of 0.45 and a stylist calls it MEDIUM — "high" is near-black hair
 * on fair skin, 0.5 and above. 0.38 sent every dark-haired man to high.
 */
export const CONTRAST_HIGH_MIN_SPREAD = 0.5;
/** Spread at / below which colouring reads low contrast (blonde on fair). */
export const CONTRAST_LOW_MAX_SPREAD = 0.18;

export function contrastFromSpread(spread: number): Contrast {
  if (spread >= CONTRAST_HIGH_MIN_SPREAD) return "high";
  if (spread <= CONTRAST_LOW_MAX_SPREAD) return "low";
  return "medium";
}

/* ------------------------------ orchestration --------------------------- */

const REGION_WEIGHT: Record<string, number> = {
  forehead: 1.5,
  cheekLeft: 1,
  cheekRight: 1,
  // On men the "neck" box often lands on stubble or the shadow under the jaw.
  neck: 1,
  hand: 2,
  forearm: 2,
  chest: 1.5,
  other: 1,
};

/** Face samples must agree in lightness with each other (and the model's read) within this. */
export const FACE_SAMPLE_MAX_DL = 0.16;
/**
 * Body samples must sit within this hue / lightness of the corrected face skin.
 * Beige doors and floor tiles pass the skin gate but sit 15°+ yellower than
 * the face; real forearms stay within a few degrees.
 */
export const BODY_SAMPLE_MAX_HUE = 15;
export const BODY_SAMPLE_MAX_DL = 0.3;

/** Fallback boxes when the model returned none: a portrait is mostly face. */
const DEFAULT_FACE_SKIN: NormBox = { x: 0.32, y: 0.34, w: 0.36, h: 0.36 };
const DEFAULT_HAIR: NormBox = { x: 0.3, y: 0.06, w: 0.4, h: 0.16 };

export function measureColouring(opts: {
  face: RawImage;
  body?: RawImage | null;
  regions?: MeasureRegions | null;
  /** The model's own cast verdict — a non-neutral hint applies the correction even when weak. */
  castHint?: LightingCast | null;
  /** The model's mid-cheek hex — a lightness anchor for throwing out mislocated boxes. */
  modelSkinHex?: string | null;
  /** The model's hair colour words — a hair box that reads white on "dark brown" hair sat on the wall. */
  hairColor?: string | null;
}): ColouringMeasurement | null {
  const { face, body } = opts;
  const regions: MeasureRegions = opts.regions ?? detectRegions(face, body);
  const hinted = Boolean(opts.castHint && opts.castHint !== "neutral");
  const rejected: RejectedSample[] = [];

  // 1. Raw skin samples on the portrait.
  type RawSample = Omit<SkinSample, "corrected"> & { box: NormBox };
  const faceRaw: RawSample[] = [];
  const faceRegions: [string, NormBox | null | undefined][] = [
    ["forehead", regions.forehead],
    ["cheekLeft", regions.cheekLeft],
    ["cheekRight", regions.cheekRight],
    ["neck", regions.neck],
  ];
  for (const [name, box] of faceRegions) {
    if (!box) continue;
    const m = medianSkinInBox(face, box);
    if (!m) continue;
    faceRaw.push({
      region: name,
      image: 0,
      raw: m.rgb,
      weight: REGION_WEIGHT[name] ?? 1,
      pixels: m.pixels,
      coverage: m.coverage,
      box,
    });
  }
  const boxesGiven = faceRegions.filter(([, b]) => b).length;
  const pushCentre = () => {
    const m = medianSkinInBox(face, DEFAULT_FACE_SKIN);
    if (!m) return;
    faceRaw.push({
      region: "face-centre",
      image: 0,
      raw: m.rgb,
      weight: 1,
      pixels: m.pixels,
      coverage: m.coverage,
      box: DEFAULT_FACE_SKIN,
    });
  };
  if (!faceRaw.length) pushCentre();

  // 1b. Plausibility: face samples must agree in lightness. A "neck" box on
  //     stubble or in the shadow under the jaw reads 0.2–0.3 darker than the
  //     cheeks and, weighted, would drag the skin tone (and the contrast read)
  //     down. The model's own cheek hex anchors the reference when present.
  if (faceRaw.length > 1 || opts.modelSkinHex) {
    const modelHex = opts.modelSkinHex ? /^#?[0-9a-f]{6}$/i.test(opts.modelSkinHex) : false;
    const modelL = modelHex ? hexToHsl(opts.modelSkinHex!).l : null;
    const lights = faceRaw.map((r) => rgbToHsl(r.raw).l);
    // Three samples vote among themselves; the model's hex anchors only a thin basis.
    const refL = faceRaw.length >= 3 ? median(lights) : (modelL ?? median(lights));
    const keep = faceRaw.filter((r) => Math.abs(rgbToHsl(r.raw).l - refL) <= FACE_SAMPLE_MAX_DL);
    const dropped = faceRaw.filter((r) => !keep.includes(r));
    if (keep.length) {
      for (const r of dropped) {
        rejected.push({
          region: r.region,
          image: 0,
          hex: rgbToHex(r.raw),
          reason: `lightness ${rgbToHsl(r.raw).l.toFixed(2)} vs reference ${refL.toFixed(2)}`,
        });
      }
      faceRaw.splice(0, faceRaw.length, ...keep);
    }
  }
  // Most of the boxes missed: one survivor (often the "neck", the darkest
  // region) is a thin basis. Add the portrait centre when it agrees with the
  // reference lightness; a portrait is mostly face.
  if (boxesGiven >= 2 && faceRaw.length < 2) {
    const before = faceRaw.length;
    pushCentre();
    const centre = faceRaw[before];
    if (centre) {
      const modelHex = opts.modelSkinHex && /^#?[0-9a-f]{6}$/i.test(opts.modelSkinHex) ? opts.modelSkinHex : null;
      const refL = modelHex ? hexToHsl(modelHex).l : faceRaw[0] ? rgbToHsl(faceRaw[0].raw).l : null;
      if (refL != null && Math.abs(rgbToHsl(centre.raw).l - refL) > FACE_SAMPLE_MAX_DL) {
        rejected.push({
          region: "face-centre",
          image: 0,
          hex: rgbToHex(centre.raw),
          reason: `lightness ${rgbToHsl(centre.raw).l.toFixed(2)} vs reference ${refL.toFixed(2)}`,
        });
        faceRaw.splice(before, 1);
      }
    }
  }

  // 2. The light's cast, estimated away from the skin (its boxes excluded, and
  //    "white" must be brighter than the skin) — a warm-lit wall shares the
  //    chromaticity of light skin.
  const skinL = faceRaw.length
    ? Math.max(...faceRaw.map((r) => rgbToHsl(r.raw).l))
    : 0.5;
  const hairBox = regions.hair ?? DEFAULT_HAIR;
  const cast = estimateCastGains(face, regions.neutralReference ?? null, {
    exclude: [...faceRaw.map((r) => r.box), hairBox],
    minLightness: skinL + 0.08,
  });
  const castApplied = cast.source !== "none" && (hinted || cast.strength >= 0.06);
  const correct = (rgb: Rgb): Rgb => (castApplied ? applyGains(rgb, cast.gains) : rgb);
  const toSample = (r: RawSample, corrected: Rgb): SkinSample => ({
    region: r.region,
    image: r.image,
    raw: r.raw,
    corrected,
    weight: r.weight,
    pixels: r.pixels,
    coverage: r.coverage,
  });
  const samples: SkinSample[] = faceRaw.map((r) => toSample(r, correct(r.raw)));

  // 3. Body skin, measured in its own light — its own cast estimate applies.
  let bodySkinUsed = false;
  if (body && regions.bodySkin?.length) {
    const bodyRaw: RawSample[] = [];
    for (const part of regions.bodySkin.slice(0, 4)) {
      const m = medianSkinInBox(body, part.box);
      if (!m) continue;
      bodyRaw.push({
        region: part.part,
        image: 1,
        raw: m.rgb,
        weight: REGION_WEIGHT[part.part] ?? 1,
        pixels: m.pixels,
        coverage: m.coverage,
        box: part.box,
      });
    }
    if (bodyRaw.length) {
      const bodyL = Math.max(...bodyRaw.map((r) => rgbToHsl(r.raw).l));
      const bodyCast = estimateCastGains(body, null, {
        exclude: bodyRaw.map((r) => r.box),
        minLightness: bodyL + 0.08,
      });
      const applyBody = bodyCast.source !== "none" && (hinted || bodyCast.strength >= 0.06);
      // Plausibility: a beige door or floor tile passes the skin gate. Body skin
      // must sit near the corrected face skin in hue and lightness.
      const faceRef = samples.length ? rgbToHsl(medianRgb(samples.map((s) => s.corrected))) : null;
      for (const r of bodyRaw) {
        const corrected = applyBody ? applyGains(r.raw, bodyCast.gains) : r.raw;
        const c = rgbToHsl(corrected);
        if (faceRef) {
          const hueGap = Math.min(Math.abs(c.h - faceRef.h), 360 - Math.abs(c.h - faceRef.h));
          if (hueGap > BODY_SAMPLE_MAX_HUE || Math.abs(c.l - faceRef.l) > BODY_SAMPLE_MAX_DL) {
            rejected.push({
              region: r.region,
              image: 1,
              hex: rgbToHex(corrected),
              reason: `hue ${Math.round(c.h)}° / lightness ${c.l.toFixed(2)} vs face ${Math.round(faceRef.h)}° / ${faceRef.l.toFixed(2)}`,
            });
            continue;
          }
        }
        bodySkinUsed = true;
        samples.push(toSample(r, corrected));
      }
      // Body evidence refines the face, it never outvotes it: cap the body's
      // total weight at the face's.
      const faceWeight = samples.filter((s) => s.image === 0).reduce((a, s) => a + s.weight, 0);
      const bodyWeight = samples.filter((s) => s.image === 1).reduce((a, s) => a + s.weight, 0);
      if (faceWeight > 0 && bodyWeight > faceWeight) {
        const k = faceWeight / bodyWeight;
        for (const s of samples) if (s.image === 1) s.weight *= k;
      }
    }
  }
  if (!samples.length) return null;

  // Skin tone for the palette and for contrast comes from the PORTRAIT only —
  // the hair is measured in the same light, and the body photo is usually
  // darker or lit differently. Body samples vote on undertone below.
  const faceSamples = samples.filter((s) => s.image === 0);
  const weighted: Rgb[] = [];
  const weightedRaw: Rgb[] = [];
  for (const s of faceSamples.length ? faceSamples : samples) {
    const n = Math.max(1, Math.round(s.weight * 2));
    for (let i = 0; i < n; i++) {
      weighted.push(s.corrected);
      weightedRaw.push(s.raw);
    }
  }
  const skin = medianRgb(weighted);
  const skinRaw = medianRgb(weightedRaw);

  let hairRaw = medianHairInBox(face, hairBox, estimateBackground(face));
  let hair = hairRaw ? correct(hairRaw) : null;
  // The hair box on the wall reads near-white; "dark brown" hair cannot.
  if (hair && !hairSamplePlausible(rgbToHex(hair), opts.hairColor)) {
    rejected.push({
      region: "hair",
      image: 0,
      hex: rgbToHex(hair),
      reason: `hair lightness ${rgbToHsl(hair).l.toFixed(2)} vs "${opts.hairColor}"`,
    });
    hair = null;
    hairRaw = null;
  }

  const tone = undertoneFromSkinSamples(samples);
  // A white-patch estimate on an unverified wall is a weaker basis than a vouched reference.
  const confidence =
    castApplied && cast.source === "white-patch" ? tone.confidence * 0.8 : tone.confidence;

  const spread = hair ? Math.abs(rgbToHsl(skin).l - rgbToHsl(hair).l) : null;

  return {
    skinHex: rgbToHex(skin),
    skinRawHex: rgbToHex(skinRaw),
    hairHex: hair ? rgbToHex(hair) : null,
    hairRawHex: hairRaw ? rgbToHex(hairRaw) : null,
    skinSamples: samples,
    rejected,
    bodySkinUsed,
    cast,
    castDirection: castDirection(cast),
    castApplied,
    undertone: tone.undertone,
    undertoneHueAngle: tone.hueAngle,
    undertoneConfidence: confidence,
    contrast: spread == null ? null : contrastFromSpread(spread),
    contrastSpread: spread,
  };
}

/**
 * Which side of neutral a neutral read leans to. "Neutral-cool" and
 * "neutral-warm" are the colour analyst's own terms: a neutral client's
 * season family follows the lean rather than a model word that changes
 * between runs of the same photos. Needs three skin samples and a lean of at
 * least NEUTRAL_LEAN_MIN_DEG from the midpoint of the neutral band.
 */
export const NEUTRAL_LEAN_MIN_DEG = 2;
export function neutralLean(
  measured: Pick<ColouringMeasurement, "undertone" | "undertoneHueAngle" | "skinSamples"> | null,
): "warm" | "cool" | null {
  if (!measured || measured.undertone !== "neutral" || measured.skinSamples.length < 3) return null;
  const mid = (UNDERTONE_WARM_MIN_ANGLE + UNDERTONE_COOL_MAX_ANGLE) / 2;
  const lean = measured.undertoneHueAngle - mid;
  if (Math.abs(lean) < NEUTRAL_LEAN_MIN_DEG) return null;
  return lean < 0 ? "cool" : "warm";
}

/* ------------------------------ reconciling ----------------------------- */

/** Degrees of Lab hue the measurement must sit past the model's boundary to overrule it. */
export const UNDERTONE_OVERRIDE_MARGIN_NEUTRAL_LIGHT = 8;
export const UNDERTONE_OVERRIDE_MARGIN_TINTED_LIGHT = 5;
/** A measured warm / cool call closer than this to its own boundary is reported as neutral. */
export const UNDERTONE_OWN_MARGIN_MIN = 3;

/**
 * Model verdict vs measurement. What matters is how far the measured hue angle
 * sits from the boundary of the class the MODEL chose: skin at 50° is clearly
 * not warm (warm starts at 60°) even when the measurement itself hovers
 * between neutral and cool. Under tinted light the model judged the same
 * tinted pixels, so the bar is lower. Otherwise the model stands.
 */
export function reconcileUndertone(
  model: Undertone,
  measured: Pick<ColouringMeasurement, "undertone" | "undertoneHueAngle" | "undertoneConfidence"> | null,
  lighting?: LightingCast | null,
): Undertone {
  if (!measured) return model;
  if (measured.undertone === model) return model;
  const angle = measured.undertoneHueAngle;
  const margin =
    model === "warm"
      ? UNDERTONE_WARM_MIN_ANGLE - angle
      : model === "cool"
        ? angle - UNDERTONE_COOL_MAX_ANGLE
        : measured.undertone === "warm"
          ? angle - UNDERTONE_WARM_MIN_ANGLE
          : UNDERTONE_COOL_MAX_ANGLE - angle;
  const bar =
    lighting && lighting !== "neutral"
      ? UNDERTONE_OVERRIDE_MARGIN_TINTED_LIGHT
      : UNDERTONE_OVERRIDE_MARGIN_NEUTRAL_LIGHT;
  if (margin < bar) return model;
  // "Not warm" can be certain while cool-vs-neutral is a toss-up: 47° is cool
  // by less than a degree. Report neutral rather than flip-flop on noise.
  const ownMargin =
    measured.undertone === "warm"
      ? angle - UNDERTONE_WARM_MIN_ANGLE
      : measured.undertone === "cool"
        ? UNDERTONE_COOL_MAX_ANGLE - angle
        : Infinity;
  return ownMargin < UNDERTONE_OWN_MARGIN_MIN ? "neutral" : measured.undertone;
}

/**
 * Lightness spread is robust to tint, so a decisive spread overrides the model
 * in both directions; an indecisive one only pulls an extreme verdict back to
 * medium.
 */
export function reconcileContrast(
  model: Contrast,
  measured: Pick<ColouringMeasurement, "contrastSpread"> | null,
): Contrast {
  const spread = measured?.contrastSpread;
  if (spread == null) return model;
  if (spread >= CONTRAST_HIGH_MIN_SPREAD) return "high";
  if (spread <= CONTRAST_LOW_MAX_SPREAD) return "low";
  if (model === "high" && spread < 0.3) return "medium";
  if (model === "low" && spread > 0.3) return "medium";
  return model;
}
