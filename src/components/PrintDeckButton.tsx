"use client";

export function PrintDeckButton({
  variant = "light",
}: {
  /** `dark` — for use on ink backgrounds (investor cover). */
  variant?: "light" | "dark";
}) {
  const className =
    variant === "dark"
      ? "no-print rounded-full border border-paper/25 bg-paper px-5 py-2.5 text-sm text-ink transition hover:border-brass-soft hover:bg-cream"
      : "no-print rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm text-ink transition hover:border-brass hover:text-brass";

  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Save as PDF
    </button>
  );
}
