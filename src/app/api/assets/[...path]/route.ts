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
  // `dl=1` forces the original full-resolution bytes as a download attachment
  // (skips WebP transcoding). Extra params don't affect the signature, which
  // only covers the storage path + expiry.
  const download = searchParams.get("dl") === "1";

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

  if (download) {
    const base = storagePath.split("/").pop() || "image";
    const filename = base.startsWith("valetti-") ? base : `valetti-${base}`;
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": sourceType,
        "Cache-Control": "private, max-age=86400, immutable",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // Asset bytes for a given path never change (generated once), so cache them
  // aggressively as immutable. Signed URLs are self-contained auth and are
  // day-stable, so they're safe to cache at the edge (public + s-maxage);
  // cookie-authed requests stay browser-private.
  const cacheControl = signedOk
    ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable"
    : "private, max-age=86400, stale-while-revalidate=604800, immutable";

  const { body, contentType } = await maybeWebp(request, bytes, sourceType);

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
