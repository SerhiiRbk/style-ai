import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import {
  languageEnglishLabel,
  normalizeLanguage,
  type ReportLanguage,
} from "@/lib/languages";

/** Max strings sent to the model per request — keeps output reliable & aligned. */
const CHUNK = 60;

const batchSchema = z.object({
  translations: z
    .array(z.string())
    .describe("Translations, one per input string, in the SAME order."),
});

async function translateChunk(
  strings: string[],
  language: ReportLanguage,
): Promise<string[]> {
  const label = languageEnglishLabel(language);
  const numbered = strings.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const { output } = await generateText({
    model: env.modelReasoning,
    output: Output.object({ schema: batchSchema }),
    prompt:
      `You are a professional translator localising a personal style report into ${label}.\n` +
      `Translate each of the numbered snippets below into natural, fluent ${label}, ` +
      `keeping the tone refined and encouraging.\n\n` +
      `Rules:\n` +
      `- Return exactly ${strings.length} translations, in the same order as the input.\n` +
      `- Preserve any hex colour codes (e.g. #1A2B3C), numbers, measurements and units unchanged.\n` +
      `- Do NOT translate brand names or product model names.\n` +
      `- Keep punctuation and comma-separated garment lists intact.\n` +
      `- Never merge, split, add or drop items.\n\n` +
      `Snippets:\n${numbered}`,
  });

  const out = output.translations ?? [];
  // Defensive: if the model returns a mismatched count, fall back per-index to
  // the original string so structure is always preserved.
  return strings.map((s, i) => {
    const t = out[i];
    return typeof t === "string" && t.trim() ? t : s;
  });
}

/**
 * Translate a batch of independent strings into `language`. De-duplicates,
 * chunks large inputs, and is a no-op for English or when AI is unavailable.
 * Always returns an array the same length as the input, in the same order.
 */
export async function translateBatch(
  strings: string[],
  language: ReportLanguage,
): Promise<string[]> {
  const lang = normalizeLanguage(language);
  if (!hasAI || !strings.length) return [...strings];

  const unique = [...new Set(strings.filter((s) => s && s.trim()))];
  const map = new Map<string, string>();

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    try {
      const translated = await translateChunk(slice, lang);
      slice.forEach((s, j) => map.set(s, translated[j] ?? s));
    } catch (err) {
      console.error("[translate] chunk failed", err);
      slice.forEach((s) => map.set(s, s));
    }
  }

  return strings.map((s) => (s && s.trim() ? (map.get(s) ?? s) : s));
}

/**
 * Two-phase translator: pass a `TranslateFn` to any pure structural mapper,
 * first to collect every translatable string, then to apply the translations.
 * This keeps object shapes identical (only string *values* change).
 */
export type TranslateFn = (s: string) => string;

export async function withTranslator<T>(
  language: ReportLanguage,
  build: (tr: TranslateFn) => T,
): Promise<T> {
  const lang = normalizeLanguage(language);
  if (!hasAI) return build((s) => s);

  const collected: string[] = [];
  build((s) => {
    if (s && s.trim()) collected.push(s);
    return s;
  });

  const translated = await translateBatch(collected, lang);
  const map = new Map<string, string>();
  collected.forEach((s, i) => map.set(s, translated[i] ?? s));

  return build((s) => (s && s.trim() ? (map.get(s) ?? s) : s));
}
