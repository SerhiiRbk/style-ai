import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env, hasVTON } from "@/lib/env";
import { absoluteUrl } from "@/lib/site-url";

// fal.ai virtual try-on endpoint (FASHN). Override via FAL_TRYON_MODEL if needed.
const FAL_MODEL = process.env.FAL_TRYON_MODEL || "fal-ai/fashn/tryon/v1.6";

/** Leave headroom under the /api/tryon maxDuration (120s). */
const MAX_WAIT_MS = 110_000;
const POLL_MS = 2_000;
const RESPONSE_RETRIES = 6;

export type TryOnResult =
  | { ok: true; bytes: Uint8Array; mediaType: string }
  | { ok: false; error: string };

type ImageForFalResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const IMAGE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; StylistAI/1.0; +https://valetti.fit)",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

type FalJsonResult =
  | { ok: true; body: unknown }
  | { ok: false; error: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mediaTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function normalizeImageUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return absoluteUrl(trimmed);
  return trimmed;
}

/** Read seeded catalogue placeholders from /public without a network round-trip. */
async function readPublicImage(sitePath: string): Promise<ImageForFalResult | null> {
  if (!sitePath.startsWith("/images/")) return null;
  try {
    const filePath = path.join(process.cwd(), "public", sitePath.replace(/^\//, ""));
    const bytes = await readFile(filePath);
    if (!bytes.length) {
      return { ok: false, error: "Garment image unavailable for this product" };
    }
    const mediaType = mediaTypeFromPath(filePath);
    return {
      ok: true,
      value: `data:${mediaType};base64,${bytes.toString("base64")}`,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve an image to a fal-ready value (data URI or public HTTPS URL).
 * Relative `/images/...` paths are common in the seed catalogue.
 */
async function prepareImageForFal(
  rawUrl: string,
  label: "person" | "garment",
): Promise<ImageForFalResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      ok: false,
      error:
        label === "person"
          ? "Could not read your photo"
          : "Garment image unavailable for this product",
    };
  }

  if (trimmed.startsWith("data:")) {
    return { ok: true, value: trimmed };
  }

  if (trimmed.startsWith("/")) {
    const local = await readPublicImage(trimmed);
    if (local) return local;
  }

  const url = normalizeImageUrl(trimmed);
  if (!url.startsWith("http")) {
    return { ok: false, error: "Garment image unavailable for this product" };
  }

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: IMAGE_FETCH_HEADERS,
    });
    if (!res.ok) {
      console.error(`[tryon] ${label} fetch failed`, res.status, url.slice(0, 120));
      if (label === "garment") {
        // fal may still load retailer CDNs our server cannot reach.
        return { ok: true, value: url };
      }
      return {
        ok: false,
        error: "Could not read your photo — try uploading again",
      };
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) {
      if (label === "garment") return { ok: true, value: url };
      return { ok: false, error: "Your photo file is empty" };
    }

    const mediaType =
      res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    return {
      ok: true,
      value: `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`,
    };
  } catch (e) {
    console.error(`[tryon] ${label} fetch error`, e);
    if (label === "garment") return { ok: true, value: url };
    return { ok: false, error: "Could not read your photo" };
  }
}

function friendlyFalError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("body pose") || lower.includes("detect body")) {
    return "Could not detect your body in the photo — upload a clear full-length shot";
  }
  if (lower.includes("garment image") || lower.includes("load garment")) {
    return "Could not load the product image for try-on";
  }
  if (lower.includes("model image") || lower.includes("load model")) {
    return "Could not load your photo for try-on";
  }
  if (lower.includes("moderation") || lower.includes("nsfw")) {
    return "Try-on blocked by content moderation";
  }
  return raw.length > 180 ? `${raw.slice(0, 177)}…` : raw;
}

function parseFalErrorBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;

  if (typeof r.detail === "string" && r.detail.trim()) {
    return friendlyFalError(r.detail.trim());
  }
  if (Array.isArray(r.detail)) {
    const parts = r.detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const msg = (item as { msg?: unknown }).msg;
        return typeof msg === "string" ? msg : null;
      })
      .filter((s): s is string => Boolean(s));
    if (parts.length) return friendlyFalError(parts.join("; "));
  }
  if (typeof r.error === "string" && r.error.trim()) {
    return friendlyFalError(r.error.trim());
  }
  if (typeof r.message === "string" && r.message.trim()) {
    return friendlyFalError(r.message.trim());
  }
  return null;
}

