import * as Sentry from "@sentry/nextjs";

/**
 * Browser error tracking. Inert unless NEXT_PUBLIC_SENTRY_DSN is set. Loaded
 * automatically by Next's native client instrumentation hook.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
