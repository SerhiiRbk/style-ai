import { makeT } from "@/lib/i18n/report";
import type { ReportLanguage } from "@/lib/languages";
import type { StyleCard as StyleCardData } from "@/lib/style-card";

/**
 * "Your Personal Style Card" — the report's closing keepsake: the whole report
 * distilled into six systems on a single paper card. Presentational + hook-free,
 * so it renders in the server report page. Data comes pre-built from
 * `buildStyleCard`; labels and fixed copy route through the report translator.
 */
export function StyleCard({
  card,
  lang,
}: {
  card: StyleCardData;
  lang?: ReportLanguage;
}) {
  const t = makeT(lang);
  return (
    <div className="relative overflow-hidden rounded-2xl border hairline bg-paper p-6 sm:p-9">
      {/* Faint brand monogram */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 select-none font-display leading-none"
        style={{ fontSize: "18rem", color: "rgba(169,124,60,0.10)" }}
      >
        V
      </span>
      <div
        className="pointer-events-none absolute inset-3 rounded-xl"
        style={{ border: "1px solid rgba(169,124,60,0.28)" }}
      />

      <div className="relative">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-sm tracking-[0.4em]">VALETTI</span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-stone-soft">
            {t("Personal Style Card")}
          </span>
        </div>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-brass">
            {t("Your style, as a system")}
          </p>
          <h3 className="mt-2 font-display text-3xl leading-tight text-ink">
            {card.title}
          </h3>
        </div>

        <dl className="mt-6">
          {card.systems.map((s) => {
            const isAvoid = s.key === "avoid";
            return (
              <div
                key={s.key}
                className="grid grid-cols-[110px_1fr] gap-4 py-3.5 sm:grid-cols-[130px_1fr]"
                style={{
                  borderTop: isAvoid
                    ? "1px solid rgba(169,124,60,0.30)"
                    : "1px solid var(--color-line)",
                }}
              >
                <dt
                  className={`text-[11px] uppercase tracking-wide ${
                    isAvoid ? "text-stone-soft" : "text-brass"
                  }`}
                >
                  {t(s.label)}
                </dt>
                <dd>
                  {s.key === "colour" ? (
                    <>
                      <span className="font-display text-lg text-ink">
                        {t(s.value)}
                      </span>
                      {s.sub ? (
                        <span className="mt-0.5 block text-[13px] text-stone">
                          {t(s.sub)}
                        </span>
                      ) : null}
                      {s.palette && s.palette.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {s.palette.map((hex, i) => (
                            <Swatch key={`${hex}-${i}`} hex={hex} />
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span
                      className={`text-sm leading-relaxed ${
                        isAvoid ? "text-stone" : "text-ink-soft"
                      }`}
                    >
                      {t(s.value)}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        <div
          className="mt-5 flex items-center justify-between pt-3.5"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          <span className="text-[11px] tracking-wide text-stone-soft">
            {t("Carry this when you shop.")}
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-brass">
            valetti.fit
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * A single palette chip with a soft fabric sheen + weave grain, so the colours
 * read as material rather than flat ink.
 */
function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="relative h-10 w-10 overflow-hidden rounded-lg"
      style={{
        background: hex,
        boxShadow: "inset 0 0 0 0.5px rgba(21,18,13,0.14)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.30), transparent 55%, rgba(21,18,13,0.20))",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.22,
          mixBlendMode: "multiply",
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(21,18,13,0.06) 1px, rgba(21,18,13,0.06) 2px), repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(21,18,13,0.05) 1px, rgba(21,18,13,0.05) 2px)",
          backgroundSize: "3px 3px",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -7px 14px rgba(21,18,13,0.14)",
        }}
      />
    </span>
  );
}
