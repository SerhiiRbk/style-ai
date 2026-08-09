import { canAccessAssetPath, downloadAssetBytes } from "@/lib/data/asset-access";
import { contentTypeForAssetPath } from "@/lib/asset-url";
import { verifySignedAssetProxyUrl } from "@/lib/asset-token";
import { hasSupabaseAdmin } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cached proxy for private Supabase Storage objects.
 * Stable same-origin URLs let the browser and Next/Image cache responses.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!hasSupabaseAdmin) {
    return new Response("Not available", { status: 501 });
  }

  const segments = (await params).path;
  if (!segments?.length) {
    return new Response("Not found", { status: 404 });
  }

  const storagePath = segments.map((s) => decodeURIComponent(s)).join("/");
  if (!storagePath || storagePath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const exp = searchParams.get("exp");
  const sig = searchParams.get("sig");
  // `dl=1` forces the original full-resolution bytes as a download attachment;
  // `orig=1` serves the original inline (both skip WebP transcoding);
  // `wm=1` burns a `valetti.fit` watermark bottom-right (share / zoom views —
  // never the stored original or the PDF, which read bytes directly). Extra
  // params don't affect the signature, which only covers the path + expiry.
  const download = searchParams.get("dl") === "1";
  const watermark = searchParams.get("wm") === "1";
  const original = (download || searchParams.get("orig") === "1") && !watermark;

  const signedOk = verifySignedAssetProxyUrl(storagePath, exp, sig);
  const allowed = signedOk || (await canAccessAssetPath(storagePath));

  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const bytes = await downloadAssetBytes(storagePath);
  if (!bytes) {
    return new Response("Not found", { status: 404 });
  }

  const sourceType = contentTypeForAssetPath(storagePath);

  // Asset bytes for a given path never change (generated once), so cache them
  // aggressively as immutable. Signed URLs are self-contained auth and are
  // day-stable, so they're safe to cache at the edge (public + s-maxage);
  // cookie-authed requests stay browser-private.
  const cacheControl = signedOk
    ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable"
    : "private, max-age=86400, stale-while-revalidate=604800, immutable";

  if (original) {
    const headers: Record<string, string> = {
      "Content-Type": sourceType,
      "Cache-Control": cacheControl,
      "Content-Length": String(bytes.byteLength),
    };
    if (download) {
      const base = storagePath.split("/").pop() || "image";
      const filename = base.startsWith("valetti-") ? base : `valetti-${base}`;
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }
    return new Response(bytes as BodyInit, { headers });
  }

  const { body, contentType } = watermark
    ? await watermarked(request, bytes, sourceType)
    : await maybeWebp(request, bytes, sourceType);

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Content-Length": String(body.byteLength),
      // Cache key must account for WebP vs. original negotiation.
      Vary: "Accept",
    },
  });
}

