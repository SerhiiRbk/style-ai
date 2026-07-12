/**
 * Report UI localization. The report's *content* (headline, summary, colours,
 * looks, extras, …) is translated per-report at generation/change time. This
 * module localises the fixed *interface* copy (section titles, labels, headings,
 * button text) via committed per-language dictionaries, so a report in a given
 * language reads end-to-end in that language.
 *
 * Keys are the exact English source strings. Missing keys fall back to English,
 * so partial dictionaries degrade gracefully.
 */
import type { ReportLanguage } from "@/lib/languages";
import { normalizeLanguage } from "@/lib/languages";

import es from "./report/es.json";
import de from "./report/de.json";
import fr from "./report/fr.json";
import it from "./report/it.json";
import cs from "./report/cs.json";
import ru from "./report/ru.json";
import uk from "./report/uk.json";
import tr from "./report/tr.json";
import pl from "./report/pl.json";

type Dict = Record<string, string>;

const DICTS: Partial<Record<ReportLanguage, Dict>> = {
  es: es as Dict,
  de: de as Dict,
  fr: fr as Dict,
  it: it as Dict,
  cs: cs as Dict,
  ru: ru as Dict,
  uk: uk as Dict,
  tr: tr as Dict,
  pl: pl as Dict,
};

/** Translate a fixed UI string into `lang` (English passthrough / fallback). */
export function t(lang: ReportLanguage | undefined, en: string): string {
  const l = normalizeLanguage(lang);
  if (l === "en") return en;
  return DICTS[l]?.[en] ?? en;
}

/** Curried translator for ergonomic use inside a component: `const tr = makeT(lang)`. */
export function makeT(lang: ReportLanguage | undefined): (en: string) => string {
  const l = normalizeLanguage(lang);
  if (l === "en") return (en) => en;
  const dict = DICTS[l];
  return (en) => dict?.[en] ?? en;
}
