import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";

/** In-card placeholder while report images are still rendering. */
export function ReportImageGenerating({
  label = "Generating preview",
  detail = "Atelier in progress",
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden px-4 text-center"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-br from-cream via-sand/80 to-cream"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-x-full inset-y-0 w-[200%] animate-luxe-shimmer bg-gradient-to-r from-transparent via-brass/10 to-transparent"
        aria-hidden
      />
      <LuxeSpinner size="md" tone="brass" className="relative z-10" />
      <div className="relative z-10">
        <p className="font-display text-sm text-stone">{label}</p>
        {detail ? (
          <p className="mt-1 text-xs text-stone-soft">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}
