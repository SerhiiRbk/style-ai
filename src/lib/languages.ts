/**
 * Supported report languages. The textual part of a report can be generated
 * (or translated) into any of these; English is the default and the language
 * the deterministic template copy is authored in.
 */

export type ReportLanguage =
  | "en"
  | "es"
  | "de"
  | "fr"
  | "it"
  | "cs"
  | "ru"
  | "uk"
  | "tr"
  | "pl";

export type ReportLanguageInfo = {
  id: ReportLanguage;
  /** Endonym shown to users (e.g. "Español"). */
  native: string;
  /** English name used in prompts / admin. */
  english: string;
};

export const DEFAULT_LANGUAGE: ReportLanguage = "en";

export const REPORT_LANGUAGES: ReportLanguageInfo[] = [
  { id: "en", native: "English", english: "English" },
  { id: "es", native: "Español", english: "Spanish" },
  { id: "de", native: "Deutsch", english: "German" },
  { id: "fr", native: "Français", english: "French" },
  { id: "it", native: "Italiano", english: "Italian" },
  { id: "cs", native: "Čeština", english: "Czech" },
  { id: "ru", native: "Русский", english: "Russian" },
  { id: "uk", native: "Українська", english: "Ukrainian" },
  { id: "tr", native: "Türkçe", english: "Turkish" },
  { id: "pl", native: "Polski", english: "Polish" },
];

export const REPORT_LANGUAGE_IDS = REPORT_LANGUAGES.map((l) => l.id) as [
  ReportLanguage,
  ...ReportLanguage[],
];

const BY_ID = new Map(REPORT_LANGUAGES.map((l) => [l.id, l]));

export function isReportLanguage(v: unknown): v is ReportLanguage {
  return typeof v === "string" && BY_ID.has(v as ReportLanguage);
}

/** Normalise any stored/legacy value to a supported language (defaults to English). */
export function normalizeLanguage(v: unknown): ReportLanguage {
  return isReportLanguage(v) ? v : DEFAULT_LANGUAGE;
}

/** Endonym label for UI (e.g. "Español"). */
export function languageNativeLabel(v: unknown): string {
  return BY_ID.get(normalizeLanguage(v))?.native ?? "English";
}

/** English name for prompts / admin (e.g. "Spanish"). */
export function languageEnglishLabel(v: unknown): string {
  return BY_ID.get(normalizeLanguage(v))?.english ?? "English";
}

/**
 * Prompt instruction that forces an LLM to write all natural-language output in
 * the target language. Returns an empty string for English (the default).
 */
export function languageInstruction(v: unknown): string {
  const lang = normalizeLanguage(v);
  if (lang === "en") return "";
  const info = BY_ID.get(lang)!;
  return (
    `\n\nIMPORTANT — LANGUAGE: Write every natural-language value in the JSON output ` +
    `in ${info.english} (${info.native}). This includes all names, titles, descriptions and ` +
    `"why" explanations. Do NOT translate hex colour codes, brand names or product model names. ` +
    `Use natural, fluent ${info.english} as a native personal stylist would write it.`
  );
}
