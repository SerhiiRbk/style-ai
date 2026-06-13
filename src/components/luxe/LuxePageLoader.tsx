import { LuxeSpinner } from "./LuxeSpinner";

export function LuxePageLoader({
  eyebrow = "Valetti",
  message = "One moment…",
  hint = "This usually takes a few seconds.",
}: {
  eyebrow?: string;
  message?: string;
  hint?: string;
}) {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="w-full max-w-md animate-rise text-center">
          <p className="eyebrow">{eyebrow}</p>
          <div className="mx-auto mt-10 flex justify-center">
            <LuxeSpinner size="lg" tone="brass" />
          </div>
          <h1 className="mt-8 font-display text-2xl leading-snug text-ink sm:text-3xl">
            {message}
          </h1>
          <p className="mt-3 text-sm text-stone-soft">{hint}</p>
          <div className="mx-auto mt-10 h-px w-24 bg-gradient-to-r from-transparent via-brass/50 to-transparent" />
        </div>
      </section>
    </main>
  );
}
