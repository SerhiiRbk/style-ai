/**
 * Centralised environment access. The app runs in two modes:
 *  - "live"  : Supabase + AI keys present → real persistence, auth, AI.
 *  - "demo"  : keys absent → deterministic mock pipeline + in-memory store.
 * This lets the project build and run locally without any credentials.
 */

import { resolvePhotoGateFlags } from "@/lib/photo-gate-flags";

function envFlag(raw: string | undefined): boolean {
  return raw === "true" || raw === "1" || raw === "yes";
}

function intEnv(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  aiGatewayKey: process.env.AI_GATEWAY_API_KEY,
  modelVision: process.env.AI_MODEL_VISION ?? "anthropic/claude-sonnet-4.5",
  // Colour analysis (/colours) — its own slot so the highest-volume vision call
  // can be tuned/cheapened independently of the report vision model. Defaults to
  // the report vision model; compare candidates with scripts/eval-colours-model.ts.
  modelVisionColours:
    process.env.AI_MODEL_VISION_COLOURS ??
    process.env.AI_MODEL_VISION ??
    "anthropic/claude-sonnet-4.5",
  // Cheap vision model for pre-flight photo gates (plan 2026-08-05). MUST NOT be
  // the Sonnet vision model — gates run before the expensive call to cut cost.
  modelVisionGate:
    process.env.AI_MODEL_VISION_GATE ?? "google/gemini-2.5-flash-lite",
  modelReasoning:
    process.env.AI_MODEL_REASONING ?? "anthropic/claude-sonnet-4.5",
  modelImage:
    process.env.AI_MODEL_IMAGE ?? "google/gemini-3.1-flash-image-preview",
  embedModel: process.env.AI_EMBED_MODEL ?? "openai/text-embedding-3-small",

  falKey: process.env.FAL_KEY,

  // Catalog try-on engine: "image" (default — same image-model pipeline as
  // look renders, supports layering + multiple garments) or "fal" (FASHN
  // single-garment VTON via fal.ai).
  tryonEngine: process.env.TRYON_ENGINE === "fal" ? "fal" : "image",

  /**
   * LLM-written shopping "why" copy (src/lib/ai/shopping-reasons). On by
   * default; SHOPPING_REASONS_LLM=false is the kill switch back to templates.
   */
  shoppingReasonsLLM:
    process.env.SHOPPING_REASONS_LLM == null
      ? true
      : envFlag(process.env.SHOPPING_REASONS_LLM),

  // Shared secret required to POST scraper results to /api/catalog/import.
  catalogImportKey: process.env.CATALOG_IMPORT_KEY,

  // Payments — PAYMENT_PROVIDER selects stripe | lemon_squeezy (default: lemon).
  /** Master switch: checkout is off unless PAYMENTS_ENABLED=true (default: off). */
  paymentsEnabled: envFlag(process.env.PAYMENTS_ENABLED),
  paymentProvider:
    process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "lemon_squeezy",

  // Stripe — credit-pack checkout + purchase webhook.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

  // Lemon Squeezy — MoR checkout + order_created webhook.
  lemonSqueezyApiKey: process.env.LEMON_SQUEEZY_API_KEY,
  lemonSqueezyWebhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  lemonSqueezyStoreId: process.env.LEMON_SQUEEZY_STORE_ID,

  // Crypto payments (NOWPayments) — hosted invoice + IPN webhook.
  // Master switch: ENABLED_CRYPTO_PAYMENT=false makes crypto checkout
  // unavailable regardless of whether keys are present.
  cryptoPaymentsEnabled: envFlag(process.env.ENABLED_CRYPTO_PAYMENT),
  nowPaymentsApiKey: process.env.NOWPAYMENTS_API_KEY,
  nowPaymentsIpnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
  /** API base — override to the sandbox host for testing. */
  nowPaymentsApiUrl:
    process.env.NOWPAYMENTS_API_URL ?? "https://api.nowpayments.io/v1",
  /** Optional: pre-select a pay currency (e.g. "usdcbase"); else the hosted page lets the buyer choose. */
  nowPaymentsPayCurrency: process.env.NOWPAYMENTS_PAY_CURRENCY,

  // A0 cost fuse for the free colour-analysis endpoint.
  // Global daily cap on paid vision runs; reaching it returns a lead-magnet
  // response, not an error. At ~€0.04/run, 2500 ≈ €100/day.
  coloursDailyCap: intEnv(process.env.COLOURS_DAILY_CAP, 2500),
  // Generous per-IP hourly limit — carrier NAT puts many real users behind one IP.
  coloursIpHourlyCap: intEnv(process.env.COLOURS_IP_HOURLY_CAP, 25),
  // Strict per-anon daily limit — a soft-gate trigger pushing registration,
  // not a spend defence (the global cap is that).
  coloursAnonDailyCap: intEnv(process.env.COLOURS_ANON_DAILY_CAP, 5),

  // A0 cost fuse for the anonymous "Shop your colours" recommendations, whose
  // cost is one LLM rerank per run (~$0.015). Same shape as the colours caps.
  // Global daily cap — the real spend control, fails CLOSED. ~$0.015/run → 2000 ≈ $30/day.
  looksDailyCap: intEnv(process.env.LOOKS_DAILY_CAP, 2000),
  // Per-IP hourly limit — one rerank per button press; fails OPEN (comfort).
  looksIpHourlyCap: intEnv(process.env.LOOKS_IP_HOURLY_CAP, 20),
  // Per-anon daily limit — a soft nudge to register; fails OPEN.
  looksAnonDailyCap: intEnv(process.env.LOOKS_ANON_DAILY_CAP, 25),

  // Per-anon (per-browser) daily cap on palette/lead emails — anti-spam layer
  // on top of the per-IP cap; fails OPEN. A person only needs their palette once.
  leadAnonDailyCap: intEnv(process.env.LEAD_ANON_DAILY_CAP, 5),

  // A0 cost fuse for the batch "Create a Look" set endpoint (/api/look-set).
  // Create-a-Look generates IMAGES (Gemini ≈ $0.04/look), unlike the colours/
  // looks reranks above (~$0.015/run text) — roughly 3x the unit cost and N
  // renders per request — so it gets its own set-count fuse.
  // Global daily cap on sets, all users — the real spend control, fails CLOSED.
  // ~$0.05/look x ~6 looks/set avg -> 150 sets/day ~= $45/day worst-case.
  lookSetDailyCap: intEnv(process.env.LOOK_SET_DAILY_CAP, 150),
  // Per-user daily cap for users with purchased credits (purchased>0) — fails
  // OPEN (never blocks a paying user on limiter flake). A 100-credit whale
  // does ~5 sets/day, well under this.
  lookSetUserCapPaid: intEnv(process.env.LOOK_SET_USER_CAP_PAID, 15),
  // Per-user daily cap for signup-bonus-only users (purchased===0) — fails
  // OPEN; a pure bug backstop since bonus credits already bound these users
  // below this cap.
  lookSetUserCapFree: intEnv(process.env.LOOK_SET_USER_CAP_FREE, 3),

  // Salt for hashing IPs before they become rate-limit bucket keys (IP is PII).
  rateLimitSalt: process.env.RATE_LIMIT_SALT ?? "",

  // Transactional email (Resend). Inert unless RESEND_API_KEY is set (A3).
  resendApiKey: process.env.RESEND_API_KEY,
  // From-address on the Resend-verified sending domain. Reply-To routes human
  // replies to the monitored inbox.
  emailFrom: process.env.EMAIL_FROM ?? "Valetti <carlo@system.valetti.fit>",
  emailReplyTo: process.env.EMAIL_REPLY_TO ?? "contact@system.valetti.fit",
  // Secret for signing unsubscribe links (HMAC). Reminder mail is suppressed if
  // absent, so a missing secret can't leak an unauthenticated unsubscribe.
  emailUnsubscribeSecret: process.env.EMAIL_UNSUBSCRIBE_SECRET,
  // Unused-credits reminder (A3 email #4) is paused: off unless explicitly
  // enabled. Code is kept intact; the cron is also unscheduled in vercel.json.
  creditRemindersEnabled: envFlag(process.env.CREDIT_REMINDERS_ENABLED),

  // Error tracking (Sentry). Inert unless a DSN is set — see instrumentation.ts.
  sentryDsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Public site URL for Checkout success/cancel redirects (falls back to the
  // request origin when unset).
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  /** Report card previews: true = original bytes via /api/assets; false = Next/Image resize (default). */
  reportPreviewFullQuality: envFlag(
    process.env.NEXT_PUBLIC_REPORT_PREVIEW_FULL_QUALITY,
  ),

  // Photo-gate kill-switches (plan 2026-08-05). Default-on; resolved once at
  // boot. Server routes read env.photoGate; the client colours gate resolves
  // NEXT_PUBLIC_* on its own since process.env is inlined there.
  photoGate: resolvePhotoGateFlags(
    process.env as Record<string, string | undefined>,
  ),
} as const;

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasSupabaseAdmin = Boolean(
  env.supabaseUrl && env.supabaseServiceKey,
);
/** AI Gateway: static key and/or Vercel OIDC (deployments + `vercel env pull`). */
export const hasAI = Boolean(
  env.aiGatewayKey || process.env.VERCEL_OIDC_TOKEN,
);
export const hasResend = Boolean(env.resendApiKey);
export const hasVTON = Boolean(env.falKey);
export const hasCatalogImportKey = Boolean(env.catalogImportKey);
export const hasSentry = Boolean(env.sentryDsn);

export type PaymentProvider = "stripe" | "lemon_squeezy";

// Stripe: secret key + webhook signing secret required for checkout + grants.
export const hasStripe = Boolean(
  env.stripeSecretKey && env.stripeWebhookSecret,
);

// Lemon Squeezy: API key, store id, webhook secret.
export const hasLemonSqueezy = Boolean(
  env.lemonSqueezyApiKey &&
    env.lemonSqueezyWebhookSecret &&
    env.lemonSqueezyStoreId,
);

// NOWPayments keys present — required to verify IPNs and settle in-flight
// payments even if new crypto checkouts are switched off.
export const hasNowPaymentsKeys = Boolean(
  env.nowPaymentsApiKey && env.nowPaymentsIpnSecret,
);

/**
 * Crypto checkout is offerable: master switch ENABLED_CRYPTO_PAYMENT is on and
 * the NOWPayments keys are configured. Setting ENABLED_CRYPTO_PAYMENT=false
 * disables starting new crypto payments (webhooks still settle in-flight ones).
 */
export const hasCryptoPay = Boolean(
  env.cryptoPaymentsEnabled && hasNowPaymentsKeys,
);

/** Active provider is fully configured and payments are enabled (see PAYMENTS_ENABLED). */
export const hasPayments =
  env.paymentsEnabled &&
  (env.paymentProvider === "stripe" ? hasStripe : hasLemonSqueezy);