// Pre-rendered vector outline of the "valetti.fit" wordmark (Arial Bold, em
// size 100, baseline at y=0). Baked to a path so the watermark never depends on
// fonts being installed in the serverless runtime — librsvg has none, so SVG
// `<text>` there renders as tofu boxes.
const WORDMARK_PATH =
  "M33.79 0L21.44 0L0.54-51.86L14.94-51.86L24.71-25.39L27.54-16.55Q28.66-19.92 28.96-21Q29.64-23.19 30.42-25.39L40.28-51.86L54.39-51.86L33.79 0M73.05-36.04L60.60-38.28Q62.70-45.80 67.82-49.41Q72.95-53.03 83.06-53.03Q92.24-53.03 96.73-50.85Q101.22-48.68 103.05-45.34Q104.88-41.99 104.88-33.06L104.74-17.04Q104.74-10.21 105.40-6.96Q106.05-3.71 107.86 0L94.29 0Q93.75-1.37 92.97-4.05Q92.63-5.27 92.48-5.66Q88.96-2.25 84.96-0.54Q80.96 1.17 76.42 1.17Q68.41 1.17 63.79-3.17Q59.18-7.52 59.18-14.16Q59.18-18.55 61.28-22Q63.38-25.44 67.16-27.27Q70.95-29.10 78.08-30.47Q87.70-32.28 91.41-33.84L91.41-35.21Q91.41-39.16 89.45-40.84Q87.50-42.53 82.08-42.53Q78.42-42.53 76.37-41.09Q74.32-39.65 73.05-36.04M91.41-22.17L91.41-24.90Q88.77-24.02 83.06-22.80Q77.34-21.58 75.59-20.41Q72.90-18.51 72.90-15.58Q72.90-12.70 75.05-10.60Q77.20-8.50 80.52-8.50Q84.23-8.50 87.60-10.94Q90.09-12.79 90.87-15.48Q91.41-17.24 91.41-22.17M132.13 0L118.41 0L118.41-71.58L132.13-71.58L132.13 0M176.22-16.50L189.89-14.21Q187.26-6.69 181.57-2.76Q175.88 1.17 167.33 1.17Q153.81 1.17 147.31-7.67Q142.19-14.75 142.19-25.54Q142.19-38.43 148.93-45.73Q155.66-53.03 165.97-53.03Q177.54-53.03 184.23-45.39Q190.92-37.74 190.63-21.97L156.25-21.97Q156.40-15.87 159.57-12.48Q162.74-9.08 167.48-9.08Q170.70-9.08 172.90-10.84Q175.10-12.60 176.22-16.50M156.49-30.37L177-30.37Q176.86-36.33 173.93-39.43Q171-42.53 166.80-42.53Q162.30-42.53 159.38-39.26Q156.45-35.99 156.49-30.37M216.21-51.86L225.59-51.86L225.59-40.92L216.21-40.92L216.21-20.02Q216.21-13.67 216.48-12.62Q216.75-11.57 217.70-10.89Q218.65-10.21 220.02-10.21Q221.92-10.21 225.54-11.52L226.71-0.88Q221.92 1.17 215.87 1.17Q212.16 1.17 209.18-0.07Q206.20-1.32 204.81-3.30Q203.42-5.27 202.88-8.64Q202.44-11.04 202.44-18.31L202.44-40.92L196.14-40.92L196.14-51.86L202.44-51.86L202.44-62.16L216.21-70.17L216.21-51.86M249.51-51.86L258.89-51.86L258.89-40.92L249.51-40.92L249.51-20.02Q249.51-13.67 249.78-12.62Q250.05-11.57 251-10.89Q251.95-10.21 253.32-10.21Q255.22-10.21 258.84-11.52L260.01-0.88Q255.22 1.17 249.17 1.17Q245.46 1.17 242.48-0.07Q239.50-1.32 238.11-3.30Q236.72-5.27 236.18-8.64Q235.74-11.04 235.74-18.31L235.74-40.92L229.44-40.92L229.44-51.86L235.74-51.86L235.74-62.16L249.51-70.17L249.51-51.86M282.13-58.89L268.41-58.89L268.41-71.58L282.13-71.58L282.13-58.89M282.13 0L268.41 0L268.41-51.86L282.13-51.86L282.13 0M309.91 0L296.19 0L296.19-13.72L309.91-13.72L309.91 0M317.97-41.06L317.97-51.86L325.59-51.86L325.59-55.76Q325.59-62.30 326.98-65.53Q328.37-68.75 332.10-70.78Q335.84-72.80 341.55-72.80Q347.41-72.80 353.03-71.04L351.17-61.47Q347.90-62.26 344.87-62.26Q341.89-62.26 340.60-60.86Q339.31-59.47 339.31-55.52L339.31-51.86L349.56-51.86L349.56-41.06L339.31-41.06L339.31 0L325.59 0L325.59-41.06L317.97-41.06M371-58.89L357.28-58.89L357.28-71.58L371-71.58L371-58.89M371 0L357.28 0L357.28-51.86L371-51.86L371 0M399.46-51.86L408.84-51.86L408.84-40.92L399.46-40.92L399.46-20.02Q399.46-13.67 399.73-12.62Q400-11.57 400.95-10.89Q401.90-10.21 403.27-10.21Q405.18-10.21 408.79-11.52L409.96-0.88Q405.18 1.17 399.12 1.17Q395.41 1.17 392.43-0.07Q389.45-1.32 388.06-3.30Q386.67-5.27 386.13-8.64Q385.69-11.04 385.69-18.31L385.69-40.92L379.39-40.92L379.39-51.86L385.69-51.86L385.69-62.16L399.46-70.17";
