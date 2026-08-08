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
    const font = "Arial, Helvetica, sans-serif";
    const svg = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
        `<text x="${width - pad + 1}" y="${height - pad + 1}" text-anchor="end" ` +
        `font-family="${font}" font-weight="600" font-size="${fontSize}" ` +
        `fill="#000000" fill-opacity="0.35">valetti.fit</text>` +
        `<text x="${width - pad}" y="${height - pad}" text-anchor="end" ` +
        `font-family="${font}" font-weight="600" font-size="${fontSize}" ` +
        `fill="#ffffff" fill-opacity="0.72">valetti.fit</text>` +
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
