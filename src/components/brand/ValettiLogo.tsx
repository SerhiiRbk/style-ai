import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ValettiMonogram } from "./ValettiMonogram";

export function ValettiLogo({
  eyebrow = "none",
  showUnderline = true,
  monogramSize = 26,
  wordmarkClass = "text-lg tracking-tight",
  className = "",
}: {
  /** `inline` — tagline beside the wordmark (navbar). `stacked` — below (footer). */
  eyebrow?: "none" | "inline" | "stacked";
  showUnderline?: boolean;
  monogramSize?: number;
  wordmarkClass?: string;
  className?: string;
}) {
  /** Matches hero `.eyebrow` (brass) at a smaller size. */
  const inlineTaglineClass =
    "text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brass transition-colors group-hover:text-brass-soft";

  return (
    <Link
      href="/"
      className={`group inline-flex shrink-0 items-center gap-2 ${className}`}
      aria-label={`${BRAND.name} — ${BRAND.eyebrow}`}
    >
      <ValettiMonogram
        size={monogramSize}
        className="shrink-0 text-ink transition-colors group-hover:text-brass"
      />
      {eyebrow === "inline" ? (
        <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap sm:gap-2">
          <span
            className={`font-display relative shrink-0 text-ink transition-colors group-hover:text-ink-soft ${wordmarkClass}`}
          >
            {BRAND.name}
            {showUnderline && (
              <span
                className="absolute -bottom-0.5 left-0 h-px w-[92%] bg-brass/40 transition-colors group-hover:bg-brass/65"
                aria-hidden
              />
            )}
          </span>
          <span
            className={`hidden items-baseline gap-1.5 whitespace-nowrap lg:inline-flex ${inlineTaglineClass}`}
          >
            <span
              className="text-brass/45 transition-colors group-hover:text-brass/70"
              aria-hidden
            >
              ·
            </span>
            {BRAND.eyebrow}
          </span>
        </span>
      ) : (
        <span className="flex min-w-0 flex-col items-start leading-none">
          <span
            className={`font-display relative text-ink transition-colors group-hover:text-ink-soft ${wordmarkClass}`}
          >
            {BRAND.name}
            {showUnderline && (
              <span
                className="absolute -bottom-0.5 left-0 h-px w-[92%] bg-brass/40 transition-colors group-hover:bg-brass/65"
                aria-hidden
              />
            )}
          </span>
          {eyebrow === "stacked" && (
            <span className="eyebrow mt-1.5 whitespace-nowrap">{BRAND.eyebrow}</span>
          )}
        </span>
      )}
    </Link>
  );
}
