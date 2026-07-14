"use client";

import { useState } from "react";

const ICON_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/35 text-paper shadow-sm ring-1 ring-paper/25 backdrop-blur-md transition-colors hover:bg-ink/60";

const TOOLTIP =
  "pointer-events-none absolute right-0 top-full mt-1.5 z-20 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100";

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4" />
      <path d="m15.4 6.5-6.8 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/**
 * Copies a deep link to a single look (`/report/{id}?look={index}`). The link
 * renders a look-specific OG card and scrolls to the look on open. Only shown
 * for reports that are already publicly shared.
 */
export function ShareLookButton({
  reportId,
  lookIndex,
}: {
  reportId: string;
  lookIndex: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/report/${reportId}?look=${lookIndex}#look-${lookIndex}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <span className="group/tip relative">
      <button
        type="button"
        aria-label="Share this look"
        onClick={(e) => {
          e.stopPropagation();
          void copy();
        }}
        className={ICON_BTN}
      >
        {copied ? <CheckIcon /> : <ShareIcon />}
      </button>
      <span className={TOOLTIP}>{copied ? "Link copied" : "Share look"}</span>
    </span>
  );
}
