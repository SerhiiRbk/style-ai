"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportGenerationState } from "@/lib/report";

const POLL_MS = 8_000;

function messageFor(phase: ReportGenerationState["phase"]): string {
  if (phase === "report") {
    return "We're analysing your photos and writing your personalised report.";
  }
  if (phase === "hair") {
    return "We're generating personalised hairstyle previews on your photo.";
  }
  if (phase === "grooming") {
    return "We're generating personalised facial hair and glasses previews on your photo.";
  }
  if (phase === "capsule") {
    return "We're generating your week-of-outfits lookbook photos.";
  }
  return "We're generating photorealistic images for your recommended looks.";
}

export function ReportGenerationBanner({
  reportId,
  initial,
}: {
  reportId: string;
  initial: ReportGenerationState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);

  useEffect(() => {
    if (!state.pending) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = (await res.json()) as ReportGenerationState;
        if (cancelled) return;
        setState(next);
        if (!next.pending) {
          router.refresh();
        }
      } catch {
        /* keep banner visible; user can refresh manually */
      }
    }

    const id = window.setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reportId, router, state.pending]);

  if (!state.pending) return null;

  if (state.status === "failed") {
    return (
      <div
        role="status"
        className="border-b border-[#9E5C3C]/30 bg-[#9E5C3C]/10 text-ink"
      >
        <div className="container-luxe py-4 text-sm leading-relaxed">
          <p className="font-medium">Report generation failed</p>
          <p className="mt-1 text-stone">
            Please try again from{" "}
            <a href="/start" className="underline hover:text-ink">
              a new report
            </a>
            . If the problem persists, check your connection and API keys.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b hairline bg-brass/15 text-ink"
    >
      <div className="container-luxe flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
            aria-hidden
          />
          <div className="text-sm leading-relaxed">
            <p className="font-medium">Generation in progress</p>
            <p className="mt-1 text-stone">{messageFor(state.phase)}</p>
            <p className="mt-1 text-stone">
              You can stay on this page — we&apos;ll refresh when new images are ready
              — or come back in a few minutes. Your colours, shopping list, and
              written guidance are already saved below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="shrink-0 self-start rounded-full border hairline bg-paper px-4 py-2 text-xs text-stone transition-colors hover:text-ink sm:self-center"
        >
          Refresh now
        </button>
      </div>
    </div>
  );
}
