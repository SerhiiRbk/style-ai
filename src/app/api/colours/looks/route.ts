import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import { env, hasSupabaseAdmin, hasAI } from "@/lib/env";
import { getGeo } from "@/lib/geo";
import { Subseason, Boldness } from "@/lib/style-profile";
import { lookContextById } from "@/lib/look-contexts";
import { itemBudgetPreferenceFromBandId } from "@/lib/budgets";
import { paletteForSubseason } from "@/lib/colour-palette";
import { matchInspirationItems } from "@/lib/data/catalog";
import {
  buildAnonProfile,
  buildAnonLookGarments,
  DEFAULT_OCCASION,
} from "@/lib/colours-looks";
import { checkLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";

/** Vector search + rerank over several slots can exceed the default timeout. */
export const maxDuration = 60;

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

  const geo = await getGeo();
  const profile = buildAnonProfile(subseason, geo, boldness);
  const palette = paletteForSubseason(subseason);
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
