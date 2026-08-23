import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import { env, hasSupabaseAdmin, hasAI } from "@/lib/env";
import { getGeo } from "@/lib/geo";
import { Subseason, Boldness } from "@/lib/style-profile";
import { lookContextById } from "@/lib/look-contexts";
import { itemBudgetPreferenceFromBandId } from "@/lib/budgets";
import {
  paletteForPerson,
  palettePersonWithTrust,
  parseSwatchHex,
  type Contrast,
  type LightingCast,
  type Undertone,
} from "@/lib/colour-palette";
import { matchInspirationItems } from "@/lib/data/catalog";
import {
  buildAnonProfile,
  buildAnonLookGarments,
  DEFAULT_OCCASION,
} from "@/lib/colours-looks";
import { checkLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";
import { createAdminSupabase } from "@/lib/supabase/server";

/** Vector search + rerank over several slots can exceed the default timeout. */
export const maxDuration = 60;

/** Bump when the matcher/garment/profile logic changes so cached looks recompute. */
const LOOKS_CACHE_VERSION = "5";
/** Cached looks are catalogue-dependent, so expire them daily. */
const LOOKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function looksCachePath(hash: string): string {
  return `looks/cache/${LOOKS_CACHE_VERSION}/${hash}.json`;
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

/**
 * Anonymous palette-based product recommendations (§5). Given a subseason plus
 * occasion / budget / boldness filters, synthesize a profile + garment list and
 * run the existing matcher. No vision call — cheaper than colour analysis — but
 * still IP-guarded (fail-open) so it can't be scripted into an embedding sink.
 */
export async function POST(request: Request) {
  if (!COLOURS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasSupabaseAdmin || !hasAI) {
    return NextResponse.json({ ok: false, slots: [] }, { status: 200 });
  }

  const body = await request.json().catch(() => null);
  const parsedSub = Subseason.safeParse(body?.subseason);
  if (!parsedSub.success) {
    return NextResponse.json({ error: "Unknown palette" }, { status: 400 });
  }
  const subseason = parsedSub.data;

  const occasion =
    lookContextById(typeof body?.occasion === "string" ? body.occasion : null)?.id ??
    DEFAULT_OCCASION;
  const budgetId = typeof body?.budgetId === "string" ? body.budgetId : "any";
  const budget = itemBudgetPreferenceFromBandId(budgetId);
  const boldness = Boldness.safeParse(body?.boldness).data ?? "moderate";
  const source = body?.source === "quiz" ? "quiz" : "photo";
  const anonId =
    typeof body?.anonId === "string" && body.anonId ? body.anonId : null;
  const undertone: Undertone = ["warm", "cool", "neutral"].includes(body?.undertone)
    ? body.undertone
    : "neutral";
  const contrast: Contrast = ["low", "medium", "high"].includes(body?.contrast)
    ? body.contrast
    : "medium";
  const skinTone = typeof body?.skinTone === "string" ? body.skinTone : null;
  const hairColor = typeof body?.hairColor === "string" ? body.hairColor : null;
  const eyeColor = typeof body?.eyeColor === "string" ? body.eyeColor : null;
  const skinHex = parseSwatchHex(body?.skinHex);
  const hairHex = parseSwatchHex(body?.hairHex);
  const eyeHex = parseSwatchHex(body?.eyeHex);
  const lighting: LightingCast | undefined = (
    ["neutral", "warm-tint", "cool-tint", "mixed"] as const
  ).includes(body?.lighting as LightingCast)
    ? (body.lighting as LightingCast)
    : undefined;
  const person = palettePersonWithTrust({
    undertone,
    contrast,
    skinTone,
    hairColor,
    eyeColor,
    skinHex,
    hairHex,
    eyeHex,
    lighting,
  });

  const geo = await getGeo();

  // Level 0 — result cache. Recommendations are deterministic for a given
  // (palette, occasion, budget, boldness, market), so a cache hit skips BOTH the
  // caps and the paid rerank. Keyed on the same inputs buildAnonProfile + the
  // matcher read; bump LOOKS_CACHE_VERSION when that logic changes.
  const admin = createAdminSupabase();
  const cacheHash = createHash("sha256")
    .update(
      [
        subseason,
        occasion,
        budgetId,
        boldness,
        undertone,
        contrast,
        (skinTone ?? "").toLowerCase(),
        (hairColor ?? "").toLowerCase(),
        (eyeColor ?? "").toLowerCase(),
        skinHex ?? "",
        hairHex ?? "",
        eyeHex ?? "",
        lighting ?? "",
        (geo.country ?? "Global").toLowerCase(),
        (geo.currency ?? "EUR").toLowerCase(),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
  try {
    const { data: blob } = await admin.storage
      .from("assets")
      .download(looksCachePath(cacheHash));
    if (blob) {
      const cached = JSON.parse(await blob.text()) as {
        slots: unknown[];
        savedAt: number;
      };
      if (
        cached?.savedAt &&
        Date.now() - cached.savedAt < LOOKS_CACHE_TTL_MS &&
        Array.isArray(cached.slots)
      ) {
        await logEvent({
          name: source === "quiz" ? "quiz_result" : "colours_result",
          anonId,
          props: {
            occasion,
            budgetId,
            slots: cached.slots.length,
            source,
            cached: true,
          },
        });
        return NextResponse.json({
          ok: true,
          slots: cached.slots,
          occasion,
          budgetId,
          cached: true,
        });
      }
    }
  } catch {
    // Cache miss / corrupt entry — fall through, recompute, and re-cache.
  }

  // A0 cost fuse — each run is one paid LLM rerank. Cheap/global checks first:
  // global daily cap (fail CLOSED) → per-IP hourly (fail open) → per-anon daily.
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH

  // 1) Global daily cap — the real spend control. Fail CLOSED.
  const globalBucket = `looks:global:${day}`;
  const globalCheck = await checkLimit(
    globalBucket,
    env.looksDailyCap,
    26 * 60 * 60, // > 24h so a day's bucket never expires mid-day
    { failOpen: false },
  );
  if (!globalCheck.allowed) {
    await logEvent({
      name: "rate_limited",
      anonId,
      props: { level: "global", bucket: "looks", count: globalCheck.count },
    });
    return NextResponse.json(
      {
        ok: false,
        slots: [],
        capped: true,
        message:
          "We're at capacity for free styling today. Create a free account to keep going.",
      },
      { status: 200 },
    );
  }

  // 2) Per-IP hourly limit — one rerank per button press. Fail OPEN (carrier NAT).
  const ipHash = createHash("sha256")
    .update(`${clientIp(request)}:${env.rateLimitSalt}`)
    .digest("hex")
    .slice(0, 16);
  const ipCheck = await checkLimit(
    `looks:ip:${ipHash}:${hour}`,
    env.looksIpHourlyCap,
    60 * 60,
    { failOpen: true },
  );
  if (!ipCheck.allowed) {
    await logEvent({
      name: "rate_limited",
      anonId,
      props: { level: "ip", bucket: "looks", count: ipCheck.count },
    });
    return NextResponse.json(
      { error: "Too many requests — try again shortly." },
      { status: 429 },
    );
  }

  // 3) Per-anon daily soft gate — nudge sign-up. Fail OPEN; skip when no anonId.
  if (anonId) {
    const anonCheck = await checkLimit(
      `looks:anon:${anonId}:${day}`,
      env.looksAnonDailyCap,
      26 * 60 * 60,
      { failOpen: true },
    );
    if (!anonCheck.allowed) {
      await logEvent({
        name: "rate_limited",
        anonId,
        props: { level: "anon", bucket: "looks", count: anonCheck.count },
      });
      return NextResponse.json(
        {
          ok: false,
          slots: [],
          softGate: true,
          message:
            "You've reached today's free styling limit. Create a free account to run more.",
        },
        { status: 200 },
      );
    }
  }

  const profile = buildAnonProfile(subseason, geo, boldness, {
    ...person,
    lighting,
  });
  const palette = paletteForPerson(subseason, person);
  const garments = buildAnonLookGarments(palette, occasion);
  const context = lookContextById(occasion);

  const slots = (
    await matchInspirationItems(
      profile,
      {
        title: context?.context ?? "Smart casual",
        description: context?.brief ?? "",
        palette: palette.map((s) => s.hex),
      },
      garments,
      budget,
    )
  ).filter((s) => s.candidates.length > 0);

  // Cache the result (best-effort) so identical filters are free next time.
  try {
    await admin.storage
      .from("assets")
      .upload(
        looksCachePath(cacheHash),
        JSON.stringify({ slots, savedAt: Date.now() }),
        { contentType: "application/json", upsert: true },
      );
  } catch {
    // Caching is best-effort — never fail the request over it.
  }

  // The path event — `quiz_result` vs `colours_result` — so the two entries can
  // be told apart in the funnel (§5.2 п.9). Fires even with zero slots: the
  // palette itself is the result.
  await logEvent({
    name: source === "quiz" ? "quiz_result" : "colours_result",
    anonId,
    props: { occasion, budgetId, slots: slots.length, source },
  });

  return NextResponse.json({ ok: true, slots, occasion, budgetId });
}
