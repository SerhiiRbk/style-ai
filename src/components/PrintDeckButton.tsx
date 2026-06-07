"use client";

export function PrintDeckButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm text-ink transition hover:border-brass hover:text-brass"
    >
      Save as PDF
    </button>
  );
}
