import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import { env, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";
import { Subseason } from "@/lib/style-profile";
import { sendPaletteEmail, sendCapAckEmail } from "@/lib/email/send";

export const maxDuration = 15;

/** Pragmatic email shape check — real validation happens on send (A3). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_CHARS = 254;
const ALLOWED_SOURCES = new Set(["colours_result", "colours_cap"]);

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
 * Soft email capture for the colour funnel: "email me my palette PDF" after a
 * result, and the same form behind the A0 daily-cap lead magnet. Stores a lead;
 * the actual email is A3. Best-effort — never blocks the funnel.
 */
export async function POST(request: Request) {
  if (!COLOURS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
  const email = emailRaw.toLowerCase();
  if (!email || email.length > MAX_EMAIL_CHARS || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const source =
    typeof body?.source === "string" && ALLOWED_SOURCES.has(body.source)
      ? body.source
      : "colours_result";
  const anonId =
    typeof body?.anonId === "string" && body.anonId ? body.anonId : null;
  const subParsed = Subseason.safeParse(body?.subseason);
  const subseason = subParsed.success ? subParsed.data : null;

  // Light abuse guard so the capture endpoint can't be scripted into a spam
  // sink. Generous and fail-open — this list is a nice-to-have, not a spend risk.
  const ipHash = createHash("sha256")
    .update(`${clientIp(request)}:${env.rateLimitSalt}`)
    .digest("hex")
    .slice(0, 16);
  const day = new Date().toISOString().slice(0, 10);
  const gate = await checkLimit(`lead:ip:${ipHash}:${day}`, 30, 24 * 60 * 60, {
    failOpen: true,
  });
  if (!gate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Per-anon (per-browser) daily cap — an extra anti-spam layer so one visitor
  // can't mail themselves the palette endlessly even from rotating IPs. Fails
  // OPEN and is skipped when there is no anonId (cookie cleared/blocked).
  if (anonId) {
    const anonGate = await checkLimit(
      `lead:anon:${anonId}:${day}`,
      env.leadAnonDailyCap,
      26 * 60 * 60, // > 24h so a day's bucket never expires mid-day
      { failOpen: true },
    );
    if (!anonGate.allowed) {
      return NextResponse.json(
        { error: "You've already been emailed your palette today." },
        { status: 429 },
      );
    }
  }

  // Deliver the follow-up email (A3), then persist the lead. A result capture
  // gets the palette; a cap capture gets an acknowledgement. Best-effort — a
  // send failure still records the lead so it can be fulfilled later.
  const sent =
    source === "colours_result" && subseason
      ? await sendPaletteEmail(email, subseason)
      : await sendCapAckEmail(email);

  if (hasSupabaseAdmin) {
    try {
      const admin = createAdminSupabase();
      await admin.from("leads").insert({
        email,
        source,
        anon_id: anonId,
        subseason,
        fulfilled: sent,
      });
    } catch (err) {
      console.error("[colours/lead] insert failed", err);
      // Fall through — still record the event and return ok so the UX is calm.
    }
  }

  await logEvent({
    name: "email_captured",
    anonId,
    props: { source, subseason, sent },
  });

  return NextResponse.json({ ok: true });
}
