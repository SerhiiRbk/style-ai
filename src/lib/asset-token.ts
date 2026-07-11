import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { assetProxyUrl } from "@/lib/asset-url";
import { env } from "@/lib/env";

/** Signature validity window — generous so day-stable URLs never expire early. */
export const ASSET_URL_TTL_SEC = 604_800; // 7 days

/**
 * Daily buckets keep a given asset's signed URL identical for the whole UTC day,
 * so the browser and CDN actually reuse the cached bytes across page loads
 * instead of re-fetching a freshly-signed URL every hour.
 */
export const ASSET_SIGNATURE_BUCKET_SEC = 86_400;

function signingKey(): string | null {
  return process.env.ASSET_URL_SECRET ?? env.supabaseServiceKey ?? null;
}

function signPayload(storagePath: string, exp: number): string {
  const key = signingKey();
  if (!key) throw new Error("Asset signing key missing");
  return createHmac("sha256", key)
    .update(`${storagePath}\n${exp}`)
    .digest("base64url");
}

/** Expiry aligned to hourly buckets — same asset path reuses the same URL within a bucket. */
export function assetSignatureExpirySec(
  nowSec = Math.floor(Date.now() / 1000),
): number {
  const bucketStart =
    Math.floor(nowSec / ASSET_SIGNATURE_BUCKET_SEC) * ASSET_SIGNATURE_BUCKET_SEC;
  return bucketStart + ASSET_URL_TTL_SEC;
}

/** Same-origin asset URL with a short-lived HMAC so Next/Image can fetch without cookies. */
export function signedAssetProxyUrl(storagePath: string): string {
  const base = assetProxyUrl(storagePath);
  const key = signingKey();
  if (!key) return base;

  const exp = assetSignatureExpirySec();
  const sig = signPayload(storagePath, exp);
  return `${base}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
}

export function signedAssetProxyUrls(
  paths: (string | null | undefined)[],
): (string | undefined)[] {
  return paths.map((p) => (p ? signedAssetProxyUrl(p) : undefined));
}

export function verifySignedAssetProxyUrl(
  storagePath: string,
  exp: string | null,
  sig: string | null,
): boolean {
  const key = signingKey();
  if (!key || !exp || !sig) return false;

  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) {
    return false;
  }

  let expected: string;
  try {
    expected = signPayload(storagePath, expNum);
  } catch {
    return false;
  }

  try {
    const a = Buffer.from(decodeURIComponent(sig));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
