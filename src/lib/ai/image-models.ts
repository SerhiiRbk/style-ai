/**
 * Image-model ids for look/try-on renders. Gemini Nano Banana family uses
 * generateText (chat + image files). GPT Image / Flux Kontext use generateImage.
 */

export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";

export const DEFAULT_IMAGE_MODEL_FALLBACKS = [
  "google/gemini-3-pro-image",
  "openai/gpt-image-2",
  "bfl/flux-kontext-max",
] as const;

/** Gemini image models take prompt + reference photos via generateText. */
export function imageModelUsesChat(id: string): boolean {
  return /gemini/i.test(id) && /image/i.test(id);
}

export function parseImageModelList(
  raw: string | undefined | null,
  fallback: readonly string[],
): string[] {
  if (!raw?.trim()) return [...fallback];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Primary first, then fallbacks, duplicates dropped. */
export function imageModelChain(
  primary: string,
  fallbacks: readonly string[],
): string[] {
  const out: string[] = [];
  for (const id of [primary, ...fallbacks]) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
