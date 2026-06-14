import * as Sentry from "@sentry/nextjs";

/**
 * Server / edge error tracking. Inert unless SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN)
 * is set, so the app builds and runs locally without a Sentry account. Wired via
 * Next's native `instrumentation` hook (no withSentryConfig — keeps the build and
 * the existing withWorkflow wrapper untouched). Set SENTRY_DSN in prod to enable.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
}

// Captures errors thrown by React Server Components / route handlers.
export const onRequestError = Sentry.captureRequestError;
