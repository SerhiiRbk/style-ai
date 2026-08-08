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
 * Ask the asset proxy for the watermarked variant (bottom-right `valetti.fit`)
 * so a shared image carries attribution wherever it lands. Drops `orig`/`dl`
 * so the proxy composites the mark instead of serving raw bytes.
 */
function withWatermark(src: string): string {
  const [base, query = ""] = src.split("?");
  const params = new URLSearchParams(query);
  params.delete("orig");
  params.delete("dl");
  params.set("wm", "1");
  return `${base}?${params.toString()}`;
}

function absolute(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

/**
 * Shares the actual image (not a report link), watermarked with `valetti.fit`
 * so it doubles as attribution wherever it's reposted. Uses the Web Share API
 * where supported; otherwise copies a direct link. Works regardless of report
 * visibility — the signed asset URL is self-authenticating.
 */
export function ShareImageButton({
  src,
  title = "My Valetti look",
  className,
}: {
  src: string;
  title?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "shared" | "copied" | "error">(
    "idle",
  );

  async function share() {
    setStatus("idle");
    // A direct, self-authenticating web link to the watermarked image (valid
    // ~7 days). Works for anyone with the link, regardless of report visibility.
    const link = absolute(withWatermark(src));
    try {
      // On touch devices, offer the native share sheet with the link. On
      // desktop we copy the link directly — desktop share sheets tend to hand
      // back a local file path rather than a shareable URL.
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      const isTouch =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;

      if (isTouch && nav && "share" in nav) {
        try {
          await nav.share({ url: link, title });
          setStatus("shared");
          window.setTimeout(() => setStatus("idle"), 2000);
          return;
        } catch {
          /* user cancelled or unsupported — fall through to copy */
        }
      }

      await navigator.clipboard.writeText(link);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
    }
  }

  const done = status === "shared" || status === "copied";
  const tip =
    status === "copied"
      ? "Link copied"
      : status === "shared"
        ? "Shared"
        : status === "error"
          ? "Couldn’t share"
          : "Share image";

  return (
    <span className={`group/tip relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        aria-label="Share image"
        onClick={(e) => {
          e.stopPropagation();
          void share();
        }}
        className={ICON_BTN}
      >
        {done ? <CheckIcon /> : <ShareIcon />}
      </button>
      <span className={TOOLTIP}>{tip}</span>
    </span>
  );
}
