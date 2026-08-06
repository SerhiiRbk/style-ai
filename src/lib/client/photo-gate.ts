import type { PhotoGatePurpose } from "@/lib/photo-gate-types";

const MAX_EDGE = 1280;

/** Read the shared anon id (cookie-first, then localStorage) without creating one. */
function readAnonId(): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie.match(/(?:^|;\s*)valetti_anon=([^;]+)/);
  if (cookie) return decodeURIComponent(cookie[1]);
  try {
    return localStorage.getItem("valetti_anon");
  } catch {
    return null;
  }
}

/**
 * Downscale + re-encode a File to a small JPEG data URL for the gate. Larger
 * than the colours 768px edge because full-length/crop judgements need a bit
 * more detail, but still well under the route's size cap.
 */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => createImageBitmap(file));
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * Browser-side photo gate. Returns `{ ok:false, error }` only on an explicit
 * model reject (HTTP 422). Every other outcome — network failure, 5xx, a route
 * outage, an unreadable file — **fails open** to `{ ok:true }` so gate
 * flakiness never blocks a real upload (the server already fail-opens provider
 * errors and logs `photo_gate_failopen`).
 */
export async function checkPhotoGateClient(args: {
  imageDataUrl?: string;
  file?: File;
  purpose: PhotoGatePurpose;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let image = args.imageDataUrl ?? "";
  if (!image && args.file) {
    try {
      image = await fileToDataUrl(args.file);
    } catch {
      return { ok: true }; // can't prepare it → don't block; downstream will handle
    }
  }
  if (!image) return { ok: true };

  try {
    const res = await fetch("/api/photo-gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, purpose: args.purpose, anonId: readAnonId() }),
    });
    if (res.status === 422) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "This photo doesn't work for this step.",
      };
    }
    // 200 (ok / skipped) or any 4xx/5xx / network → allow. Only an explicit
    // 422 reject blocks; everything else is fail-open by design.
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
