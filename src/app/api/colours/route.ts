import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { analyzeColoursOnly } from "@/lib/ai/colour-analysis";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import { env, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";
import type { ColourAnalysisResult } from "@/lib/colour-palette";

export const maxDuration = 60;

/** ~6 MB of base64 ≈ 4.5 MB image — comfortably above a 768px JPEG, below platform body limits. */
const MAX_DATA_URL_CHARS = 6_000_000;

/** Bump when the analysis prompt/logic changes so cached results are recomputed. */
const COLOURS_CACHE_VERSION = "1";

/** Anonymous, deduplicated cache namespace in the `assets` bucket. */
function cachePath(hash: string): string {
  return `colours/cache/${COLOURS_CACHE_VERSION}/${hash}.json`;
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

/** Hashed IP — we store a salted digest, never the raw address (IP is PII). */
function ipBucketKey(ip: string): string {
  const h = createHash("sha256")
    .update(`${ip}:${env.rateLimitSalt}`)
    .digest("hex")
    .slice(0, 16);
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDТHH
  return `colours:ip:${h}:${hour}`;
}

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Free colour analysis. Each vision call costs money, so the anonymous path is
 * fused (A0): validate → photo-hash cache → global daily cap → per-IP → per-anon
 * → vision. Cheap/important checks run before expensive ones, and body
 * validation runs before any counter so junk never spends a real user's quota.
 */
export async function POST(request: Request) {
  // PAUSED with the `/colours` page until the anonymous funnel (§5) is wired.
  if (!COLOURS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 1) Validate the body FIRST — junk requests must not consume any quota.
  const body = await request.json().catch(() => null);
  const image: unknown = body?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }
  if (image.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }
  const anonId =
    typeof body?.anonId === "string" && body.anonId ? body.anonId : null;

  const hash = createHash("sha256").update(image).digest("hex").slice(0, 32);
  const admin = hasSupabaseAdmin ? createAdminSupabase() : null;

  // 2) Level 0 — photo-hash cache. Same file → stored result, no cost, no quota.
  if (admin) {
    try {
      const { data: blob } = await admin.storage
        .from("assets")
        .download(cachePath(hash));
      if (blob) {
        const cached = JSON.parse(await blob.text()) as ColourAnalysisResult;
        return NextResponse.json({ result: cached, cached: true });
      }
    } catch {
      // Cache miss or corrupt entry — fall through and recompute.
    }
  }

  // 3) Level 1 — global daily cap. The real cost control. Fail CLOSED: if the
  // counter is unknown we must not keep spending.
  const globalBucket = `colours:global:${dayStamp()}`;
  const globalCheck = await checkLimit(
    globalBucket,
    env.coloursDailyCap,
    26 * 60 * 60, // > 24h so a day's bucket never expires mid-day
    { failOpen: false },
  );
  if (!globalCheck.allowed) {
    await logEvent({
      name: "rate_limited",
      anonId,
      props: { level: "global", bucket: globalBucket, count: globalCheck.count },
    });
    // A lead magnet, not a 429: capture the visitor instead of losing them.
    return NextResponse.json(
      {
        capped: true,
        message:
          "We're at capacity for free readings today. Leave your email and we'll send your colour palette in the morning.",
      },
      { status: 200 },
    );
  }

  // 4) Level 2 — per-IP hourly limit. Generous (carrier NAT). Fail OPEN.
  const ip = clientIp(request);
  const ipBucket = ipBucketKey(ip);
  const ipCheck = await checkLimit(ipBucket, env.coloursIpHourlyCap, 60 * 60, {
    failOpen: true,
  });
  if (!ipCheck.allowed) {
    await logEvent({
      name: "rate_limited",
      anonId,
      props: { level: "ip", bucket: ipBucket, count: ipCheck.count },
    });
    return NextResponse.json(
      { error: "Too many analyses just now — try again in a little while." },
      { status: 429 },
    );
  }

  // 5) Level 3 — per-anon daily soft gate. Trivially bypassable by design; its
  // job is to nudge sign-up, not to defend spend. Fail OPEN; skip if no anonId.
  if (anonId) {
    const anonBucket = `colours:anon:${anonId}:${dayStamp()}`;
    const anonCheck = await checkLimit(
      anonBucket,
      env.coloursAnonDailyCap,
      26 * 60 * 60,
      { failOpen: true },
    );
    if (!anonCheck.allowed) {
      await logEvent({
        name: "rate_limited",
        anonId,
        props: { level: "anon", bucket: anonBucket, count: anonCheck.count },
      });
      return NextResponse.json(
        {
          softGate: true,
          message:
            "You've used your free readings for today. Sign in to keep your palette and run more.",
        },
        { status: 200 },
      );
    }
  }

  // 6) Spend the vision call. The image is analysed in-request and never persisted.
  try {
    const result = await analyzeColoursOnly(image);
    // Cache the result (not the photo) so a repeat upload is free.
    if (admin) {
      try {
        await admin.storage
          .from("assets")
          .upload(cachePath(hash), JSON.stringify(result), {
            contentType: "application/json",
            upsert: true,
          });
      } catch {
        // Caching is best-effort — never fail the request over it.
      }
    }
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[colours] analysis failed", err);
    return NextResponse.json(
      { error: "Could not read your colours. Please try another photo." },
      { status: 500 },
    );
  }
}
