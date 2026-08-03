import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { env } from "@/lib/env";
import { checkLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";

export const maxDuration = 10;

/**
 * Minimal client-side funnel event ingestion (§4 A1). Deliberately a closed
 * whitelist + per-IP cap so it can't become an open write sink. Server-side
 * events (rate_limited, colours_result, email_captured) are logged directly.
 */
const ALLOWED = new Set([
  "colours_started",
  "quiz_started",
  "quiz_result",
  "affiliate_click",
  "filter_changed",
  "tryon_gate_click",
]);

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-vercel-forwarded-for") ??
    "unknown"
  );
}

/** Shallow, size-bounded props so a client can't stuff large blobs into events. */
function sanitizeProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n++ >= 12) break;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  const ipHash = createHash("sha256")
    .update(`${clientIp(request)}:${env.rateLimitSalt}`)
    .digest("hex")
    .slice(0, 16);
  const hour = new Date().toISOString().slice(0, 13);
  const gate = await checkLimit(`events:ip:${ipHash}:${hour}`, 300, 60 * 60, {
    failOpen: true,
  });
  if (!gate.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const anonId =
    typeof body?.anonId === "string" && body.anonId ? body.anonId.slice(0, 64) : null;

  await logEvent({ name, anonId, props: sanitizeProps(body?.props) });
  return NextResponse.json({ ok: true });
}
