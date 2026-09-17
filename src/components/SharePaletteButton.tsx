"use client";

import { useState } from "react";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";
import { PreparingPill } from "@/components/PreparingPill";
import { COLOURS_SOCIAL_FORMATS } from "@/lib/og/formats";
import { trackEvent } from "@/lib/client/track-event";

export function SharePaletteButton({
  subseason,
  subseasonLabel,
  undertone,
  contrast,
}: {
  subseason: string;
  subseasonLabel: string;
  undertone?: string | null;
  contrast?: string | null;
}) {
  const [shared, setShared] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = `/colours/${subseason}${
    undertone || contrast
      ? `?${new URLSearchParams({
          ...(undertone ? { u: undertone } : {}),
          ...(contrast ? { c: contrast } : {}),
        }).toString()}`
      : ""
  }`;

  async function share() {
    const text = `My colours are ${subseasonLabel} — find yours free with Valetti.`;
    const url = `https://www.valetti.fit${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My colours — Valetti", text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
      trackEvent("colours_result", { subseason, shared: true });
    } catch {
      /* dismissed */
    }
  }

  async function download(format: string, filename: string) {
    setDownloading(format);
    setError(null);
    try {
      const res = await fetch(
        `/api/og/colours/${encodeURIComponent(subseason)}?format=${format}`,
      );
      if (!res.ok) throw new Error(`Share image failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Couldn't prepare the image. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border hairline bg-cream/40 p-5 sm:p-6">
      <p className="font-display text-lg text-ink">Share your palette</p>
      <p className="mt-1 text-sm text-stone">
        Season, swatches, valetti.fit — the same card as on the free colour
        reading.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex items-center justify-center rounded-full border border-ink/25 px-6 py-2.5 text-sm text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
        >
          {shared ? "Copied — paste to share" : "Share my palette"}
        </button>
        {COLOURS_SOCIAL_FORMATS.map((social) => {
          const busy = downloading === social.format;
          return (
            <button
              key={social.format}
              type="button"
              disabled={Boolean(downloading)}
              onClick={() =>
                void download(
                  social.format,
                  `valetti-colours-${subseason}-${social.filenameSuffix}.jpg`,
                )
              }
              className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-4 py-2 text-sm text-ink transition-colors hover:border-ink disabled:opacity-60"
            >
              {busy ? <LuxeSpinner size="xs" tone="brass" /> : null}
              {busy ? "Preparing…" : social.label}
            </button>
          );
        })}
      </div>
      {downloading ? <PreparingPill message="Preparing your share image…" /> : null}
      {error ? <PreparingPill message={error} tone="error" /> : null}
    </div>
  );
}
