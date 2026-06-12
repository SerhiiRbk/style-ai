import { CREDIT_COSTS } from "@/lib/credit-costs";

/** One-line hint for owners — shown above hairstyle / grooming photo grids. */
export function RegenPhotoHint({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-sm leading-relaxed text-stone ${className}`.trim()}
    >
      Don&apos;t love a preview? Tap{" "}
      <span className="font-medium text-ink">Render again</span> on any AI
      photo ({CREDIT_COSTS.regen} credit each).
    </p>
  );
}
