"use client";

import { useEffect, useState } from "react";
import {
  LOOK_ESTIMATE_VERDICT,
  type LookEstimateOpinion,
} from "@/lib/look-estimate";

export function LookEstimateBody({
  opinion,
}: {
  opinion: LookEstimateOpinion;
}) {
  const style = LOOK_ESTIMATE_VERDICT[opinion.verdict];
  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${style.dot}`}
          aria-hidden
        />
        <span className="text-xs uppercase tracking-wider text-stone">
          Carlo · {style.label}
        </span>
      </div>
      <h3 className="mt-2 font-display text-base leading-snug text-ink">
        {opinion.headline}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-stone">{opinion.body}</p>
      {opinion.pairWith.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-stone-soft">
            Pair with
          </p>
          <ul className="mt-1 space-y-1">
            {opinion.pairWith.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="text-brass" aria-hidden>
                  ·
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/**
 * Overlay on a constructed look. The opinion is generated during Apply —
 * this only reveals the stored text on hover or tap.
 */
export function LookEstimate({
  opinion,
}: {
  opinion: LookEstimateOpinion;
}) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  return (
    <div
      className="absolute top-3 left-3 z-20 max-w-[min(100%-1.5rem,20rem)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        if (!pinned) setHover(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label="Carlo's estimate of this look"
        title="Carlo's estimate of this look"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setPinned((p) => !p);
        }}
        className="inline-flex h-10 items-center rounded-full border border-paper/40 bg-ink/70 px-3 text-xs font-medium text-paper shadow-sm backdrop-blur-sm transition-colors hover:bg-ink/85"
      >
        Estimate
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Carlo's estimate"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 max-h-72 overflow-y-auto rounded-2xl border hairline bg-paper/95 p-4 shadow-xl backdrop-blur-md"
        >
          <LookEstimateBody opinion={opinion} />
        </div>
      ) : null}
    </div>
  );
}
