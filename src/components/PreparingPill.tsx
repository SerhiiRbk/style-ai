"use client";

import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";

/**
 * Fixed top-of-viewport status pill used while a download/export is preparing.
 * Pair with a fetch→blob download so the indicator can dismiss when the file
 * is ready — a plain `<a download>` gives no "started" signal.
 */
export function PreparingPill({
  message,
  tone = "loading",
}: {
  message: string;
  tone?: "loading" | "error";
}) {
  return (
    <>
      {tone === "loading" ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px] overflow-hidden bg-line/30"
          aria-hidden
        >
          <div className="h-full w-full animate-luxe-progress bg-gradient-to-r from-transparent via-brass to-brass-soft" />
        </div>
      ) : null}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[119] flex justify-center px-4">
        <p className="inline-flex items-center gap-2.5 rounded-full border hairline bg-paper/95 px-4 py-2 text-[11px] tracking-wide text-stone shadow-sm backdrop-blur-md animate-rise">
          {tone === "loading" ? <LuxeSpinner size="xs" tone="brass" /> : null}
          {message}
        </p>
      </div>
    </>
  );
}