// Bounds of WORDMARK_PATH at em size 100 (from opentype.js getBoundingBox).
const WORDMARK_X2 = 409.96;
const WORDMARK_Y2 = 1.17;

/**
 * Burns a semi-transparent `valetti.fit` wordmark into the bottom-right corner
 * of a raster photo. Used only for share links and the report zoom view so the
 * image carries attribution when it leaves the site; the stored original and
 * PDF exports read raw bytes and stay clean. Falls back to the untouched bytes
 * if the asset isn't a raster or sharp is unavailable.
 */
async function watermarked(
  request: Request,
  bytes: Uint8Array,
  sourceType: string,
): Promise<{ body: Uint8Array; contentType: string }> {
  const original = { body: bytes, contentType: sourceType };

  if (
    sourceType !== "image/png" &&
    sourceType !== "image/jpeg" &&
    sourceType !== "image/webp"
  ) {
    return original;
  }

  try {
    const sharp = (await import("sharp")).default;
    // Bake EXIF orientation first so the overlay lands on the right corner.
    const rotated = await sharp(bytes).rotate().toBuffer({ resolveWithObject: true });
    const width = rotated.info.width ?? 0;
    const height = rotated.info.height ?? 0;
    if (!width || !height) return original;

    const fontSize = Math.min(64, Math.max(14, Math.round(width * 0.032)));
    const pad = Math.round(fontSize * 0.7);
    // Scale the em-100 outline to the target size and pin it bottom-right.
    const scale = fontSize / 100;
    const tx = width - pad - WORDMARK_X2 * scale;
    const ty = height - pad - WORDMARK_Y2 * scale;
    const svg = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
        `<g transform="translate(${(tx + 1).toFixed(2)},${(ty + 1).toFixed(2)}) scale(${scale.toFixed(4)})">` +
        `<path d="${WORDMARK_PATH}" fill="#000000" fill-opacity="0.35"/></g>` +
        `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(4)})">` +
        `<path d="${WORDMARK_PATH}" fill="#ffffff" fill-opacity="0.82"/></g>` +
        `</svg>`,
    );

    const pipeline = sharp(rotated.data).composite([{ input: svg, top: 0, left: 0 }]);
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("image/webp")) {
      const out = await pipeline.webp({ quality: 82 }).toBuffer();
      return { body: new Uint8Array(out), contentType: "image/webp" };
    }
    if (sourceType === "image/png") {
      const out = await pipeline.png().toBuffer();
      return { body: new Uint8Array(out), contentType: "image/png" };
    }
    const out = await pipeline.jpeg({ quality: 85 }).toBuffer();
    return { body: new Uint8Array(out), contentType: "image/jpeg" };
  } catch {
    return original;
  }
}

/**
 * Generated report photos are stored as large PNGs (~1MB+). When the browser
 * accepts WebP, transcode on the fly — typically a 5–7× size reduction — so
 * report pages load far faster. Falls back to the original bytes if the client
 * doesn't accept WebP, the asset isn't a raster photo, or sharp is unavailable.
 */
async function maybeWebp(
  request: Request,
  bytes: Uint8Array,
  sourceType: string,
): Promise<{ body: Uint8Array; contentType: string }> {
  const original = { body: bytes, contentType: sourceType };

  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("image/webp")) return original;
  if (sourceType !== "image/png" && sourceType !== "image/jpeg") {
    return original;
  }

  try {
    const sharp = (await import("sharp")).default;
    const webp = await sharp(bytes)
      .webp({ quality: 82 })
      .toBuffer();
    // Only use it if it actually helps.
    if (webp.byteLength < bytes.byteLength) {
      return { body: new Uint8Array(webp), contentType: "image/webp" };
    }
    return original;
  } catch {
    return original;
  }
}
