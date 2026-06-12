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

  const allowed =
    verifySignedAssetProxyUrl(storagePath, exp, sig) ||
    (await canAccessAssetPath(storagePath));

  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const bytes = await downloadAssetBytes(storagePath);
  if (!bytes) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": contentTypeForAssetPath(storagePath),
      "Cache-Control":
        "private, max-age=86400, stale-while-revalidate=604800",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
