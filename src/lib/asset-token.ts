import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { assetProxyUrl } from "@/lib/asset-url";
import { env } from "@/lib/env";

/** Matches `Cache-Control: max-age=86400` on `/api/assets`. */
export const ASSET_URL_TTL_SEC = 86_400;

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

/** Same-origin asset URL with a short-lived HMAC so Next/Image can fetch without cookies. */
export function signedAssetProxyUrl(storagePath: string): string {
  const base = assetProxyUrl(storagePath);
  const key = signingKey();
  if (!key) return base;

  const exp = Math.floor(Date.now() / 1000) + ASSET_URL_TTL_SEC;
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