/** fal queue responses vary by model/version — normalize to a single image URL. */
function extractImageUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;

  const fromImages = (images: unknown): string | null => {
    if (!Array.isArray(images) || !images.length) return null;
    const first = images[0];
    if (typeof first === "string" && first.startsWith("http")) return first;
    if (first && typeof first === "object" && "url" in first) {
      const url = (first as { url?: unknown }).url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
    return null;
  };

  const direct = fromImages(r.images);
  if (direct) return direct;

  if (r.payload && typeof r.payload === "object") {
    const payload = r.payload as Record<string, unknown>;
    const nested = fromImages(payload.images);
    if (nested) return nested;
    const output = fromImages(payload.output);
    if (output) return output;
  }

  const output = fromImages(r.output);
  if (output) return output;

  if (r.image && typeof r.image === "object" && "url" in r.image) {
    const url = (r.image as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  return null;
}

/**
 * Run a virtual try-on: place `garmentImageUrl` onto `personImageUrl`.
 */
async function fetchFalResponse(
  responseUrl: string,
  auth: Record<string, string>,
): Promise<FalJsonResult> {
  for (let attempt = 0; attempt < RESPONSE_RETRIES; attempt++) {
    const res = await fetch(responseUrl, { headers: auth });
    if (res.ok) {
      return { ok: true, body: await res.json() };
    }

    const text = await res.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const message = parseFalErrorBody(parsed) ?? parseFalErrorBody({ detail: text });
    if (message) {
      console.error("[tryon] fal result error", res.status, message);
      return { ok: false, error: message };
    }

    // Transient: result not ready yet despite COMPLETED status.
    if (res.status === 404 || res.status === 425 || res.status === 202) {
      await sleep(1000 + attempt * 500);
      continue;
    }

    console.error("[tryon] fal response fetch failed", res.status, text.slice(0, 300));
    return { ok: false, error: "Could not fetch try-on result" };
  }

  return { ok: false, error: "Try-on result was not ready in time" };
}

export async function runTryOn(opts: {
  personImageUrl: string;
  garmentImageUrl: string;
}): Promise<TryOnResult> {
  if (!hasVTON) {
    return { ok: false, error: "Virtual try-on is not configured" };
  }
  const auth = { Authorization: `Key ${env.falKey}` };

  try {
    const person = await prepareImageForFal(opts.personImageUrl, "person");
    if (!person.ok) return person;
    const garment = await prepareImageForFal(opts.garmentImageUrl, "garment");
    if (!garment.ok) return garment;

    const submit = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_image: person.value,
        garment_image: garment.value,
      }),
    });
    if (!submit.ok) {
      const detail = await submit.text().catch(() => "");
      console.error("[tryon] fal submit failed", submit.status, detail.slice(0, 300));
      return { ok: false, error: "Could not start try-on generation" };
    }

    const queued = (await submit.json()) as {
      status_url?: string;
      response_url?: string;
    };
    if (!queued.status_url || !queued.response_url) {
      console.error("[tryon] fal submit missing queue URLs", queued);
      return { ok: false, error: "Invalid response from try-on service" };
    }

    const deadline = Date.now() + MAX_WAIT_MS;
    let completed = false;
    let resultUrl = queued.response_url;

    while (Date.now() < deadline) {
      const s = await fetch(queued.status_url, { headers: auth });
      if (s.ok) {
        const sj = (await s.json()) as {
          status?: string;
          error?: string;
          response_url?: string;
        };
        if (sj.response_url) resultUrl = sj.response_url;
        if (sj.status === "COMPLETED") {
          if (sj.error) {
            return { ok: false, error: friendlyFalError(sj.error) };
          }
          completed = true;
          break;
        }
        if (sj.status === "FAILED" || sj.status === "ERROR") {
          console.error("[tryon] fal job failed", sj);
          return {
            ok: false,
            error: sj.error
              ? friendlyFalError(sj.error)
              : "Try-on generation failed",
          };
        }
      }
      await sleep(POLL_MS);
    }

    if (!completed) {
      console.error("[tryon] fal job timed out before COMPLETED");
      return {
        ok: false,
        error: "Try-on is taking longer than expected — please try again",
      };
    }

    const fetched = await fetchFalResponse(resultUrl, auth);
    if (!fetched.ok) return fetched;
    const rj = fetched.body;
    const imgUrl = extractImageUrl(rj);
    if (!imgUrl) {
      console.error("[tryon] fal response missing image URL", rj);
      return { ok: false, error: "Try-on returned no image" };
    }

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) {
      console.error("[tryon] image download failed", imgRes.status);
      return { ok: false, error: "Could not download try-on image" };
    }

    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    return {
      ok: true,
      bytes,
      mediaType: imgRes.headers.get("content-type") ?? "image/png",
    };
  } catch (e) {
    console.error("[tryon] unexpected error", e);
    return { ok: false, error: "Try-on failed unexpectedly" };
  }
}
