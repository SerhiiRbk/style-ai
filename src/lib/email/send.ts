import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/client";
import {
  reportReadyEmail,
  reportFailedEmail,
  paletteEmail,
  capAckEmail,
  creditsReminderEmail,
} from "@/lib/email/templates";
import {
  paletteForSubseason,
  subseasonLabel,
  seasonForSubseason,
  seasonNoteFor,
} from "@/lib/colour-palette";
import type { SubseasonId } from "@/lib/style-profile";

/** Signed unsubscribe token — HMAC over the lowercased email. */
export function unsubscribeToken(email: string): string | null {
  if (!env.emailUnsubscribeSecret) return null;
  return createHmac("sha256", env.emailUnsubscribeSecret)
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  if (!expected || expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export function unsubscribeUrl(email: string): string | null {
  const t = unsubscribeToken(email);
  if (!t) return null;
  const u = new URL(absoluteUrl("/unsubscribe"));
  u.searchParams.set("e", email);
  u.searchParams.set("t", t);
  return u.href;
}

/** 1. Report ready — the critical activation email. */
export function sendReportReadyEmail(
  to: string,
  opts: { reportId: string; headline: string | null },
): Promise<boolean> {
  const { subject, html, text } = reportReadyEmail({
    headline: opts.headline,
    reportUrl: absoluteUrl(`/report/${opts.reportId}`),
  });
  return sendEmail({ to, subject, html, text });
}

/** 3. Report generation failed. */
export function sendReportFailedEmail(to: string): Promise<boolean> {
  const { subject, html, text } = reportFailedEmail({
    reportsUrl: absoluteUrl("/reports"),
  });
  return sendEmail({ to, subject, html, text });
}

/** 2. Palette ready — delivered to A2 email captures with a known subseason. */
export function sendPaletteEmail(
  to: string,
  subseason: SubseasonId,
): Promise<boolean> {
  const swatches = paletteForSubseason(subseason).map((s) => ({
    hex: s.hex,
    name: s.name,
  }));
  const { subject, html, text } = paletteEmail({
    subseasonLabel: subseasonLabel(subseason),
    swatches,
    note: seasonNoteFor(seasonForSubseason(subseason)),
    ctaUrl: absoluteUrl("/start"),
  });
  return sendEmail({ to, subject, html, text });
}

/** 2b. Daily-cap acknowledgement — no palette known yet. */
export function sendCapAckEmail(to: string): Promise<boolean> {
  const { subject, html, text } = capAckEmail({ ctaUrl: absoluteUrl("/start") });
  return sendEmail({ to, subject, html, text });
}

/** 4. Unused-credits reminder. Requires an unsubscribe secret (lifecycle mail). */
export function sendCreditsReminderEmail(
  to: string,
  balance: number,
): Promise<boolean> {
  const unsub = unsubscribeUrl(to);
  if (!unsub) {
    // No secret configured — refuse to send lifecycle mail without an opt-out.
    return Promise.resolve(false);
  }
  const { subject, html, text } = creditsReminderEmail({
    balance,
    ctaUrl: absoluteUrl("/start"),
    unsubscribeUrl: unsub,
  });
  return sendEmail({ to, subject, html, text });
}
