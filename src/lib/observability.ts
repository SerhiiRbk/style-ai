import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Thin observability layer. Always logs to the server console (visible in Vercel
 * logs) and forwards to Sentry when a DSN is configured (otherwise a no-op).
 * Use for critical paths where a swallowed error/edge-case must stay visible —
 * e.g. payment webhooks that ack with 200 but couldn't grant credits.
 */

type Context = Record<string, unknown>;

/** Non-fatal but noteworthy — e.g. a webhook acked but didn't grant credits. */
export function captureWarning(message: string, context?: Context): void {
  console.warn(message, context ?? "");
  Sentry.captureMessage(message, { level: "warning", extra: context });
}

/** Unexpected failure — forwarded as a Sentry exception. */
export function captureError(error: unknown, context?: Context): void {
  console.error(error, context ?? "");
  Sentry.captureException(error, { extra: context });
}
