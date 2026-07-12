import { CREDIT_COSTS } from "@/lib/credit-costs";
import { makeT } from "@/lib/i18n/report";
import type { ReportLanguage } from "@/lib/languages";

/** One-line hint for owners — shown above hairstyle / grooming photo grids. */
export function RegenPhotoHint({
  className = "",
  lang,
}: {
  className?: string;
  lang?: ReportLanguage;
}) {
  const tt = makeT(lang);
  return (
    <p
      className={`text-sm leading-relaxed text-stone ${className}`.trim()}
    >
      {tt("Don't love a preview? Tap")}{" "}
      <span className="font-medium text-ink">{tt("Render again")}</span>{" "}
      {tt("on any AI photo")} ({CREDIT_COSTS.regen} {tt("credit each")}).
    </p>
  );
}
