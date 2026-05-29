import "server-only";
import { env, hasVTON } from "@/lib/env";

// fal.ai virtual try-on endpoint (FASHN). Override via FAL_TRYON_MODEL if needed.
const FAL_MODEL = process.env.FAL_TRYON_MODEL || "fal-ai/fashn/tryon/v1.6";

/**
 * Run a virtual try-on: place `garmentImageUrl` onto `personImageUrl`.
 * Returns generated image bytes, or null in demo mode / on failure.
 */
export async function runTryOn(opts: {
  personImageUrl: string;
  garmentImageUrl: string;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasVTON) return null;
  const auth = { Authorization: `Key ${env.falKey}` };

  try {
    const submit = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_image: opts.personImageUrl,
        garment_image: opts.garmentImageUrl,
      }),
    });
    if (!submit.ok) return null;
    const queued = (await submit.json()) as {
      status_url?: string;
      response_url?: string;
    };
    if (!queued.status_url || !queued.response_url) return null;

    // Poll the queue (up to ~60s).
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const s = await fetch(queued.status_url, { headers: auth });
      const sj = (await s.json()) as { status?: string };
      if (sj.status === "COMPLETED") break;
      if (sj.status === "FAILED" || sj.status === "ERROR") return null;
    }

    const res = await fetch(queued.response_url, { headers: auth });
    const rj = (await res.json()) as {
      images?: { url: string }[];
      image?: { url: string };
    };
    const imgUrl = rj.images?.[0]?.url ?? rj.image?.url;
    if (!imgUrl) return null;

    const imgRes = await fetch(imgUrl);
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    return {
      bytes,
      mediaType: imgRes.headers.get("content-type") ?? "image/png",
    };
  } catch {
    return null;
  }
}
