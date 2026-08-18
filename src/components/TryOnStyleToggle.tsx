"use client";

export type CatalogTryOnStyle = "photo" | "studio";

const OPTIONS: {
  id: CatalogTryOnStyle;
  label: string;
  hint: string;
}[] = [
  {
    id: "photo",
    label: "On my photo",
    hint: "Keep your photo — only the clothes change.",
  },
  {
    id: "studio",
    label: "My photo · studio",
    hint: "Your own photo on a clean studio backdrop — face and pose preserved.",
  },
];

/**
 * Catalog try-on style: in-place on the source photo, or the same identity
 * lock moved onto a studio backdrop (the look-page studio option).
 */
export function TryOnStyleToggle({
  value,
  onChange,
  disabled,
  tone = "light",
}: {
  value: CatalogTryOnStyle;
  onChange: (next: CatalogTryOnStyle) => void;
  disabled?: boolean;
  tone?: "light" | "dark";
}) {
  const hint = OPTIONS.find((o) => o.id === value)?.hint;
  const dark = tone === "dark";

  return (
    <div>
      <p
        className={`mb-1 text-[11px] uppercase tracking-wider ${
          dark ? "text-paper/40" : "text-stone-soft"
        }`}
      >
        Result style
      </p>
      <div
        role="radiogroup"
        aria-label="Try-on style"
        className={`mb-1.5 inline-flex rounded-full p-0.5 ${
          dark
            ? "border border-paper/15 bg-paper/5"
            : "border hairline bg-cream/60"
        }`}
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              disabled={disabled}
              className={`rounded-full px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? dark
                    ? "bg-brass/20 text-brass-soft"
                    : "bg-brass/15 text-brass"
                  : dark
                    ? "text-paper/45 hover:text-paper"
                    : "text-stone-soft hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p className={`text-[11px] ${dark ? "text-paper/40" : "text-stone-soft"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
