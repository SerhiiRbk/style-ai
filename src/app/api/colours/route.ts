import { NextResponse } from "next/server";
import { analyzeColoursOnly } from "@/lib/ai/colour-analysis";

export const maxDuration = 60;

/** ~6 MB of base64 ≈ 4.5 MB image — comfortably above a 768px JPEG, below platform body limits. */
const MAX_DATA_URL_CHARS = 6_000_000;

/**
 * Best-effort in-memory rate limit. Serverless instances don't share memory, so
 * this only bounds bursts per warm instance — good enough for launch; move to a
 * durable store (Supabase/KV) before heavy paid traffic (see growth-plan §9).
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-vercel-forwarded-for") ??
    "unknown"
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many analyses just now — try again in a few minutes." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const image: unknown = body?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }
  if (image.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  try {
    // The image is analysed in-request and never persisted.
    const result = await analyzeColoursOnly(image);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[colours] analysis failed", err);
    return NextResponse.json(
      { error: "Could not read your colours. Please try another photo." },
      { status: 500 },
    );
  }
}
