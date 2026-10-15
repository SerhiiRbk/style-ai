import "server-only";
import type { LightingCast } from "@/lib/colour-palette";
import { measureColouring, sameShoot, type ColouringMeasurement, type RawImage } from "@/lib/photo-colour";

const MAX_EDGE = 640;
const FETCH_TIMEOUT_MS = 8000;

type SharpModule = typeof import("sharp");
let sharpLoad: Promise<SharpModule["default"] | null> | null = null;

/**
 * sharp is native code. Loading it at module top level pulled libvips into the
 * request path of every page that imports the pipeline, and on a runtime where
 * the platform binary is missing that took the report page down with a 500.
 * Load it lazily, once, and degrade to "no measurement" when it is unavailable.
 */
function loadSharp(): Promise<SharpModule["default"] | null> {
  if (!sharpLoad) {
    sharpLoad = import("sharp")
      .then((m) => m.default)
      .catch((err) => {
        console.warn(
          "[vision] sharp unavailable — pixel colour measurement disabled on this runtime",
          err instanceof Error ? err.message.split("\n")[0] : err,
        );
        return null;
      });
  }
  return sharpLoad;
}

/** Decode one photo, EXIF-upright, at most 640 px on the long edge. */
async function loadRawImage(url: string): Promise<RawImage | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buf)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 3 && info.channels !== 4) return null;
    return { data: new Uint8Array(data), width: info.width, height: info.height, channels: info.channels };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Measure the client's colouring from the actual photo pixels: the face and
 * hair are located from the skin mask, never asked of a model (model boxes sat
 * a tenth of the frame too high). Never throws — a fetch or decode problem
 * degrades to null and the caller keeps the model's read.
 */
export async function measurePhotoColouring(
  photos: { role: string; url: string; uploadedAt?: string }[],
  lighting: LightingCast | null | undefined,
  /** The model's mid-cheek hex — lightness anchor for rejecting mislocated samples. */
  modelSkinHex?: string | null,
  /** The model's hair colour words — a hair band that reads white on "dark brown" hair is wall. */
  hairColor?: string | null,
): Promise<ColouringMeasurement | null> {
  try {
    const face = photos.find((p) => p.role === "face") ?? photos[0];
    if (!face) return null;
    let body = photos.find((p) => p.role === "full" && p !== face) ?? null;
    // A report assembled from two shoots (a portrait reused from one upload, a
    // full-length photo from another) is measured on the portrait alone.
    let bodySkinSkipped: string | undefined;
    if (body && !sameShoot(face.uploadedAt, body.uploadedAt)) {
      console.warn("[vision] full-length photo is from another shoot — measuring the portrait only", {
        face: face.uploadedAt,
        body: body.uploadedAt,
      });
      body = null;
      bodySkinSkipped = "different-shoot";
    }
    const [faceImg, bodyImg] = await Promise.all([
      loadRawImage(face.url),
      body ? loadRawImage(body.url) : Promise.resolve(null),
    ]);
    if (!faceImg) return null;
    const measured = measureColouring({
      face: faceImg,
      body: bodyImg,
      castHint: lighting,
      modelSkinHex,
      hairColor,
    });
    return measured && bodySkinSkipped ? { ...measured, bodySkinSkipped } : measured;
  } catch (err) {
    console.warn("[vision] pixel measurement failed — keeping the model's read", err);
    return null;
  }
}
