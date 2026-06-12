/** Browser-facing URL for a private `assets` bucket object (served via /api/assets). */
export const ASSET_PROXY_PREFIX = "/api/assets/";

export function assetProxyUrl(storagePath: string): string {
  const encoded = storagePath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${ASSET_PROXY_PREFIX}${encoded}`;
}

/** Reverse proxy URL → storage path, or null if not a proxy URL. */
export function storagePathFromProxyUrl(url: string): string | null {
  if (!url.startsWith(ASSET_PROXY_PREFIX)) return null;
  const tail = url.slice(ASSET_PROXY_PREFIX.length);
  if (!tail) return null;
  return tail.split("/").map((seg) => decodeURIComponent(seg)).join("/");
}

/** Extract storage path from a relative or absolute asset proxy src (ignores ?sig=). */
export function storagePathFromAssetSrc(src: string): string | null {
  const pathOnly = src.split("?")[0] ?? src;
  const direct = storagePathFromProxyUrl(pathOnly);
  if (direct) return direct;
  try {
    const pathname = new URL(src).pathname;
    return storagePathFromProxyUrl(pathname);
  } catch {
    return null;
  }
}

/** Best-effort report id embedded in an assets storage path. */
export function reportIdFromStoragePath(storagePath: string): string | null {
  const parts = storagePath.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[1] === "tryon") {
    const file = parts[2] ?? "";
    const m =
      /^look-([^./]+)-/.exec(file) ?? /^outfit-([^./]+)-/.exec(file);
    return m?.[1] ?? null;
  }
  return parts[1] ?? null;
}

export function contentTypeForAssetPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Whether a report image src is a generated asset (proxy or legacy signed URL). */
export function isGeneratedReportImage(src: string | undefined | null): boolean {
  if (!src) return false;
  return src.startsWith(ASSET_PROXY_PREFIX) || /^https?:\/\//.test(src);
}

/** Map nullable storage paths to proxy URLs (no network I/O). */
export function assetProxyUrls(
  paths: (string | null | undefined)[],
): (string | undefined)[] {
  return paths.map((p) => (p ? assetProxyUrl(p) : undefined));
}
