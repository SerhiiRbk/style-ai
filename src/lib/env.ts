/**
 * Centralised environment access. The app runs in two modes:
 *  - "live"  : Supabase + AI keys present → real persistence, auth, AI.
 *  - "demo"  : keys absent → deterministic mock pipeline + in-memory store.
 * This lets the project build and run locally without any credentials.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  aiGatewayKey: process.env.AI_GATEWAY_API_KEY,
  modelVision: process.env.AI_MODEL_VISION ?? "anthropic/claude-sonnet-4.5",
  modelReasoning:
    process.env.AI_MODEL_REASONING ?? "anthropic/claude-sonnet-4.5",
  modelImage:
    process.env.AI_MODEL_IMAGE ?? "google/gemini-3.1-flash-image-preview",
  embedModel: process.env.AI_EMBED_MODEL ?? "openai/text-embedding-3-small",

  falKey: process.env.FAL_KEY,

  // Shared secret required to POST scraper results to /api/catalog/import.
  catalogImportKey: process.env.CATALOG_IMPORT_KEY,
} as const;

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasSupabaseAdmin = Boolean(
  env.supabaseUrl && env.supabaseServiceKey,
);
export const hasAI = Boolean(env.aiGatewayKey);
export const hasVTON = Boolean(env.falKey);
export const hasCatalogImportKey = Boolean(env.catalogImportKey);
