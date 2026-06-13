"use client";

import { LuxeSpinner } from "./LuxeSpinner";

/** Full-viewport wait for long operations (report creation, etc.). */
export function LuxeBlockingWait({
  eyebrow = "In progress",
  title,
  message,
}: {
  eyebrow?: string;
  title: string;
  message: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-paper/75 px-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-md animate-rise rounded-2xl border hairline bg-paper p-10 text-center shadow-[0_24px_80px_-24px_rgba(21,18,13,0.18)]">
        <p className="eyebrow">{eyebrow}</p>
        <div className="mx-auto mt-8 flex justify-center">
          <LuxeSpinner size="lg" tone="brass" />
        </div>
        <h2 className="mt-8 font-display text-2xl leading-snug text-ink">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone">{message}</p>
        <div className="mx-auto mt-8 h-px w-20 bg-gradient-to-r from-transparent via-brass/40 to-transparent" />
        <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-stone-soft">
          Please keep this tab open
        </p>
      </div>
    </div>
  );
}
